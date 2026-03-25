import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import archiver from "archiver";
import { storage } from "./storage";
import { generateObjectKey, getUploadSignedUrl, getPublicUrl } from "./spaces";
import { logger } from "./index";

const CONVERSION_DIR = path.join(process.cwd(), "conversions");
const activeConversions = new Set<string>();

if (!fs.existsSync(CONVERSION_DIR)) {
  fs.mkdirSync(CONVERSION_DIR, { recursive: true });
}

async function downloadFromObjectStorage(objectPath: string, destPath: string): Promise<void> {
  const response = await fetch(objectPath);
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function uploadToObjectStorage(filePath: string, contentType: string): Promise<string> {
  const originalName = path.basename(filePath);
  const key = generateObjectKey(originalName);
  const uploadURL = await getUploadSignedUrl(key, contentType);

  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;

  const response = await fetch(uploadURL, {
    method: "PUT",
    body: fileBuffer,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "x-amz-acl": "public-read",
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return getPublicUrl(key);
}

export async function uploadFileDataToStorage(base64Data: string, contentType: string): Promise<string> {
  const ext = contentType.split("/")[1] || "bin";
  const key = generateObjectKey(`legacy.${ext}`);
  const uploadURL = await getUploadSignedUrl(key, contentType);

  const buffer = Buffer.from(base64Data, "base64");

  const response = await fetch(uploadURL, {
    method: "PUT",
    body: buffer,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "x-amz-acl": "public-read",
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return getPublicUrl(key);
}

// ── EPUB builder (pure Node.js — no external binaries) ──────────────────────

const EPUB_CSS = `
body { font-family: Georgia, serif; line-height: 1.6; margin: 1em; }
h1 { font-size: 1.6em; text-align: center; margin: 2em 0 1em; page-break-before: always; }
h2 { font-size: 1.3em; margin: 1.5em 0 0.8em; page-break-before: always; }
h3 { font-size: 1.1em; margin: 1.2em 0 0.6em; }
p { margin: 0.5em 0; text-indent: 1.5em; }
img { max-width: 100%; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
td, th { border: 1px solid #ccc; padding: 0.4em; }
`;

interface EpubChapter {
  id: string;
  title: string;
  html: string;
}

function splitIntoChapters(html: string, bookTitle: string): EpubChapter[] {
  // Split on <h1> or <h2> tags to create chapters
  const headingRegex = /<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const splits: { index: number; title: string }[] = [];

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    if (title) splits.push({ index: match.index, title });
  }

  if (splits.length === 0) {
    // No headings found — treat entire content as one chapter
    return [{ id: "chapter-1", title: bookTitle, html }];
  }

  const chapters: EpubChapter[] = [];
  // Content before first heading
  if (splits[0].index > 0) {
    const preContent = html.slice(0, splits[0].index).trim();
    if (preContent.length > 50) {
      chapters.push({ id: "chapter-0", title: "Preface", html: preContent });
    }
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index;
    const end = i + 1 < splits.length ? splits[i + 1].index : html.length;
    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: splits[i].title,
      html: html.slice(start, end).trim(),
    });
  }

  return chapters;
}

function buildXhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildContentOpf(bookId: string, title: string, author: string, chapters: EpubChapter[]): string {
  const items = chapters.map(ch => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n");
  const refs = chapters.map(ch => `    <itemref idref="${ch.id}"/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${items}
  </manifest>
  <spine>
${refs}
  </spine>
</package>`;
}

function buildNavXhtml(title: string, chapters: EpubChapter[]): string {
  const lis = chapters.map(ch => `      <li><a href="${ch.id}.xhtml">${escapeXml(ch.title)}</a></li>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escapeXml(title)}</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${lis}
    </ol>
  </nav>
</body>
</html>`;
}

async function buildEpubFile(outputPath: string, bookId: string, title: string, author: string, chapters: EpubChapter[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // mimetype must be first entry, uncompressed
    archive.append("application/epub+zip", { name: "mimetype", store: true });

    // META-INF/container.xml
    archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`, { name: "META-INF/container.xml" });

    // OEBPS/content.opf
    archive.append(buildContentOpf(bookId, title, author, chapters), { name: "OEBPS/content.opf" });

    // OEBPS/nav.xhtml
    archive.append(buildNavXhtml(title, chapters), { name: "OEBPS/nav.xhtml" });

    // OEBPS/style.css
    archive.append(EPUB_CSS, { name: "OEBPS/style.css" });

    // OEBPS/chapter-N.xhtml
    for (const ch of chapters) {
      archive.append(buildXhtml(ch.title, ch.html), { name: `OEBPS/${ch.id}.xhtml` });
    }

    archive.finalize();
  });
}

// ── Convert DOCX/HTML/TXT to HTML ──────────────────────────────────────────

async function convertToHtml(inputPath: string, format: string): Promise<string> {
  if (format === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.convertToHtml({ path: inputPath });
    if (result.messages.length > 0) {
      logger.info(`Mammoth messages: ${result.messages.map(m => m.message).join("; ").slice(0, 300)}`);
    }
    return result.value;
  }

  if (format === "text/html") {
    return fs.readFileSync(inputPath, "utf-8");
  }

  if (format === "text/plain") {
    const text = fs.readFileSync(inputPath, "utf-8");
    return text
      .split(/\n{2,}/)
      .map(para => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
      .join("\n");
  }

  throw new Error(`Unsupported format for conversion: ${format}`);
}

// ── Main conversion logic ───────────────────────────────────────────────────

const SUPPORTED_FORMATS = new Set([
  "application/epub+zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/html",
  "text/plain",
]);

export async function convertToEpub(bookId: string): Promise<void> {
  if (activeConversions.has(bookId)) {
    logger.info(`Conversion: Book ${bookId} is already being converted, skipping duplicate request`);
    return;
  }

  activeConversions.add(bookId);

  try {
    await doConvertToEpub(bookId);
  } finally {
    activeConversions.delete(bookId);
  }
}

async function doConvertToEpub(bookId: string): Promise<void> {
  const book = await storage.getBook(bookId);
  if (!book) {
    logger.error(`Conversion: Book ${bookId} not found`);
    return;
  }

  if (!book.originalFileUrl) {
    logger.error(`Conversion: Book ${bookId} has no original file URL`);
    await storage.updateBook(bookId, { conversionStatus: "failed" });
    return;
  }

  if (book.originalFormat === "application/epub+zip") {
    await storage.updateBook(bookId, {
      epubFileUrl: book.originalFileUrl,
      conversionStatus: "completed",
    });
    logger.info(`Conversion: Book ${bookId} is already EPUB, skipping conversion`);
    return;
  }

  if (!SUPPORTED_FORMATS.has(book.originalFormat || "")) {
    logger.error(`Conversion: Unsupported format "${book.originalFormat}" for book ${bookId}`);
    await storage.updateBook(bookId, { conversionStatus: "failed" });
    return;
  }

  await storage.updateBook(bookId, { conversionStatus: "processing" });

  const extMap: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/html": ".html",
    "text/plain": ".txt",
  };
  const inputExt = extMap[book.originalFormat || ""] || ".bin";
  const inputPath = path.join(CONVERSION_DIR, `${bookId}${inputExt}`);
  const outputPath = path.join(CONVERSION_DIR, `${bookId}.epub`);

  const cleanup = () => {
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  };

  try {
    logger.info(`Conversion: Downloading original file for book ${bookId}...`);
    await downloadFromObjectStorage(book.originalFileUrl, inputPath);

    logger.info(`Conversion: Converting ${inputExt} to EPUB for book ${bookId} (mammoth/archiver)...`);
    const html = await convertToHtml(inputPath, book.originalFormat || "");
    const chapters = splitIntoChapters(html, book.title);

    logger.info(`Conversion: Building EPUB with ${chapters.length} chapter(s) for book ${bookId}...`);
    await buildEpubFile(outputPath, bookId, book.title, book.author, chapters);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Conversion produced no output file");
    }

    const epubSize = fs.statSync(outputPath).size;
    if (epubSize < 100) {
      throw new Error("Conversion produced an empty or invalid EPUB");
    }

    logger.info(`Conversion: Uploading EPUB for book ${bookId} (${(epubSize / 1024).toFixed(1)} KB)...`);
    const epubObjectPath = await uploadToObjectStorage(outputPath, "application/epub+zip");

    await storage.updateBook(bookId, {
      epubFileUrl: epubObjectPath,
      conversionStatus: "completed",
    });

    logger.info(`Conversion: Book ${bookId} conversion completed successfully`);
  } catch (error: unknown) {
    logger.error({ err: error }, `Conversion: Failed for book ${bookId}`);
    await storage.updateBook(bookId, {
      conversionStatus: "failed",
    });
  } finally {
    cleanup();
  }
}

export function triggerConversion(bookId: string): void {
  setImmediate(() => {
    convertToEpub(bookId).catch(err => {
      logger.error({ err }, `Background conversion error for book ${bookId}`);
    });
  });
}
