import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type ReportSection = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

const formatDate = () => new Date().toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });

export function downloadExcel(fileName: string, sections: ReportSection[]) {
  const wb = XLSX.utils.book_new();

  for (const section of sections) {
    const sheetData = [section.headers, ...section.rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-width columns
    ws["!cols"] = section.headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...section.rows.map((r) => String(r[i] ?? "").length));
      return { wch: Math.min(maxLen + 2, 40) };
    });

    const sheetName = section.title.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, `${fileName}_${formatDate()}.xlsx`);
}

export function downloadPDF(fileName: string, title: string, sections: ReportSection[]) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(48, 69, 91); // CHARCOAL
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${formatDate()}`, 14, 28);
  doc.text("Seven Arena", doc.internal.pageSize.width - 14, 28, { align: "right" });

  let startY = 36;

  for (const section of sections) {
    if (startY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(48, 69, 91);
    doc.text(section.title, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [section.headers],
      body: section.rows.map((row) => row.map((cell) => String(cell))),
      theme: "grid",
      headStyles: {
        fillColor: [33, 208, 179], // TEAL
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable?.finalY + 12 || startY + 30;
  }

  doc.save(`${fileName}_${formatDate()}.pdf`);
}
