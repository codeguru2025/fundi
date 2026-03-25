import type { Request, Response, NextFunction, Express } from "express";
import type { Server } from "http";
import { z } from "zod";

// Shared constants
export const COMMISSION_RATE = 0.25;
export const UPLOAD_FEE = 25;
export const MONTHLY_SUBSCRIPTION = 10;
export const MIN_SETTLEMENT = 50;
export const DEFAULT_CERTIFICATE_FEE = 100;

// Helper: strip large content fields from book objects for list responses
export function stripBookContent(book: any) {
  const { content, fileData, ...rest } = book;
  return rest;
}

export function stripBooksContent(books: any[]) {
  return books.map(stripBookContent);
}

// Helper: strip sensitive fields from user objects
export function stripSensitiveUserFields(user: any) {
  if (!user) return user;
  const { paynowIntegrationKey, ...safe } = user;
  return safe;
}

// Helper: get next Monday at midnight
export function getNextMonday(): Date {
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests, please try again later" });
    }
    entry.count++;
    return next();
  };
}

// Cleanup expired rate limit entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitMap.keys()).forEach((key) => {
    const entry = rateLimitMap.get(key);
    if (entry && now > entry.resetAt) rateLimitMap.delete(key);
  });
}, 60000);

// Type for route registration functions
export type RegisterRoutesFn = (app: Express, httpServer: Server) => void;
