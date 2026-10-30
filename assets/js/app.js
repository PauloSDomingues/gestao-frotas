import { getAll } from "./database/database.js";
import { exportBackup, importBackup } from "./modules/backup.js";
import { listVehicles, removeVehicle, renderVehicleRows, saveVehicle } from "./modules/vehicles.js";

const pages = ["dashboard", "vehicles", "inspections", "history", "reports", "backup"];
const pageNames = {
  dashboard: "Visão geral", vehicles: "Veículos", inspections: "Vistorias",
  history: "Histórico", reports: "Relatórios", backup: "Backup"
};

const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function navigate(page) {
  if (!pages.includes(page)) page = "dashboard";
  document.querySelectorAll(".page").forEach((element) => element.classList.toggle("active", element.id === `page-${page}`));
  document.querySelectorAll(".nav-link").forEach((element) => element.classList.toggle("active", element.dataset.page === page));
  $("#pageLabel").textContent = pageNames[page];
  $("#sidebar").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  if (page === "vehicles") refreshVehicles();
}

async function refreshDashboard() {
  const [vehicles, inspections] = await Promise.all([getAll("vehicles"), getAll("inspections")]);
  $("#statVehicles").textContent = vehicles.length;
  $("#statInspections").textContent = inspections.length;
  $("#statIssues").textContent = inspections.filter((item) => item.hasIssues).length;

  const recent = $("#recentActivity");
  if (!inspections.length) {
    recent.className = "empty-state compact";
    recent.innerHTML = '<span class="empty-icon">◷</span><strong>Nenhuma atividade ainda</strong><p>Os registros aparecerão aqui conforme você utilizar o sistema.</p>';
  }
}

async function refreshVehicles() {
  const vehicles = await listVehicles();
  const search = $("#vehicleSearch").value.trim().toLowerCase();
  const filtered = vehicles.filter((vehicle) =>
    vehicle.model.toLowerCase().includes(search) || vehicle.plate.toLowerCase().includes(search)
  );
  $("#vehicleTableBody").innerHTML = renderVehicleRows(filtered);
  $("#vehicleCount").textContent = `${vehicles.length} ${vehicles.length === 1 ? "veículo cadastrado" : "veículos cadastrados"}`;
}

function openVehicleDialog() {
  $("#vehicleForm").reset();
  $("#vehicleDialog").showModal();
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.page);
    });
  });
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  $("#menuButton").addEventListener("click", () => {
    const opened = $("#sidebar").classList.toggle("open");
    $("#menuButton").setAttribute("aria-expanded", String(opened));
  });
}

function setupVehicleForm() {
  $("#newVehicleButton").addEventListener("click", openVehicleDialog);
  document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => $("#vehicleDialog").close()));
  $("#vehicleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveVehicle(new FormData(event.currentTarget));
      $("#vehicleDialog").close();
      await refreshVehicles();
      await refreshDashboard();
      showToast("Veículo cadastrado com sucesso.");
    } catch (error) {
      showToast(error.message || "Não foi possível salvar o veículo.");
    }
  });

  $("#vehicleSearch").addEventListener("input", refreshVehicles);
  $("#vehicleTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-vehicle]");
    if (!button) return;
    if (!confirm("Deseja realmente excluir este veículo?")) return;
    await removeVehicle(button.dataset.deleteVehicle);
    await refreshVehicles();
    await refreshDashboard();
    showToast("Veículo excluído.");
  });
}

function setupBackup() {
  $("#exportBackup").addEventListener("click", async () => {
    try {
      await exportBackup();
      $("#backupFeedback").textContent = "Backup exportado.";
    } catch {
      $("#backupFeedback").textContent = "Não foi possível exportar o backup.";
    }
  });

  $("#importBackup").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    if (!confirm("A restauração substituirá os dados atuais deste dispositivo. Deseja continuar?")) {
      event.target.value = "";
      return;
    }
    try {
      await importBackup(file);
      await refreshDashboard();
      await refreshVehicles();
      $("#backupFeedback").textContent = "Backup restaurado com sucesso.";
      showToast("Dados restaurados.");
    } catch (error) {
      $("#backupFeedback").textContent = error.message || "Falha ao restaurar o backup.";
    }
    event.target.value = "";
  });
}

async function startApp() {
  if (!("indexedDB" in window)) {
    alert("Este navegador não oferece suporte ao armazenamento necessário para o sistema.");
    return;
  }

  setupNavigation();
  setupVehicleForm();
  setupBackup();
  await refreshDashboard();
  await refreshVehicles();
  navigate(location.hash.slice(1) || "dashboard");

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker não registrado:", error));
  }
}

startApp().catch((error) => {
  console.error("Falha ao iniciar a aplicação:", error);
  showToast("Não foi possível iniciar o sistema. Atualize a página.");
});
