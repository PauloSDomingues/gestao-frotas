import { getAll, putRecord } from "../database/database.js";
import { createId, escapeHTML, formatDate } from "../utils/helpers.js";

export const CHECKLIST = [
  { category: "Documentação e identificação", items: ["Documento do veículo", "Identificação e placas", "Licenciamento e documentação obrigatória"] },
  { category: "Condições externas", items: ["Lataria e pintura", "Para-brisa e demais vidros", "Retrovisores, faróis e lanternas", "Portas, fechaduras e limpadores"] },
  { category: "Pneus e rodas", items: ["Pneus e estepe", "Rodas e fixação"] },
  { category: "Mecânica e segurança", items: ["Freios", "Direção e suspensão", "Buzina e cintos de segurança", "Painel e indicadores"] },
  { category: "Equipamentos e materiais", items: ["Macaco, chave de roda e triângulo", "Extintor, quando aplicável", "Ferramentas e equipamentos de trabalho", "EPIs e materiais de segurança"] }
];

export function checklistMarkup() {
  let index = 0;

  return CHECKLIST.map((group) => {
    const itemsHTML = group.items.map((label) => {
      const id = `item-${index++}`;

      return `
        <div class="checklist-item" data-check-item="${id}">
          <div class="checklist-item-top">
            <strong>${escapeHTML(label)}</strong>
            <select aria-label="Condição: ${escapeHTML(label)}" data-status="${id}">
              <option value="not_checked">Não verificado</option>
              <option value="ok">Conforme</option>
              <option value="issue">Avaria</option>
            </select>
          </div>
          <div class="checklist-extra">
            <input type="text" maxlength="300"
              placeholder="Observação (opcional)"
              aria-label="Observação: ${escapeHTML(label)}"
              data-note="${id}">
            <label class="photo-picker">
              + Foto
              <input type="file" accept="image/*"
                capture="environment" data-photo="${id}" hidden>
            </label>
            <span class="photo-name" data-photo-name="${id}"></span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="checklist-group">
        <h4>${escapeHTML(group.category)}</h4>
        ${itemsHTML}
      </section>
    `;
  }).join("");
}

export async function listInspections() {
  return (await getAll("inspections")).sort((a, b) => b.date.localeCompare(a.date));
}

export async function resizePhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A foto deve ter no máximo 12 MB.");
  const image = await createImageBitmap(file);
  const maxSide = 1280;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function saveInspection(form, photoMap) {
  const data = new FormData(form);
  const vehicleId = String(data.get("vehicleId") || "");
  const vehicles = await getAll("vehicles");
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) throw new Error("Selecione um veículo cadastrado.");

  const date = new Date(String(data.get("date")));
  if (Number.isNaN(date.getTime())) throw new Error("Informe uma data válida.");
  const odometer = Number(data.get("odometer"));
  if (!Number.isFinite(odometer) || odometer < 0) throw new Error("Informe uma quilometragem válida.");

  const items = [];
  let index = 0;
  for (const group of CHECKLIST) {
    for (const label of group.items) {
      const id = `item-${index++}`;
      const status = form.querySelector(`[data-status="${id}"]`).value;
      const notes = form.querySelector(`[data-note="${id}"]`).value.trim();
      const photo = photoMap.get(id) || null;
      items.push({ category: group.category, label, status, notes, photo });
    }
  }

  const inspection = {
    id: createId(), vehicleId, vehicleModel: vehicle.model, vehiclePlate: vehicle.plate,
    driver: String(data.get("driver")).trim(), inspector: String(data.get("inspector")).trim(),
    odometer, date: date.toISOString(), generalNotes: String(data.get("generalNotes") || "").trim(),
    items, hasIssues: items.some((item) => item.status === "issue"),
    createdAt: new Date().toISOString()
  };
  if (!inspection.driver || !inspection.inspector) throw new Error("Informe o motorista e o vistoriador.");
  await putRecord("inspections", inspection);
  return inspection;
}

export function inspectionRowsMarkup(inspections) {
  if (!inspections.length) return `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">✓</span><strong>Nenhuma vistoria registrada</strong><p>Inicie uma vistoria para gerar o primeiro registro.</p></div></td></tr>`;
  return inspections.map((item) => `<tr><td>${formatDate(item.date)}</td><td><strong>${escapeHTML(item.vehicleModel)}</strong><br><span class="muted">${escapeHTML(item.vehiclePlate)}</span></td><td>${escapeHTML(item.driver)}</td><td>${escapeHTML(item.inspector)}</td><td><span class="result-pill ${item.hasIssues ? "has-issues" : "no-issues"}">${item.hasIssues ? "Com avarias" : "Sem avarias"}</span><button class="table-action detail-action" data-inspection-detail="${escapeHTML(item.id)}">Detalhes</button></td></tr>`).join("");
}

export function historyMarkup(inspections) {
  if (!inspections.length) return `<div class="empty-state"><span class="empty-icon">◷</span><strong>Histórico vazio</strong><p>As vistorias concluídas aparecerão aqui.</p></div>`;
  return inspections.map((item) => `<button class="history-entry" data-inspection-detail="${escapeHTML(item.id)}"><span class="history-date">${formatDate(item.date)}</span><span class="history-main"><strong>${escapeHTML(item.vehicleModel)} · ${escapeHTML(item.vehiclePlate)}</strong><small>Motorista: ${escapeHTML(item.driver)} | Vistoriador: ${escapeHTML(item.inspector)}</small></span><span class="result-pill ${item.hasIssues ? "has-issues" : "no-issues"}">${item.hasIssues ? "Com avarias" : "Sem avarias"}</span></button>`).join("");
}

export function detailMarkup(item) {
  const rows = item.items.map((entry) => `<div class="detail-check-item"><div><strong>${escapeHTML(entry.label)}</strong><small>${escapeHTML(entry.category)}</small><p>${entry.status === "ok" ? "Conforme" : entry.status === "issue" ? "Avaria" : "Não verificado"}${entry.notes ? ` · ${escapeHTML(entry.notes)}` : ""}</p>${entry.photo ? `<img class="inspection-photo" src="${entry.photo}" alt="Foto da ocorrência: ${escapeHTML(entry.label)}">` : ""}</div><span class="result-pill ${entry.status === "issue" ? "has-issues" : entry.status === "ok" ? "no-issues" : "not-checked"}">${entry.status === "ok" ? "Conforme" : entry.status === "issue" ? "Avaria" : "Não verificado"}</span></div>`).join("");
  return `<div class="detail-summary"><strong>${escapeHTML(item.vehicleModel)} · ${escapeHTML(item.vehiclePlate)}</strong><span>${formatDate(item.date)} às ${new Intl.DateTimeFormat("pt-BR", {hour:"2-digit", minute:"2-digit"}).format(new Date(item.date))}</span><span>Motorista: ${escapeHTML(item.driver)}</span><span>Vistoriador: ${escapeHTML(item.inspector)}</span><span>Quilometragem: ${Number(item.odometer).toLocaleString("pt-BR")} km</span>${item.generalNotes ? `<p>${escapeHTML(item.generalNotes)}</p>` : ""}</div><div class="detail-checklist">${rows}</div>`;
}
