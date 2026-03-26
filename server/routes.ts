import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupGoogleAuth, isAuthenticated } from "./auth/googleAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { generateObjectKey, getUploadSignedUrl, getPublicUrl } from "./spaces";
import { logger } from "./index";

// Import all modular route handlers
import { registerAdminRoutes } from "./routes/admin";
import { registerBookRoutes } from "./routes/books";
import { registerPaymentRoutes } from "./routes/payments";
import { registerCourseRoutes } from "./routes/courses";
import { registerQuizRoutes } from "./routes/quizzes";
import { registerLabRoutes } from "./routes/labs";
import { registerCertificateRoutes } from "./routes/certificates";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerProfileRoutes } from "./routes/profiles";

// Ensure local uploads directory exists (used only as a temp buffer before Spaces upload)
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer: temp disk storage — files are uploaded to DO Spaces and then deleted
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB per file
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|mp4|webm|mov|avi|mkv|mp3|wav|ogg|m4a|aac)$/i;
    const allowedMimes = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|quicktime|x-msvideo|x-matroska)|audio\/(mpeg|wav|ogg|mp4|aac|webm))$/;
    if (allowedExtensions.test(path.extname(file.originalname)) && allowedMimes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Setup Google OAuth authentication BEFORE other routes
  await setupGoogleAuth(app);

  // ── Direct-to-Spaces pre-signed URL endpoint ──────────────────────────────
  // The browser requests a presigned URL then uploads directly to DO Spaces,
  // bypassing the Node server for large files entirely.
  app.post("/api/upload/request-signed-url", isAuthenticated, async (req: any, res) => {
    try {
      const { filename, contentType } = req.body;
      if (!filename) return res.status(400).json({ error: "filename is required" });

      const key = generateObjectKey(filename);
      const uploadURL = await getUploadSignedUrl(key, contentType || "application/octet-stream");
      const objectPath = getPublicUrl(key);

      res.json({ uploadURL, objectPath });
    } catch (err) {
      logger.error({ err }, "Error generating signed upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // ── Legacy/Fallback server-side upload endpoint ───────────────────────────
  // Accepts a multipart upload, streams the file to DO Spaces, then deletes
  // the local temp file. Falls back gracefully if Spaces is not configured.
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = req.file.path;
    const cleanup = () => { try { fs.unlinkSync(filePath); } catch (_) {} };

    try {
      const key = generateObjectKey(req.file.originalname);
      const uploadURL = await getUploadSignedUrl(key, req.file.mimetype || "application/octet-stream");

      const fileStream = fs.createReadStream(filePath);
      const fileSize = fs.statSync(filePath).size;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      try {
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: fileStream as unknown as BodyInit,
          headers: {
            "Content-Type": req.file.mimetype || "application/octet-stream",
            "Content-Length": String(fileSize),
            "x-amz-acl": "public-read",
          },
          // @ts-ignore — Node 18+ fetch supports duplex
          duplex: "half",
          signal: controller.signal,
        });

        if (!uploadResponse.ok) {
          const errText = await uploadResponse.text().catch(() => "");
          throw new Error(`Spaces upload failed (${uploadResponse.status}): ${errText}`);
        }
      } finally {
        clearTimeout(timeout);
      }

      const publicUrl = getPublicUrl(key);
      cleanup();
      res.json({ url: publicUrl, filename: req.file.originalname, size: req.file.size });
    } catch (err) {
      logger.error({ err }, "Spaces upload failed");
      cleanup();
      res.status(500).json({ error: "File upload failed. Please try again." });
    }
  });

  // ── Modular Route Registration ────────────────────────────────────────────
  registerAdminRoutes(app, httpServer);
  registerBookRoutes(app, httpServer);
  registerPaymentRoutes(app, httpServer);
  registerCourseRoutes(app, httpServer);
  registerQuizRoutes(app, httpServer);
  registerLabRoutes(app, httpServer);
  registerCertificateRoutes(app, httpServer);
  registerAnalyticsRoutes(app, httpServer);
  registerProfileRoutes(app, httpServer);

  return httpServer;
}
