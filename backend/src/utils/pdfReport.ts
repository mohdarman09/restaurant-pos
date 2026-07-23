import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface PdfTableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

interface PdfReportOptions {
  title: string;
  subtitle?: string;
  restaurantName: string;
  columns: PdfTableColumn[];
  rows: Record<string, unknown>[];
  summaryLines?: { label: string; value: string }[];
}

const BRAND_INK = '#221D16';
const BRAND_MUTED = '#5C5346';
const BRAND_GREEN = '#1F4B3F';
const BRAND_AMBER = '#D9A441';

/** Streams a simple branded PDF report (title, summary lines, and a data table) directly to the response. */
export function streamPdfReport(res: Response, filename: string, options: PdfReportOptions): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header band
  doc.rect(0, 0, doc.page.width, 70).fill(BRAND_GREEN);
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(options.restaurantName, 40, 22);
  doc.fillColor(BRAND_AMBER).fontSize(10).font('Helvetica').text('Restaurant POS — Report', 40, 44);
  doc.fillColor(BRAND_INK);

  doc.moveDown(3);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_INK).text(options.title, 40, 90);
  if (options.subtitle) {
    doc.fontSize(10).font('Helvetica').fillColor(BRAND_MUTED).text(options.subtitle, 40, 112);
  }

  let cursorY = options.subtitle ? 135 : 120;

  if (options.summaryLines?.length) {
    doc.fontSize(11).font('Helvetica');
    for (const line of options.summaryLines) {
      doc.fillColor(BRAND_MUTED).text(line.label, 40, cursorY, { continued: true, width: 200 });
      doc.fillColor(BRAND_INK).font('Helvetica-Bold').text(`  ${line.value}`, { continued: false });
      doc.font('Helvetica');
      cursorY += 18;
    }
    cursorY += 12;
  }

  // Table header
  const tableX = 40;
  const tableWidth = doc.page.width - 80;
  const colWidths = options.columns.map((c) => c.width ?? tableWidth / options.columns.length);

  doc.rect(tableX, cursorY, tableWidth, 22).fill('#F6F1E6');
  doc.fillColor(BRAND_INK).font('Helvetica-Bold').fontSize(9);
  let colX = tableX;
  options.columns.forEach((col, i) => {
    doc.text(col.header.toUpperCase(), colX + 6, cursorY + 7, { width: colWidths[i] - 12, align: col.align ?? 'left' });
    colX += colWidths[i];
  });
  cursorY += 22;

  doc.font('Helvetica').fontSize(9.5);
  for (const row of options.rows) {
    if (cursorY > doc.page.height - 60) {
      doc.addPage();
      cursorY = 40;
    }
    colX = tableX;
    options.columns.forEach((col, i) => {
      const value = row[col.key];
      doc.fillColor(BRAND_INK).text(value === null || value === undefined ? '—' : String(value), colX + 6, cursorY + 6, {
        width: colWidths[i] - 12,
        align: col.align ?? 'left',
      });
      colX += colWidths[i];
    });
    doc.moveTo(tableX, cursorY + 22).lineTo(tableX + tableWidth, cursorY + 22).strokeColor('#22201915').stroke();
    cursorY += 24;
  }

  if (options.rows.length === 0) {
    doc.fillColor(BRAND_MUTED).text('No data available for this period.', tableX, cursorY + 10);
  }

  doc.fontSize(8).fillColor(BRAND_MUTED).text(
    `Generated ${new Date().toLocaleString('en-IN')}`,
    40,
    doc.page.height - 40,
    { align: 'left' }
  );

  doc.end();
}
