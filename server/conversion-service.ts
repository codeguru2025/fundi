import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { generateObjectKey, getUploadSignedUrl, getPublicUrl } from "./spaces";
import { logger } from "./index";

const execFileAsync = promisify(execFile);
const CONVERSION_DIR = path.join(process.cwd(), "conversions");
const activeConversions = new Set<string>();

if (!fs.existsSync(CONVERSION_DIR)) {
  fs.mkdirSync(CONVERSION_DIR, { recursive: true });
}

async function downloadFromObjectStorage(objectPath: string, destPath: string): Promise<void> {
  // objectPath is a CDN URL — download the file directly
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

function getInputExtension(format: string): string {
  const formatMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/html": ".html",
    "text/plain": ".txt",
    "application/epub+zip": ".epub",
  };
  return formatMap[format] || ".pdf";
}

const HEADING_PATTERNS = [
  /^(chapter\s+\d+[.:)—\-\s]*.*)/i,
  /^(chapter\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[.:)—\-\s]*.*)/i,
  /^(part\s+\d+[.:)—\-\s]*.*)/i,
  /^(part\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[.:)—\-\s]*.*)/i,
  /^(prologue|epilogue|introduction|preface|foreword|afterword|acknowledgments|appendix|conclusion)/i,
  /^(section\s+\d+[.:)—\-\s]*.*)/i,
  /^([IVXLCDM]+\.\s+.{3,})/,
];

function postProcessEpubHtml(html: string): string {
  let result = html;

  result = result.replace(
    /<p\b([^>]*)>\s*(?:<a\s+id="[^"]*"><\/a>\s*)?<b\b[^>]*>(.*?)<\/b>\s*([\s\S]*?)<\/p>/gi,
    (match, pAttrs, boldText, trailing) => {
      const trimmedBold = boldText.trim();
      const isHeading = HEADING_PATTERNS.some(p => p.test(trimmedBold));
      const isShortBoldOnly = trimmedBold.length < 100 && trimmedBold.length > 1;

      if (isHeading || (isShortBoldOnly && !trailing.trim())) {
        const tag = /^(part\s)/i.test(trimmedBold) ? "h1" : "h2";
        const anchorMatch = match.match(/<a\s+id="([^"]*)"><\/a>/);
        const anchor = anchorMatch ? `<a id="${anchorMatch[1]}"></a>` : "";
        let output = `${anchor}<${tag} class="calibre-heading">${trimmedBold}</${tag}>`;
        if (trailing.trim()) {
          output += `\n<p${pAttrs}>${trailing.trim()}</p>`;
        }
        return output;
      }

      return match;
    }
  );

  result = result.replace(
    /<p\b([^>]*)>\s*(?:<a\s+id="[^"]*"><\/a>\s*)?<b\b[^>]*>(.*?)<\/b>\s*<\/p>/gi,
    (match, pAttrs, boldText) => {
      const trimmedBold = boldText.trim();
      if (trimmedBold.length >= 2 && trimmedBold.length <= 80) {
        const isHeading = HEADING_PATTERNS.some(p => p.test(trimmedBold));
        if (isHeading) {
          const tag = /^(part\s)/i.test(trimmedBold) ? "h1" : "h2";
          const anchorMatch = match.match(/<a\s+id="([^"]*)"><\/a>/);
          const anchor = anchorMatch ? `<a id="${anchorMatch[1]}"></a>` : "";
          return `${anchor}<${tag} class="calibre-heading">${trimmedBold}</${tag}>`;
        }
      }
      return match;
    }
  );

  if (result.includes('calibre-heading')) {
    const headingCSS = `
.calibre-heading {
  font-size: 1.4em;
  font-weight: bold;
  margin: 1.5em 0 0.8em 0;
  line-height: 1.3;
  page-break-before: always;
}
h1.calibre-heading {
  font-size: 1.6em;
  text-align: center;
  margin: 2em 0 1em 0;
}`;
    if (/<\/style>/i.test(result)) {
      result = result.replace(/<\/style>/i, `${headingCSS}\n</style>`);
    } else if (/<\/head>/i.test(result)) {
      result = result.replace(/<\/head>/i, `<style type="text/css">${headingCSS}\n</style>\n</head>`);
    }
  }

  result = result.replace(/(<\/p>\s*<p)/gi, '$1');

  return result;
}

async function postProcessEpub(epubPath: string): Promise<void> {
  const tmpDir = epubPath + "_tmp";
  try {
    await execFileAsync("unzip", ["-o", epubPath, "-d", tmpDir], {
      timeout: 30000,
    });

    const walkDir = (dir: string): string[] => {
      let files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(walkDir(fullPath));
        } else if (/\.(html|xhtml|htm)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const htmlFiles = walkDir(tmpDir);
    let modified = false;

    for (const htmlFile of htmlFiles) {
      const content = fs.readFileSync(htmlFile, "utf8");
      const processed = postProcessEpubHtml(content);
      if (processed !== content) {
        fs.writeFileSync(htmlFile, processed, "utf8");
        modified = true;
      }
    }

    if (modified) {
      fs.unlinkSync(epubPath);
      const mimetypePath = path.join(tmpDir, "mimetype");
      await execFileAsync("bash", ["-c",
        `cd "${tmpDir}" && zip -0 -X "${epubPath}" mimetype && zip -r -X "${epubPath}" . -x mimetype`
      ], { timeout: 30000 });
      logger.info("Conversion: Post-processed EPUB HTML for better formatting");
    }
  } catch (err: any) {
    logger.warn(`Post-processing failed (non-fatal): ${err.message?.slice(0, 200)}`);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

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

  await storage.updateBook(bookId, { conversionStatus: "processing" });

  const inputExt = getInputExtension(book.originalFormat || "application/pdf");
  const inputPath = path.join(CONVERSION_DIR, `${bookId}${inputExt}`);
  const outputPath = path.join(CONVERSION_DIR, `${bookId}.epub`);

  const cleanup = () => {
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  };

  try {
    logger.info(`Conversion: Downloading original file for book ${bookId}...`);
    await downloadFromObjectStorage(book.originalFileUrl, inputPath);

    logger.info(`Conversion: Converting ${inputExt} to EPUB for book ${bookId}...`);

    const calibreArgs = [
      inputPath,
      outputPath,
      "--title", book.title,
      "--authors", book.author,
      "--language", "en",
      "--no-default-epub-cover",
      "--enable-heuristics",
    ];

    if (inputExt === ".pdf") {
      calibreArgs.push("--unwrap-factor", "0.45");
    }

    try {
      await execFileAsync("ebook-convert", calibreArgs, {
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (calibreErr: any) {
      const stderr = calibreErr.stderr?.slice(0, 500) || "";
      const stdout = calibreErr.stdout?.slice(0, 500) || "";
      logger.warn(`Calibre conversion failed for book ${bookId}: ${calibreErr.message?.slice(0, 300)}`);
      if (stderr) logger.warn(`Calibre stderr: ${stderr}`);
      if (stdout) logger.warn(`Calibre stdout: ${stdout}`);

      if (inputExt === ".pdf") {
        throw new Error(`PDF conversion failed: ${calibreErr.message?.slice(0, 200)}`);
      }

      await execFileAsync("pandoc", [
        inputPath,
        "-o", outputPath,
        "--metadata", `title=${book.title}`,
        "--metadata", `author=${book.author}`,
      ], {
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024,
      });
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error("Conversion produced no output file");
    }

    const epubSize = fs.statSync(outputPath).size;
    if (epubSize < 100) {
      throw new Error("Conversion produced an empty or invalid EPUB");
    }

    if (inputExt === ".pdf") {
      logger.info(`Conversion: Post-processing EPUB for book ${bookId}...`);
      await postProcessEpub(outputPath);
    }

    const finalSize = fs.statSync(outputPath).size;
    logger.info(`Conversion: Uploading EPUB for book ${bookId} (${(finalSize / 1024).toFixed(1)} KB)...`);
    const epubObjectPath = await uploadToObjectStorage(outputPath, "application/epub+zip");

    await storage.updateBook(bookId, {
      epubFileUrl: epubObjectPath,
      conversionStatus: "completed",
    });

    logger.info(`Conversion: Book ${bookId} conversion completed successfully`);
  } catch (error: any) {
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
