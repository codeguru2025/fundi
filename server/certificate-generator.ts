import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { logger } from "./index";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const FOUNDER_NAME = "Augustus Siziba";
const FOUNDER_TITLE = "Founder & Director of Education";

interface CertificateData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  completionDate: string;
  verificationToken: string;
  certificateId: string;
  verifyUrl: string;
  courseLevel?: string;
}

function drawCenteredText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const width = font.widthOfTextAtSize(text, size);
  const pageWidth = page.getWidth();
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y,
    size,
    font,
    color,
  });
}

let cachedSignatureBytes: Buffer | null = null;

function getSignatureBytes(): Buffer {
  if (cachedSignatureBytes) return cachedSignatureBytes;
  const sigPath = path.join(process.cwd(), "server/assets/signature-clean.png");
  cachedSignatureBytes = fs.readFileSync(sigPath);
  return cachedSignatureBytes;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);

  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const navyDark = rgb(0.08, 0.12, 0.25);
  const navy = rgb(0.11, 0.16, 0.32);
  const gold = rgb(0.72, 0.53, 0.04);
  const darkGold = rgb(0.55, 0.38, 0.0);
  const lightGold = rgb(0.85, 0.75, 0.5);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const medGray = rgb(0.45, 0.45, 0.45);
  const cream = rgb(0.98, 0.96, 0.92);
  const white = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: cream });

  page.drawRectangle({
    x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: navyDark,
  });
  page.drawRectangle({
    x: 0, y: pageHeight - 12, width: pageWidth, height: 4, color: gold,
  });
  page.drawRectangle({
    x: 0, y: 0, width: pageWidth, height: 8, color: navyDark,
  });
  page.drawRectangle({
    x: 0, y: 8, width: pageWidth, height: 4, color: gold,
  });

  const borderInset = 22;
  page.drawRectangle({
    x: borderInset, y: borderInset,
    width: pageWidth - 2 * borderInset, height: pageHeight - 2 * borderInset,
    borderColor: gold, borderWidth: 2.5, color: undefined,
  });
  page.drawRectangle({
    x: borderInset + 6, y: borderInset + 6,
    width: pageWidth - 2 * (borderInset + 6), height: pageHeight - 2 * (borderInset + 6),
    borderColor: lightGold, borderWidth: 0.5, color: undefined,
  });

  const cornerSize = 35;
  const corners = [
    { x: borderInset + 12, y: pageHeight - borderInset - 12 - cornerSize },
    { x: pageWidth - borderInset - 12 - cornerSize, y: pageHeight - borderInset - 12 - cornerSize },
    { x: borderInset + 12, y: borderInset + 12 },
    { x: pageWidth - borderInset - 12 - cornerSize, y: borderInset + 12 },
  ];
  for (const c of corners) {
    page.drawLine({ start: { x: c.x, y: c.y + cornerSize }, end: { x: c.x + cornerSize / 3, y: c.y + cornerSize }, thickness: 1, color: gold });
    page.drawLine({ start: { x: c.x, y: c.y + cornerSize }, end: { x: c.x, y: c.y + cornerSize * 2 / 3 }, thickness: 1, color: gold });
    page.drawLine({ start: { x: c.x + cornerSize, y: c.y }, end: { x: c.x + cornerSize * 2 / 3, y: c.y }, thickness: 1, color: gold });
    page.drawLine({ start: { x: c.x + cornerSize, y: c.y }, end: { x: c.x + cornerSize, y: c.y + cornerSize / 3 }, thickness: 1, color: gold });
  }

  const watermarkText = "FUNDI";
  const watermarkSize = 72;
  const watermarkWidth = timesRomanItalic.widthOfTextAtSize(watermarkText, watermarkSize);
  page.drawText(watermarkText, {
    x: (pageWidth - watermarkWidth) / 2,
    y: pageHeight / 2 - 20,
    size: watermarkSize,
    font: timesRomanItalic,
    color: rgb(0.92, 0.88, 0.8),
    opacity: 0.1,
  });

  let y = pageHeight - 60;

  const logoRadius = 22;
  page.drawCircle({
    x: pageWidth / 2,
    y: y - logoRadius + 8,
    size: logoRadius,
    color: navyDark,
    borderColor: gold,
    borderWidth: 1.5,
  });
  const lwText = "LW";
  const lwWidth = helveticaBold.widthOfTextAtSize(lwText, 18);
  page.drawText(lwText, {
    x: pageWidth / 2 - lwWidth / 2,
    y: y - logoRadius + 2,
    size: 18,
    font: helveticaBold,
    color: gold,
  });
  y -= logoRadius * 2 + 5;

  drawCenteredText(page, "FUNDI ACADEMY", y, helveticaBold, 16, navy);
  y -= 16;
  drawCenteredText(page, "Excellence in Education", y, timesRomanItalic, 9, darkGold);
  y -= 6;

  page.drawLine({
    start: { x: pageWidth / 2 - 120, y: y - 3 },
    end: { x: pageWidth / 2 + 120, y: y - 3 },
    thickness: 1.5, color: gold,
  });
  page.drawLine({
    start: { x: pageWidth / 2 - 80, y: y - 7 },
    end: { x: pageWidth / 2 + 80, y: y - 7 },
    thickness: 0.5, color: lightGold,
  });
  y -= 22;

  const certType = data.courseLevel
    ? data.courseLevel.toUpperCase()
    : "CERTIFICATE OF COMPLETION";

  drawCenteredText(page, certType, y, timesRomanBold, 26, navy);
  y -= 25;

  page.drawLine({
    start: { x: pageWidth / 2 - 50, y },
    end: { x: pageWidth / 2 + 50, y },
    thickness: 0.5, color: gold,
  });
  y -= 22;

  drawCenteredText(page, "This is to certify that", y, timesRomanItalic, 12, medGray);
  y -= 38;

  drawCenteredText(page, data.studentName, y, timesRomanBold, 30, navy);
  y -= 18;

  const nameLineWidth = Math.max(280, timesRomanBold.widthOfTextAtSize(data.studentName, 30) + 40);
  page.drawLine({
    start: { x: (pageWidth - nameLineWidth) / 2, y },
    end: { x: (pageWidth + nameLineWidth) / 2, y },
    thickness: 1.5, color: gold,
  });
  y -= 22;

  drawCenteredText(page, "has successfully completed the course", y, timesRomanItalic, 12, medGray);
  y -= 38;

  drawCenteredText(page, data.courseTitle, y, timesRomanBold, 22, navy);
  y -= 8;

  const titleLineWidth = Math.max(200, timesRomanBold.widthOfTextAtSize(data.courseTitle, 22) + 30);
  page.drawLine({
    start: { x: (pageWidth - titleLineWidth) / 2, y },
    end: { x: (pageWidth + titleLineWidth) / 2, y },
    thickness: 1.0, color: lightGold,
  });
  y -= 22;

  drawCenteredText(page, `Instructor: ${data.instructorName}`, y, timesRomanItalic, 11, medGray);
  y -= 10;

  const footerY = y;
  const leftCol = 75;
  const rightCol = pageWidth - 75;
  const centerCol = pageWidth / 2;

  page.drawText("DATE ISSUED", { x: leftCol, y: footerY + 22, size: 7, font: helveticaBold, color: darkGold });
  page.drawText(data.completionDate, { x: leftCol, y: footerY + 6, size: 11, font: timesRoman, color: darkGray });
  page.drawLine({
    start: { x: leftCol, y: footerY },
    end: { x: leftCol + 130, y: footerY },
    thickness: 0.5, color: gold,
  });

  // Signature block: position below footer baseline
  const sigBlockTop = footerY - 8;

  try {
    const sigBytes = getSignatureBytes();
    const sigImage = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImage.scale(1);
    const sigDisplayWidth = 90;
    const sigDisplayHeight = (sigDims.height / sigDims.width) * sigDisplayWidth;

    page.drawImage(sigImage, {
      x: centerCol - sigDisplayWidth / 2,
      y: sigBlockTop - sigDisplayHeight,
      width: sigDisplayWidth,
      height: sigDisplayHeight,
    });
  } catch (err) {
    logger.error({ err }, "Signature embed error");
  }

  const founderNameY = sigBlockTop - 65;
  const founderNameWidth = timesRomanBold.widthOfTextAtSize(FOUNDER_NAME, 12);
  page.drawText(FOUNDER_NAME, {
    x: centerCol - founderNameWidth / 2,
    y: founderNameY,
    size: 12,
    font: timesRomanBold,
    color: navy,
  });

  page.drawLine({
    start: { x: centerCol - 85, y: founderNameY - 4 },
    end: { x: centerCol + 85, y: founderNameY - 4 },
    thickness: 0.5, color: gold,
  });

  const titleWidth = helvetica.widthOfTextAtSize(FOUNDER_TITLE, 8);
  page.drawText(FOUNDER_TITLE, {
    x: centerCol - titleWidth / 2,
    y: founderNameY - 16,
    size: 8,
    font: helvetica,
    color: medGray,
  });

  page.drawText("CERTIFICATE ID", {
    x: rightCol - 130,
    y: footerY + 22,
    size: 7,
    font: helveticaBold,
    color: darkGold,
  });
  page.drawText(data.verificationToken, {
    x: rightCol - 130,
    y: footerY + 6,
    size: 10,
    font: courier,
    color: darkGray,
  });
  page.drawLine({
    start: { x: rightCol - 130, y: footerY },
    end: { x: rightCol, y: footerY },
    thickness: 0.5, color: gold,
  });

  try {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#1c2852", light: "#faf5eb" },
    });
    const qrBase64 = qrDataUrl.split(",")[1];
    const qrImageBytes = Buffer.from(qrBase64, "base64");
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    const qrSize = 65;
    const qrX = rightCol - qrSize + 5;
    const qrY = footerY - 75;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    const scanLabel = "Scan to Verify";
    const scanWidth = helvetica.widthOfTextAtSize(scanLabel, 7);
    page.drawText(scanLabel, {
      x: qrX + (qrSize - scanWidth) / 2,
      y: qrY - 10,
      size: 7,
      font: helvetica,
      color: medGray,
    });
  } catch (err) {
    logger.error({ err }, "QR generation error");
  }

  const bottomY = borderInset + 18;
  const verifyLabel = `Verify at: ${data.verifyUrl}`;
  const verifyWidth = helvetica.widthOfTextAtSize(verifyLabel, 7);
  page.drawText(verifyLabel, {
    x: (pageWidth - verifyWidth) / 2,
    y: bottomY,
    size: 7,
    font: helvetica,
    color: medGray,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
