import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth/googleAuth";
import { insertPageViewSchema } from "@shared/schema";
import { rateLimit } from "./types";

export function registerAnalyticsRoutes(app: Express, _httpServer: Server): void {
  // Track page views
  app.post("/api/analytics/track", rateLimit(60000, 30), async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || null;
      const sessionId = (req as any).sessionID || req.headers["x-session-id"] as string || null;
      const userAgent = req.headers["user-agent"] || null;
      const { path, referrer, contentType, contentId } = req.body;
      const viewData = insertPageViewSchema.parse({
        path, referrer: referrer || null, userAgent, sessionId, userId,
        contentType: contentType || null, contentId: contentId || null,
      });
      await storage.trackPageView(viewData);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid tracking data" });
      console.error("Error tracking page view:", error);
      res.status(500).json({ error: "Failed to track" });
    }
  });

  // Publisher Dashboard
  app.get("/api/dashboard", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const myBooks = await storage.getBooksByAuthor(userId);
      const myCourses = await storage.getCoursesByInstructor(userId);
      const bookIds = myBooks.map(b => b.id);
      const courseIds = myCourses.map(c => c.id);
      const [sellerAgg, salesByBook, coursePurchaseCounts, bookViews, courseViews, settlements, recentSales] = await Promise.all([
        storage.getSellerSalesAggregates(userId),
        storage.getSellerSalesByBook(userId),
        storage.getCoursePurchaseCountsBatch(courseIds),
        bookIds.length > 0 ? storage.getContentViews("book", bookIds, 30) : Promise.resolve([]),
        courseIds.length > 0 ? storage.getContentViews("course", courseIds, 30) : Promise.resolve([]),
        storage.getSettlementsBySeller(userId),
        storage.getRecentSales(20),
      ]);
      const totalCourseSalesCount = coursePurchaseCounts.reduce((s, c) => s + c.count, 0);
      const salesByBookMap = new Map(salesByBook.map(s => [s.bookId, s]));
      const coursePurchaseMap = new Map(coursePurchaseCounts.map(c => [c.courseId, c.count]));
      const bookViewsMap = new Map(bookViews.map(v => [v.contentId, v.count]));
      const courseViewsMap = new Map(courseViews.map(v => [v.contentId, v.count]));
      let viewsOverTime: { date: string; count: number }[] = [];
      try {
        const [bv, cv] = await Promise.all([
          bookIds.length > 0 ? storage.getViewsOverTimeForContent("book", bookIds, 30) : Promise.resolve([]),
          courseIds.length > 0 ? storage.getViewsOverTimeForContent("course", courseIds, 30) : Promise.resolve([]),
        ]);
        const combined: Record<string, number> = {};
        [...bv, ...cv].forEach(v => { combined[v.date] = (combined[v.date] || 0) + v.count; });
        viewsOverTime = Object.entries(combined).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
      } catch (e: any) { console.error("[Dashboard] Error fetching analytics views:", e?.message); }
      const sellerRecentSales = recentSales.filter(s => s.sellerId === userId);
      res.json({
        books: myBooks.map(b => {
          const bookSale = salesByBookMap.get(b.id);
          return {
            id: b.id, title: b.title, author: b.author, cover: b.cover, price: b.price,
            category: b.category, isActive: b.isActive, isApproved: b.isApproved,
            adminComment: b.adminComment, subscriptionActive: b.subscriptionActive,
            createdAt: b.createdAt, views: bookViewsMap.get(b.id) || 0,
            salesCount: bookSale?.salesCount || 0, revenue: bookSale?.revenue || 0,
          };
        }),
        courses: myCourses.map(c => ({
          id: c.id, title: c.title, cover: c.cover, price: c.price, category: c.category,
          isActive: c.isActive, isApproved: c.isApproved, adminComment: c.adminComment,
          totalLessons: c.totalLessons, certificateFee: c.certificateFee ?? 100,
          instructorName: c.instructorName, createdAt: c.createdAt,
          views: courseViewsMap.get(c.id) || 0, salesCount: coursePurchaseMap.get(c.id) || 0,
        })),
        stats: {
          totalBooks: myBooks.length, totalCourses: myCourses.length,
          totalSales: sellerAgg.salesCount + totalCourseSalesCount,
          totalBookSales: sellerAgg.salesCount, totalCourseSales: totalCourseSalesCount,
          totalBookRevenue: Math.round(sellerAgg.totalRevenue * 100) / 100,
          totalCommissionPaid: Math.round(sellerAgg.totalCommission * 100) / 100,
          totalViews: bookViews.reduce((s, v) => s + v.count, 0) + courseViews.reduce((s, v) => s + v.count, 0),
        },
        viewsOverTime,
        settlements: settlements.slice(0, 10).map(s => ({ id: s.id, amount: s.amount, status: s.status, scheduledFor: s.scheduledFor, paidAt: s.paidAt })),
        recentSales: sellerRecentSales.slice(0, 20).map(s => ({
          id: s.id, bookId: s.bookId, amount: s.amount, sellerEarnings: s.sellerEarnings,
          commission: s.commission, createdAt: s.createdAt,
          bookTitle: myBooks.find(b => b.id === s.bookId)?.title || "Unknown",
        })),
      });
    } catch (error: any) {
      console.error("[Dashboard] FATAL error:", error?.message, error?.stack);
      res.status(500).json({ error: "Failed to fetch dashboard data", details: error?.message });
    }
  });
}
