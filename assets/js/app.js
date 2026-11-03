import { getAll } from "./database/database.js";
import { exportBackup, importBackup } from "./modules/backup.js";
import { listVehicles, removeVehicle, renderVehicleRows, saveVehicle } from "./modules/vehicles.js";
import { checklistMarkup, detailMarkup, historyMarkup, inspectionRowsMarkup, listInspections, saveInspection } from "./modules/inspections.js";
import { downloadInspectionPDF, shareInspectionPDF } from "./modules/pdf.js";

const pages = ["dashboard", "vehicles", "inspections", "history", "reports", "backup"];
const pageNames = { dashboard: "Visão geral", vehicles: "Veículos", inspections: "Vistorias", history: "Histórico", reports: "Relatórios", backup: "Backup" };
const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");
let toastTimer;
const photoMap = new Map();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
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
  if (page === "inspections" || page === "history") refreshInspections();
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
  } else {
    const latest = [...inspections].sort((a,b) => b.date.localeCompare(a.date)).slice(0,3);
    recent.className = "recent-list";
    recent.innerHTML = latest.map((item) => `<div class="recent-entry"><strong>${escapeText(item.vehicleModel)} · ${escapeText(item.vehiclePlate)}</strong><small>${new Intl.DateTimeFormat("pt-BR").format(new Date(item.date))} · ${item.hasIssues ? "Com avarias" : "Sem avarias"}</small></div>`).join("");
  }
}

function escapeText(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function refreshVehicles() {
  const vehicles = await listVehicles();
  const search = $("#vehicleSearch").value.trim().toLowerCase();
  const filtered = vehicles.filter((vehicle) => vehicle.model.toLowerCase().includes(search) || vehicle.plate.toLowerCase().includes(search));
  $("#vehicleTableBody").innerHTML = renderVehicleRows(filtered);
  $("#vehicleCount").textContent = `${vehicles.length} ${vehicles.length === 1 ? "veículo cadastrado" : "veículos cadastrados"}`;
}

async function refreshInspections() {
  const inspections = await listInspections();
  $("#inspectionTableBody").innerHTML = inspectionRowsMarkup(inspections);
  $("#inspectionCount").textContent = `${inspections.length} ${inspections.length === 1 ? "vistoria registrada" : "vistorias registradas"}`;
  $("#historyList").innerHTML = historyMarkup(inspections);
}

function openVehicleDialog() { $("#vehicleForm").reset(); $("#vehicleDialog").showModal(); }

async function openInspectionDialog() {
  const vehicles = await listVehicles();
  if (!vehicles.length) {
    showToast("Cadastre um veículo antes de iniciar uma vistoria.");
    navigate("vehicles");
    return;
  }
  const select = $("#inspectionVehicle");
  select.innerHTML = '<option value="">Selecione um veículo</option>' + vehicles.map((v) => `<option value="${escapeText(v.id)}">${escapeText(v.model)} · ${escapeText(v.plate)}</option>`).join("");
  const form = $("#inspectionForm");
  form.reset();
  photoMap.clear();
  $("#checklistContainer").innerHTML = checklistMarkup();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("#inspectionDate").value = now.toISOString().slice(0,16);
  $("#inspectionDialog").showModal();
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); navigate(link.dataset.page); }));
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
      await refreshVehicles(); await refreshDashboard();
      showToast("Veículo cadastrado com sucesso.");
    } catch (error) { showToast(error.message || "Não foi possível salvar o veículo."); }
  });
  $("#vehicleSearch").addEventListener("input", refreshVehicles);
  $("#vehicleTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-vehicle]");
    if (!button || !confirm("Deseja realmente excluir este veículo?")) return;
    await removeVehicle(button.dataset.deleteVehicle);
    await refreshVehicles(); await refreshDashboard();
    showToast("Veículo excluído.");
  });
}


function setupInspections() {
  $("#newInspectionButton").addEventListener("click", openInspectionDialog);

  $("#closeInspectionDialog").addEventListener("click", () => {
    $("#inspectionDialog").close();
  });

  $("#cancelInspectionButton").addEventListener("click", () => {
    $("#inspectionDialog").close();
  });

  // Identifica quando uma foto é selecionada pela câmera ou galeria.
  $("#checklistContainer").addEventListener("change", async (event) => {
    const input = event.target.closest(
      'input[type="file"][data-photo-camera], input[type="file"][data-photo-gallery]'
    );

    if (!input || !input.files?.[0]) return;

    const photoId = input.dataset.photoCamera || input.dataset.photoGallery;

    try {
      const file = input.files[0];

      const { resizePhoto } = await import("./modules/inspections.js");

      // Redimensiona e comprime a imagem.
      const dataUrl = await resizePhoto(file);

      // Guarda a foto temporariamente até salvar a vistoria.
      photoMap.set(photoId, dataUrl);

      // Atualiza a identificação da foto.
      const photoName = $(`[data-photo-name="${photoId}"]`);
      if (photoName) {
        photoName.textContent = "Foto anexada";
      }

      // Exibe a prévia da imagem.
      const preview = $(`[data-photo-preview="${photoId}"]`);
      const image = $(`[data-photo-image="${photoId}"]`);

      if (preview && image) {
        image.src = dataUrl;
        preview.hidden = false;
      }

      showToast("Foto adicionada ao item.");

    } catch (error) {
      showToast(error.message || "Não foi possível carregar a foto.");
    } finally {
      // Permite selecionar novamente o mesmo arquivo.
      input.value = "";
    }
  });

  // Remove uma foto sem alterar as observações do item.
  $("#checklistContainer").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-remove]");

    if (!button) return;

    const photoId = button.dataset.photoRemove;

    // Remove a foto do armazenamento temporário.
    photoMap.delete(photoId);

    // Limpa a imagem da prévia.
    const preview = $(`[data-photo-preview="${photoId}"]`);
    const image = $(`[data-photo-image="${photoId}"]`);
    const photoName = $(`[data-photo-name="${photoId}"]`);

    if (image) {
      image.removeAttribute("src");
    }

    if (preview) {
      preview.hidden = true;
    }

    if (photoName) {
      photoName.textContent = "Nenhuma foto";
    }

    // Limpa os campos de câmera e galeria.
    const cameraInput = $(`[data-photo-camera="${photoId}"]`);
    const galleryInput = $(`[data-photo-gallery="${photoId}"]`);

    if (cameraInput) cameraInput.value = "";
    if (galleryInput) galleryInput.value = "";

    showToast("Foto removida.");
  });

  // Salva a vistoria e suas respectivas fotos.
  $("#inspectionForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = event.submitter;
    submit.disabled = true;

    try {
      await saveInspection(event.currentTarget, photoMap);

      $("#inspectionDialog").close();

      await refreshInspections();
      await refreshDashboard();

      navigate("inspections");

      showToast("Vistoria salva com sucesso.");

    } catch (error) {
      showToast(error.message || "Não foi possível salvar a vistoria.");

    } finally {
      submit.disabled = false;
    }
  });

  // Abre os detalhes de uma vistoria registrada.
  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-inspection-detail]");

    if (!button) return;

    const inspection = (await listInspections()).find(
      (item) => item.id === button.dataset.inspectionDetail
    );

    if (!inspection) return;

    $("#inspectionDetailContent").innerHTML = `
    <div class="report-actions">
      <button type="button" class="button button-secondary" data-download-inspection-pdf>
        Baixar PDF
      </button>

      <button type="button" class="button button-primary" data-share-inspection-pdf>
        Enviar pelo WhatsApp
      </button>
    </div>

    ${detailMarkup(inspection)}
  `;
  
  $("#inspectionDetailContent").dataset.inspectionId = inspection.id;
  $("#inspectionDetailDialog").showModal();
    // Exporta ou compartilha o relatório da vistoria.
$("#inspectionDetailContent").addEventListener("click", async (event) => {
  const downloadButton = event.target.closest(
    "[data-download-inspection-pdf]"
  );

  const shareButton = event.target.closest(
    "[data-share-inspection-pdf]"
  );

  if (!downloadButton && !shareButton) return;

  const buttons = $("#inspectionDetailContent").querySelectorAll("button");
  buttons.forEach(button => button.disabled = true);

  try {
    const inspectionId = $("#inspectionDetailContent").dataset.inspectionId;

    const inspection = (await listInspections()).find(
      item => item.id === inspectionId
    );

    if (!inspection) {
      throw new Error("Não foi possível localizar a vistoria.");
    }

    if (downloadButton) {
      await downloadInspectionPDF(inspection);
      showToast("PDF gerado com sucesso.");
    }

    if (shareButton) {
      const result = await shareInspectionPDF(inspection);

      if (result === "shared") {
        showToast("Relatório preparado para compartilhamento.");
      } else {
        showToast("PDF baixado. Anexe o arquivo no WhatsApp.");
      }
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      showToast(error.message || "Não foi possível gerar o PDF.");
    }
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
});
  });

  $("#closeDetailDialog").addEventListener("click", () => {
    $("#inspectionDetailDialog").close();
  });
}


function setupBackup() {
  $("#exportBackup").addEventListener("click", async () => {
    try { await exportBackup(); $("#backupFeedback").textContent = "Backup exportado."; }
    catch { $("#backupFeedback").textContent = "Não foi possível exportar o backup."; }
  });
  $("#importBackup").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    if (!confirm("A restauração substituirá os dados atuais deste dispositivo. Deseja continuar?")) { event.target.value = ""; return; }
    try {
      await importBackup(file); await refreshDashboard(); await refreshVehicles(); await refreshInspections();
      $("#backupFeedback").textContent = "Backup restaurado com sucesso."; showToast("Dados restaurados.");
    } catch (error) { $("#backupFeedback").textContent = error.message || "Falha ao restaurar o backup."; }
    event.target.value = "";
  });
}

async function startApp() {
  if (!("indexedDB" in window)) { alert("Este navegador não oferece suporte ao armazenamento necessário para o sistema."); return; }
  setupNavigation(); setupVehicleForm(); setupInspections(); setupBackup();
  await refreshDashboard(); await refreshVehicles(); await refreshInspections();
  navigate(location.hash.slice(1) || "dashboard");
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker não registrado:", error));
  }
}

startApp().catch((error) => { console.error("Falha ao iniciar a aplicação:", error); showToast("Não foi possível iniciar o sistema. Atualize a página."); });
