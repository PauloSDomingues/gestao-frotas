
function getPDFLibrary() {
  if (!window.jspdf?.jsPDF) {
    throw new Error("A biblioteca de PDF não foi carregada. Atualize a página.");
  }

  return window.jspdf.jsPDF;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Data não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function safeFilename(value) {
  return String(value || "vistoria")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

function imageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };

    image.onerror = () => reject(
      new Error("Não foi possível carregar uma das fotos da vistoria.")
    );

    image.src = dataUrl;
  });
}

async function createInspectionPDF(inspection) {
  const jsPDF = getPDFLibrary();

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 17;

  let y = 15;

  function addPageIfNeeded(requiredHeight) {
    if (y + requiredHeight > bottomLimit) {
      doc.addPage();
      y = 15;
    }
  }

  function addParagraph(text, options = {}) {
    const fontSize = options.fontSize || 9;
    const lineHeight = options.lineHeight || 4.5;
    const indent = options.indent || 0;
    const width = contentWidth - indent;

    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(45, 55, 65);

    const lines = doc.splitTextToSize(
      String(text || ""),
      width
    );

    const height = lines.length * lineHeight;

    addPageIfNeeded(height + 2);

    doc.text(lines, margin + indent, y);
    y += height + (options.spacing ?? 2);
  }

  function addSectionTitle(title) {
    addPageIfNeeded(12);

    y += 3;

    doc.setFillColor(232, 239, 245);
    doc.roundedRect(margin, y - 4, contentWidth, 8, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(18, 59, 93);
    doc.text(title, margin + 3, y + 1.5);

    y += 10;
  }

  function addLabelValue(label, value) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 75);

    const labelText = `${label}:`;
    doc.text(labelText, margin, y);

    const labelWidth = doc.getTextWidth(labelText) + 2;

    doc.setFont("helvetica", "normal");
    doc.text(
      String(value || "Não informado"),
      margin + labelWidth,
      y
    );

    y += 6;
  }

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(18, 59, 93);
  doc.text("VistoriaFrotas", margin, y);

  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 95);
  doc.text("Relatório de vistoria veicular", margin, y);

  y += 5;

  doc.setDrawColor(190, 200, 210);
  doc.line(margin, y, pageWidth - margin, y);

  y += 9;

  // Identificação
  addSectionTitle("IDENTIFICAÇÃO DA VISTORIA");

  addLabelValue(
    "Veículo",
    `${inspection.vehicleModel || ""} ${inspection.vehiclePlate ? " | " + inspection.vehiclePlate : ""}`
  );

  addLabelValue("Data e hora", formatDateTime(inspection.date));
  addLabelValue("Motorista", inspection.driver);
  addLabelValue("Vistoriador", inspection.inspector);

  addLabelValue(
    "Quilometragem",
    `${Number(inspection.odometer || 0).toLocaleString("pt-BR")} km`
  );

  // Resultado geral
  addSectionTitle("RESULTADO GERAL");

  const issueCount = (inspection.items || []).filter(
    item => item.status === "issue"
  ).length;

  const uncheckedCount = (inspection.items || []).filter(
    item => item.status === "not_checked"
  ).length;

  const okCount = (inspection.items || []).filter(
    item => item.status === "ok"
  ).length;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(45, 55, 65);

  doc.text(`Conformes: ${okCount}`, margin, y);
  doc.text(`Avarias: ${issueCount}`, margin + 55, y);
  doc.text(`Não verificados: ${uncheckedCount}`, margin + 105, y);

  y += 8;

  // Checklist
  addSectionTitle("CHECKLIST DA VISTORIA");

  let currentCategory = "";

  for (const item of inspection.items || []) {
    if (item.category !== currentCategory) {
      currentCategory = item.category;

      addPageIfNeeded(10);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(18, 59, 93);
      doc.text(currentCategory || "Outros itens", margin, y);

      y += 6;
    }

    const status = item.status === "ok"
      ? "Conforme"
      : item.status === "issue"
        ? "Avaria"
        : "Não verificado";

    addParagraph(`${item.label || "Item"}: ${status}`, {
      bold: true,
      spacing: 1
    });

    if (item.notes) {
      addParagraph(`Observação: ${item.notes}`, {
        indent: 3,
        fontSize: 8,
        spacing: 2
      });
    }

    if (item.photo) {
      const dimensions = await imageDimensions(item.photo);
      const maxWidth = contentWidth - 6;
      const maxHeight = 65;

      const ratio = Math.min(
        maxWidth / dimensions.width,
        maxHeight / dimensions.height
      );

      const imageWidth = dimensions.width * ratio;
      const imageHeight = dimensions.height * ratio;

      addPageIfNeeded(imageHeight + 12);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(90, 100, 110);
      doc.text("Foto anexada ao item:", margin + 3, y);

      y += 3;

      doc.addImage(
        item.photo,
        "JPEG",
        margin + 3,
        y,
        imageWidth,
        imageHeight,
        undefined,
        "FAST"
      );

      y += imageHeight + 5;
    }

    y += 2;
  }

  // Observações gerais
  if (inspection.generalNotes) {
    addSectionTitle("OBSERVAÇÕES GERAIS");
    addParagraph(inspection.generalNotes, {
      fontSize: 9,
      lineHeight: 5
    });
  }

  // Rodapé e numeração das páginas
  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setDrawColor(210, 215, 220);
    doc.line(
      margin,
      pageHeight - 12,
      pageWidth - margin,
      pageHeight - 12
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 125, 130);

    doc.text(
      "Documento gerado pelo VistoriaFrotas",
      margin,
      pageHeight - 7
    );

    doc.text(
      `Página ${page} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: "right" }
    );
  }

  return doc;
}

function getFilename(inspection) {
  const plate = safeFilename(inspection.vehiclePlate);
  const date = new Date(inspection.date).toISOString().slice(0, 10);

  return `vistoria_${plate}_${date}.pdf`;
}

export async function downloadInspectionPDF(inspection) {
  const doc = await createInspectionPDF(inspection);
  doc.save(getFilename(inspection));
}

export async function shareInspectionPDF(inspection) {
  const doc = await createInspectionPDF(inspection);
  const blob = doc.output("blob");
  const filename = getFilename(inspection);

  const file = new File([blob], filename, {
    type: "application/pdf"
  });

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: "Relatório de vistoria",
      text: `Relatório da vistoria do veículo ${inspection.vehicleModel} ${inspection.vehiclePlate || ""}.`
    });

    return "shared";
  }

  // Alternativa para navegadores sem compartilhamento de arquivos.
  doc.save(filename);

  const message = encodeURIComponent(
    `Segue o relatório da vistoria do veículo ${inspection.vehicleModel} ${inspection.vehiclePlate || ""}.`
  );

  window.open(`https://wa.me/?text=${message}`, "_blank");

  return "downloaded";
}
