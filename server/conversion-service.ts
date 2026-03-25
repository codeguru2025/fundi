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
body { font-family: Georgia, serif; line-height: 1.7; margin: 1em 1.2em; color: #1a1a1a; }
h1 { font-size: 1.6em; text-align: center; margin: 2em 0 1em; page-break-before: always; font-weight: bold; }
h2 { font-size: 1.35em; margin: 1.5em 0 0.8em; page-break-before: always; font-weight: bold; }
h3 { font-size: 1.15em; margin: 1.2em 0 0.6em; font-weight: bold; }
h4 { font-size: 1.05em; margin: 1em 0 0.5em; font-weight: bold; }
p { margin: 0.6em 0; text-indent: 1.5em; text-align: justify; }
p.no-indent { text-indent: 0; }
blockquote { margin: 1em 2em; padding-left: 1em; border-left: 3px solid #ccc; font-style: italic; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
figure { margin: 1.5em 0; text-align: center; page-break-inside: avoid; }
figure img { margin: 0 auto; }
figcaption { font-size: 0.85em; color: #555; margin-top: 0.5em; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; page-break-inside: avoid; }
td, th { border: 1px solid #ccc; padding: 0.5em; text-align: left; }
th { font-weight: bold; background: #f5f5f5; }
ul, ol { margin: 0.8em 0; padding-left: 2em; }
li { margin: 0.3em 0; }
.text-center { text-align: center; text-indent: 0; }
.text-right { text-align: right; text-indent: 0; }
strong, b { font-weight: bold; }
em, i { font-style: italic; }
sup { vertical-align: super; font-size: 0.75em; }
sub { vertical-align: sub; font-size: 0.75em; }
hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
`;

interface EpubImage {
  id: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
}

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

function buildContentOpf(bookId: string, title: string, author: string, chapters: EpubChapter[], images: EpubImage[]): string {
  const chapterItems = chapters.map(ch => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n");
  const imageItems = images.map(img => `    <item id="${img.id}" href="images/${img.filename}" media-type="${img.contentType}"/>`).join("\n");
  const items = chapterItems + (imageItems ? "\n" + imageItems : "");
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

async function buildEpubFile(outputPath: string, bookId: string, title: string, author: string, chapters: EpubChapter[], images: EpubImage[]): Promise<void> {
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
    archive.append(buildContentOpf(bookId, title, author, chapters, images), { name: "OEBPS/content.opf" });

    // OEBPS/nav.xhtml
    archive.append(buildNavXhtml(title, chapters), { name: "OEBPS/nav.xhtml" });

    // OEBPS/style.css
    archive.append(EPUB_CSS, { name: "OEBPS/style.css" });

    // OEBPS/chapter-N.xhtml
    for (const ch of chapters) {
      archive.append(buildXhtml(ch.title, ch.html), { name: `OEBPS/${ch.id}.xhtml` });
    }

    // OEBPS/images/*
    for (const img of images) {
      archive.append(img.buffer, { name: `OEBPS/images/${img.filename}` });
    }

    archive.finalize();
  });
}

// ── Convert DOCX/HTML/TXT to HTML ──────────────────────────────────────────

interface ConversionResult {
  html: string;
  images: EpubImage[];
}

function getImageExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
    "image/svg+xml": "svg", "image/bmp": "bmp", "image/tiff": "tiff",
    "image/webp": "webp",
  };
  return map[contentType] || "png";
}

async function convertToHtml(inputPath: string, format: string): Promise<ConversionResult> {
  if (format === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const images: EpubImage[] = [];
    let imageCounter = 0;

    const result = await mammoth.convertToHtml(
      { path: inputPath },
      {
        styleMap: [
          "p[style-name='Title'] => h1.doc-title:fresh",
          "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Quote'] => blockquote > p:fresh",
          "p[style-name='Block Text'] => blockquote > p:fresh",
          "p[style-name='List Paragraph'] => li:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
        ],
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.read();
          const ext = getImageExtension(image.contentType);
          imageCounter++;
          const filename = `image-${imageCounter}.${ext}`;
          const id = `img-${imageCounter}`;

          images.push({
            id,
            filename,
            contentType: image.contentType,
            buffer: Buffer.from(imageBuffer),
          });

          return { src: `images/${filename}` };
        }),
      }
    );

    if (result.messages.length > 0) {
      logger.info(`Mammoth messages: ${result.messages.map(m => m.message).join("; ").slice(0, 300)}`);
    }

    return { html: result.value, images };
  }

  if (format === "text/html") {
    return { html: fs.readFileSync(inputPath, "utf-8"), images: [] };
  }

  if (format === "text/plain") {
    const text = fs.readFileSync(inputPath, "utf-8");
    const html = text
      .split(/\n{2,}/)
      .map(para => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
      .join("\n");
    return { html, images: [] };
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
    const { html, images } = await convertToHtml(inputPath, book.originalFormat || "");
    const chapters = splitIntoChapters(html, book.title);

    logger.info(`Conversion: Building EPUB with ${chapters.length} chapter(s) and ${images.length} image(s) for book ${bookId}...`);
    await buildEpubFile(outputPath, bookId, book.title, book.author, chapters, images);

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
