import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino";
import cookieParser from "cookie-parser";
import { pool } from "./db";
import { validateEnv } from "./env-check";
import { csrfCookie, csrfProtect } from "./csrf";
import "./types"; // Express.User type augmentation

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

// Fail fast if required env vars are missing
validateEnv();

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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL]
  : ["http://localhost:5000", "http://localhost:3000"];
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (server-to-server, mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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
app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", ts: new Date().toISOString() });
  } catch (err) {
    logger.error(err, "Health check failed — DB unreachable");
    res.status(503).json({ status: "unhealthy", ts: new Date().toISOString() });
  }
});

// ── Body parsing — 10MB for course metadata, parse raw body for webhook verification
// Note: large file uploads bypass the server via pre-signed URLs to DO Spaces.
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(cookieParser());

// ── CSRF protection (double-submit cookie) ──────────────────────────────────
app.use("/api/", csrfCookie);
app.use("/api/", csrfProtect);

// ── Static uploads (local disk fallback, served with caching headers) ───────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: "7d",
  immutable: true,
  etag: true,
  lastModified: true,
}));

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

    logger.error({ err, status }, "Unhandled error");

    if (res.headersSent) {
      return next(err);
    }

    // Never leak internal error details to the client for server errors
    const message = status >= 500
      ? "Internal Server Error"
      : (err.message || "Internal Server Error");

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
    logger.info({ port }, `Fundi server listening on port ${port}`);
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

  // ── Catch unhandled promise rejections and uncaught exceptions ────────────
  process.on("unhandledRejection", (reason: unknown) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });
  process.on("uncaughtException", (err: Error) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    shutdown();
  });
})();
