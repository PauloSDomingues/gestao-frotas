import { getAll, putRecord } from "../database/database.js";
import { createId, escapeHTML, formatDate } from "../utils/helpers.js";

export const CHECKLIST = [
  { category: "Documentação e identificação", items: ["Documentação do veículo (CRLV, licenciamento e demais documentos obrigatórios)", "Identificação e placas"] },
  { category: "Condições externas", items: ["Lataria e pintura", "Para-brisa e demais vidros", "Retrovisores, faróis e lanternas", "Portas, fechaduras e limpadores"] },
  { category: "Segurança", items: ["Pneus e estepe", "Freios", "Rodas e fixação", "Buzina e cintos de segurança", "Macaco, chave de roda e triângulo", "Extintor, quando aplicável"] },
  { category: "Mecânica", items: ["Nível de óleo", "Nível do arrefecimento", "Direção e suspensão", "Painel e indicadores"] },
  { category: "Equipamentos e materiais", items: ["Ferramentas e equipamentos de trabalho", "EPIs e materiais de segurança"] }
];

export function checklistMarkup() {
  let index = 0;

  return CHECKLIST.map(function (group) {
    const itemsHTML = group.items.map(function (label) {
      const id = "item-" + index++;
      const safeLabel = escapeHTML(label);

      return [
        '<div class="checklist-item" data-check-item="' + id + '">',
          '<div class="checklist-item-top">',
            '<strong>' + safeLabel + '</strong>',
            '<select aria-label="Condição: ' + safeLabel + '" data-status="' + id + '">',
              '<option value="not_checked">Não verificado</option>',
              '<option value="ok">Conforme</option>',
              '<option value="issue">Avaria</option>',
            '</select>',
          '</div>',
          '<div class="checklist-extra">',
            '<input type="text" maxlength="300" placeholder="Observação (opcional)"',
              ' aria-label="Observação: ' + safeLabel + '" data-note="' + id + '">',
          '</div>',
          '<div class="photo-actions">',
            '<label class="photo-picker">Tirar foto',
              '<input type="file" accept="image/*" capture="environment" data-photo-camera="' + id + '" hidden>',
            '</label>',
            '<label class="photo-picker">Escolher da galeria',
              '<input type="file" accept="image/*" data-photo-gallery="' + id + '" hidden>',
            '</label>',
            '<span class="photo-name" data-photo-name="' + id + '">Nenhuma foto</span>',
          '</div>',
          '<div class="photo-preview" data-photo-preview="' + id + '" hidden>',
            '<img data-photo-image="' + id + '" alt="Prévia da foto de ' + safeLabel + '">',
            '<div class="photo-preview-actions">',
              '<span>Prévia da imagem selecionada</span>',
              '<button type="button" class="photo-remove" data-photo-remove="' + id + '">Remover foto</button>',
            '</div>',
          '</div>',
        '</div>'
      ].join("");
    }).join("");

    return '<section class="checklist-group"><h4>' +
      escapeHTML(group.category) + '</h4>' + itemsHTML + '</section>';
  }).join("");
}

export async function listInspections() {
  return (await getAll("inspections")).sort((a, b) => b.date.localeCompare(a.date));
}

export async function resizePhoto(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A foto deve ter no máximo 12 MB.");
  if (!("createImageBitmap" in window)) throw new Error("Este navegador não oferece suporte ao processamento de imagens. Tente outro navegador.");
  const image = await createImageBitmap(file);
  try {
    const maxSide = 1280;
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    image.close?.();
  }
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
      items.push({ category: group.category, label, status, notes, photo: photoMap.get(id) || null });
    }
  }
  const inspection = {
    id: createId(), vehicleId, vehicleModel: vehicle.model, vehiclePlate: vehicle.plate,
    driver: String(data.get("driver")).trim(), inspector: String(data.get("inspector")).trim(),
    odometer, date: date.toISOString(), generalNotes: String(data.get("generalNotes") || "").trim(),
    items, hasIssues: items.some((item) => item.status === "issue"), createdAt: new Date().toISOString()
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
