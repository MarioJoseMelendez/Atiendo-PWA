import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { unitPhrase } from "./inventory";
import type { LabelSheet } from "./labels";
import { formatQ } from "./money";
import { encodeQr } from "./qr";
import type { Product } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const GAP = 12;
const COLUMNS = 3;
const ROWS = 4;
const HEADER_HEIGHT = 54;
const CARD_WIDTH = (PAGE_WIDTH - MARGIN * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const CARD_HEIGHT = (PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - GAP * (ROWS - 1)) / ROWS;
const QR_SIZE = 92;

const INK = rgb(0.11, 0.09, 0.08);
const MUTED = rgb(0.39, 0.36, 0.32);
const LINE = rgb(0.8, 0.72, 0.57);

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) return [""];

  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}...`;
  }

  return lines;
}

function centered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  centerX: number,
  y: number,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

function drawHeader(page: PDFPage, sheet: LabelSheet, bold: PDFFont, regular: PDFFont, pageNumber: number) {
  page.drawText("Atiendo", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 16,
    size: 16,
    font: bold,
    color: INK,
  });
  page.drawText(sheet.title, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 32,
    size: 9,
    font: regular,
    color: MUTED,
  });
  const subtitleWidth = regular.widthOfTextAtSize(sheet.subtitle, 8);
  page.drawText(sheet.subtitle, {
    x: PAGE_WIDTH - MARGIN - subtitleWidth,
    y: PAGE_HEIGHT - MARGIN - 16,
    size: 8,
    font: regular,
    color: MUTED,
  });
  page.drawText(`Página ${pageNumber}`, {
    x: MARGIN,
    y: 18,
    size: 7,
    font: regular,
    color: MUTED,
  });
}

async function drawLabel(
  page: PDFPage,
  pdf: PDFDocument,
  product: Product,
  groupName: string,
  x: number,
  top: number,
  bold: PDFFont,
  regular: PDFFont,
) {
  const bottom = top - CARD_HEIGHT;
  page.drawRectangle({
    x,
    y: bottom,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 0.7,
  });

  const qr = await QRCode.toBuffer(encodeQr(product.code), {
    type: "png",
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1915", light: "#ffffff" },
  });
  const image = await pdf.embedPng(qr);
  const centerX = x + CARD_WIDTH / 2;
  page.drawImage(image, {
    x: centerX - QR_SIZE / 2,
    y: top - 10 - QR_SIZE,
    width: QR_SIZE,
    height: QR_SIZE,
  });

  let cursor = top - 10 - QR_SIZE - 12;
  centered(page, groupName.toUpperCase(), regular, 6.5, MUTED, centerX, cursor);

  cursor -= 12;
  const nameLines = wrapText(product.name, bold, 9.5, CARD_WIDTH - 16, 2);
  for (const line of nameLines) {
    centered(page, line, bold, 9.5, INK, centerX, cursor);
    cursor -= 11;
  }

  cursor -= 1;
  centered(
    page,
    `${unitPhrase(product)} · ${formatQ(product.priceCents)}`,
    regular,
    7.5,
    MUTED,
    centerX,
    cursor,
  );
  cursor -= 10;
  centered(page, product.code, regular, 7, MUTED, centerX, cursor);
}

export async function buildLabelPdf(sheet: LabelSheet): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;
  drawHeader(page, sheet, bold, regular, pageNumber);

  let slot = 0;
  for (const section of sheet.sections) {
    for (const product of section.products) {
      if (slot === COLUMNS * ROWS) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageNumber += 1;
        drawHeader(page, sheet, bold, regular, pageNumber);
        slot = 0;
      }
      const row = Math.floor(slot / COLUMNS);
      const column = slot % COLUMNS;
      const x = MARGIN + column * (CARD_WIDTH + GAP);
      const top = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT - row * (CARD_HEIGHT + GAP);
      await drawLabel(page, pdf, product, section.groupName, x, top, bold, regular);
      slot += 1;
    }
  }

  return pdf.save();
}

const DOCX_BORDER = {
  style: BorderStyle.DOTTED,
  size: 4,
  color: "CBB892",
};

function labelCell(product: Product, groupName: string, png: Buffer): TableCell {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    margins: { top: 120, bottom: 120, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: DOCX_BORDER,
      bottom: DOCX_BORDER,
      left: DOCX_BORDER,
      right: DOCX_BORDER,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: png,
            transformation: { width: 110, height: 110 },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({ text: groupName.toUpperCase(), size: 13, color: "645C52" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: product.name, bold: true, size: 20 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20 },
        children: [
          new TextRun({
            text: `${unitPhrase(product)} · ${formatQ(product.priceCents)}`,
            size: 15,
            color: "645C52",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20 },
        children: [
          new TextRun({ text: product.code, size: 13, color: "645C52", font: "Courier New" }),
        ],
      }),
    ],
  });
}

function emptyCell(): TableCell {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: {
      top: DOCX_BORDER,
      bottom: DOCX_BORDER,
      left: DOCX_BORDER,
      right: DOCX_BORDER,
    },
    children: [new Paragraph("")],
  });
}

export async function buildLabelDocx(sheet: LabelSheet): Promise<Buffer> {
  const rows: TableRow[] = [];
  const entries = sheet.sections.flatMap((section) =>
    section.products.map((product) => ({ product, groupName: section.groupName })),
  );

  for (let index = 0; index < entries.length; index += 3) {
    const group = entries.slice(index, index + 3);
    const cells: TableCell[] = [];
    for (const entry of group) {
      const png = await QRCode.toBuffer(encodeQr(entry.product.code), {
        type: "png",
        margin: 1,
        width: 512,
        errorCorrectionLevel: "M",
        color: { dark: "#1c1915", light: "#ffffff" },
      });
      cells.push(labelCell(entry.product, entry.groupName, png));
    }
    while (cells.length < 3) cells.push(emptyCell());
    rows.push(new TableRow({ children: cells, cantSplit: true }));
  }

  const table = new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.27),
              height: convertInchesToTwip(11.69),
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Atiendo", bold: true, size: 32 })],
          }),
          new Paragraph({
            spacing: { before: 40 },
            children: [new TextRun({ text: sheet.title, size: 22 })],
          }),
          new Paragraph({
            spacing: { before: 40, after: 220 },
            children: [new TextRun({ text: sheet.subtitle, size: 16, color: "645C52" })],
          }),
          table,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
