import { deleteRecord, getAll, putRecord } from "../database/database.js";
import { createId, escapeHTML, formatDate, normalizePlate } from "../utils/helpers.js";

export async function listVehicles() {
  return (await getAll("vehicles")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveVehicle(formData) {
  const model = String(formData.get("model") ?? "").trim();
  const plate = normalizePlate(String(formData.get("plate") ?? ""));
  const responsible = String(formData.get("responsible") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!model || !plate) throw new Error("Preencha o modelo e a placa do veículo.");
  if (plate.length < 7 || plate.length > 8) throw new Error("Confira o formato da placa.");

  const vehicles = await listVehicles();
  if (vehicles.some((vehicle) => vehicle.plate === plate)) {
    throw new Error("Já existe um veículo cadastrado com esta placa.");
  }

  const vehicle = {
    id: createId(),
    model,
    plate,
    responsible,
    notes,
    createdAt: new Date().toISOString()
  };

  await putRecord("vehicles", vehicle);
  return vehicle;
}

export async function removeVehicle(id) {
  await deleteRecord("vehicles", id);
}

export function renderVehicleRows(vehicles) {
  if (!vehicles.length) {
    return `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">▣</span><strong>Nenhum veículo encontrado</strong><p>Cadastre um veículo ou ajuste sua busca.</p></div></td></tr>`;
  }

  return vehicles.map((vehicle) => `
    <tr>
      <td><strong>${escapeHTML(vehicle.model)}</strong></td>
      <td><span class="plate-pill">${escapeHTML(vehicle.plate)}</span></td>
      <td>${escapeHTML(vehicle.responsible || "Não informado")}</td>
      <td>${formatDate(vehicle.createdAt)}</td>
      <td class="align-right"><button class="table-action" data-delete-vehicle="${escapeHTML(vehicle.id)}">Excluir</button></td>
    </tr>
  `).join("");
}
