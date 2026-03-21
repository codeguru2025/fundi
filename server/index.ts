import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow CDN assets
  contentSecurityPolicy: false, // configure separately once domain is known
}));
app.use(cors({
  origin: process.env.APP_URL || true, // lock to APP_URL in production
  credentials: true,
}));

// ── Rate limiting ───────────────────────────────────────────────────────────
// Global: 300 requests per 15 minutes per IP
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// Tighter limit on payment-sensitive endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment requests, please slow down." },
});
app.use("/api/books/:bookId/payment", paymentLimiter);
app.use("/api/certificates/payments", paymentLimiter);
app.use("/api/courses/:courseId/payment", paymentLimiter);

// ── Health check (required by DO App Platform) ──────────────────────────────
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", ts: new Date().toISOString() });
});

// ── Body parsing — 1MB global default, parse raw body for webhook verification
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Static uploads (local disk fallback, served with caching headers) ───────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: "7d",
  immutable: true,
  etag: true,
  lastModified: true,
}));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// ── Request logging — method, path, status, duration only (no response body) 
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      logger.info({
        method: req.method,
        path: reqPath,
        status: res.statusCode,
        durationMs: duration,
      }, `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status }, "Unhandled error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Serve Vite dev server in development, static files in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    logger.info({ port }, `Lumina server listening on port ${port}`);
  });

  // ── Graceful shutdown (required for DO App Platform zero-downtime deploys) 
  const shutdown = () => {
    logger.info("SIGTERM received — shutting down gracefully");
    httpServer.close(async () => {
      try {
        const { pool } = await import("./db");
        await pool.end();
        logger.info("Database pool closed — exiting");
      } catch (e) {
        logger.error(e, "Error closing DB pool");
      }
      process.exit(0);
    });

    // Force-exit if graceful shutdown takes too long (15s)
    setTimeout(() => {
      logger.error("Forced exit after 15s shutdown timeout");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
