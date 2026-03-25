/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * 1. On every response, set a `csrf-token` cookie with a random value.
 * 2. On mutating requests (POST/PUT/PATCH/DELETE), verify that the
 *    `x-csrf-token` header matches the cookie value.
 *
 * This is stateless — no DB or session storage needed.
 * Safe because an attacker cannot read cross-origin cookies.
 */
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./index";

const COOKIE_NAME = "csrf-token";
const HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Paths exempt from CSRF checks (webhooks called by external services)
const EXEMPT_PATHS = [
  "/api/payments/callback",
  "/api/certificates/payments/callback",
  "/api/cron/",
  "/api/analytics/track",
];

function isExempt(path: string): boolean {
  return EXEMPT_PATHS.some(p => path.startsWith(p));
}

/** Middleware: set CSRF cookie on every response if not already present */
export function csrfCookie(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[COOKIE_NAME]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false,   // client JS must be able to read it
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  next();
}

/** Middleware: verify CSRF token on mutating requests */
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isExempt(req.path)) return next();

  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn({ method: req.method, path: req.path }, "CSRF token mismatch");
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  next();
}
