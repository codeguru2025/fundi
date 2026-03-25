import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "../storage";
import { insertBookSchema } from "@shared/schema";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { stripBookContent, stripBooksContent, UPLOAD_FEE, MONTHLY_SUBSCRIPTION, COMMISSION_RATE } from "./types";
import { triggerConversion } from "../conversion-service";
import { logger } from "../index";

export function registerBookRoutes(app: Express, _httpServer: Server): void {
  // Claim book ownership
  app.post("/api/books/:id/claim", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      if (book.authorId === userId) return res.json({ claimed: true, message: "You already own this book" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const authorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
      const bookAuthorNorm = book.author.toLowerCase().trim();
      const userNameNorm = authorName.toLowerCase().trim();
      const emailPrefix = user.email?.split('@')[0]?.toLowerCase() || '';
      if (bookAuthorNorm.includes(emailPrefix) || userNameNorm.includes(bookAuthorNorm) || bookAuthorNorm.includes(userNameNorm)) {
        await storage.updateBook(req.params.id as string, { authorId: userId });
        return res.json({ claimed: true, message: "Book claimed successfully" });
      }
      return res.status(403).json({ error: "Cannot claim this book - author name doesn't match your account" });
    } catch (error) { logger.error({ err: error }, "Error claiming book"); res.status(500).json({ error: "Failed to claim book" }); }
  });

  // Check book access
  app.get("/api/books/:id/access", async (req: Request, res: Response) => {
    try {
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      const userId = req.user?.id;
      const buyerToken = req.query.buyerToken as string | undefined;
      let isAuthor = false;
      let isAdminUser = false;
      if (userId) {
        const user = await storage.getUser(userId);
        if (user?.isAdmin) isAdminUser = true;
        if (book.authorId === userId) isAuthor = true;
      }
      let isPurchased = false;
      if (userId) isPurchased = await storage.hasPurchased(book.id, userId);
      if (!isPurchased && buyerToken) isPurchased = await storage.hasPurchased(book.id, buyerToken);
      let hasSale = false;
      if (!isPurchased) {
        const bookSales = await storage.getSalesByBook(book.id);
        const completedSales = bookSales.filter(s => s.status === 'completed');
        if (userId) hasSale = completedSales.some(s => s.buyerId === userId);
        if (!hasSale && buyerToken) hasSale = completedSales.some(s => s.buyerId === buyerToken);
      }
      const hasAccess = isAuthor || isAdminUser || isPurchased || hasSale;
      res.json({ isAuthor, isPurchased: isPurchased || hasSale, hasAccess });
    } catch (error) { logger.error({ err: error }, "Error checking book access"); res.status(500).json({ error: "Failed to check access" }); }
  });

  // Featured books
  app.get("/api/books/featured", async (_req: Request, res: Response) => {
    try {
      const featuredTitles = ["Reflections of a Relentless Hustler", "Making Money While Sleeping"];
      res.json(await storage.getFeaturedBooks(featuredTitles));
    } catch (error) { logger.error({ err: error }, "Error fetching featured books"); res.json([]); }
  });

  // List books (with optional pagination)
  app.get("/api/books", async (req: Request, res: Response) => {
    try {
      const hasPageParam = req.query.page !== undefined;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const search = req.query.search as string || undefined;
      const category = req.query.category as string || undefined;
      if (!hasPageParam && !search && !category) {
        return res.json(stripBooksContent(await storage.getActiveBooks()));
      }
      const result = await storage.getActiveBooksPaginated(page, pageSize, search, category);
      res.json({ data: stripBooksContent(result.data), total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
    } catch (error) { logger.error({ err: error }, "Error fetching books"); res.status(500).json({ error: "Failed to fetch books" }); }
  });

  // All books (admin)
  app.get("/api/books/all", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(stripBooksContent(await storage.getAllBooks())); }
    catch (error) { logger.error({ err: error }, "Error fetching all books"); res.status(500).json({ error: "Failed to fetch books" }); }
  });

  // Single book
  app.get("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      res.json(book);
    } catch (error) { logger.error({ err: error }, "Error fetching book"); res.status(500).json({ error: "Failed to fetch book" }); }
  });

  // Publish check
  app.post("/api/publish/check", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const authorId = req.user!.id || req.body.authorId;
      const user = authorId ? await storage.getUser(authorId) : null;
      const userIsAdmin = user?.isAdmin === true;
      if (!authorId) {
        return res.json({ isFirstBook: true, uploadFee: 0, monthlyFee: MONTHLY_SUBSCRIPTION, commission: COMMISSION_RATE * 100, isAdmin: false });
      }
      const totalContent = await storage.getUserContentCount(authorId);
      const isFirstContent = totalContent === 0;
      res.json({
        isFirstBook: isFirstContent,
        uploadFee: userIsAdmin ? 0 : (isFirstContent ? 0 : UPLOAD_FEE),
        monthlyFee: userIsAdmin ? 0 : MONTHLY_SUBSCRIPTION,
        commission: COMMISSION_RATE * 100, existingBookCount: totalContent, isAdmin: userIsAdmin,
      });
    } catch (error) { logger.error({ err: error }, "Error checking publish requirements"); res.status(500).json({ error: "Failed to check requirements" }); }
  });

  // Create book
  app.post("/api/books", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const bookData = insertBookSchema.parse(req.body);
      const authorId = req.user!.id || bookData.authorId;
      const userIsAdmin = req.user!.isAdmin === true;
      let isFirstContent = true;
      let uploadFeePaid = false;
      if (authorId) { isFirstContent = (await storage.getUserContentCount(authorId)) === 0; }
      if (userIsAdmin) { uploadFeePaid = true; }
      else if (isFirstContent) { uploadFeePaid = true; }
      else {
        if (!req.body.paymentConfirmed) {
          return res.status(402).json({ error: "Payment required", uploadFee: UPLOAD_FEE, message: `$${UPLOAD_FEE} upload fee required for additional books` });
        }
        uploadFeePaid = true;
      }
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      let originalFileUrl = req.body.originalFileUrl || null;
      const originalFormat = req.body.originalFormat || bookData.fileType || null;
      if (!originalFileUrl && !req.body.fileData) {
        return res.status(400).json({ error: "Manuscript file required", message: "Please upload your manuscript file before publishing." });
      }
      if (!originalFileUrl && req.body.fileData && req.body.fileType) {
        try {
          const { uploadFileDataToStorage } = await import("../conversion-service");
          originalFileUrl = await uploadFileDataToStorage(req.body.fileData, req.body.fileType);
        } catch (uploadErr: any) {
          return res.status(500).json({ error: "File upload failed", message: "Could not upload your book file. Please try again." });
        }
      }
      let epubFileUrl = null;
      let conversionStatus = "none";
      if (originalFileUrl) {
        if (originalFormat === "application/epub+zip") { epubFileUrl = originalFileUrl; conversionStatus = "completed"; }
        else { conversionStatus = "pending"; }
      }
      const book = await storage.createBook({
        ...bookData, isActive: true, isApproved: userIsAdmin, subscriptionActive: true,
        subscriptionExpiresAt: userIsAdmin ? null : oneMonthFromNow,
        uploadFeePaid, originalFileUrl, epubFileUrl, originalFormat, conversionStatus,
      });
      if (originalFileUrl && conversionStatus === "pending") triggerConversion(book.id);
      res.status(201).json({
        ...book, isFirstBook: isFirstContent,
        uploadFeeCharged: userIsAdmin ? 0 : (isFirstContent ? 0 : UPLOAD_FEE),
        subscriptionFee: userIsAdmin ? 0 : MONTHLY_SUBSCRIPTION,
        nextPaymentDue: userIsAdmin ? null : oneMonthFromNow,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid book data", details: (error as z.ZodError).errors });
      logger.error({ err: error }, "Error creating book");
      res.status(500).json({ error: "Failed to create book" });
    }
  });

  // Update book
  app.patch("/api/books/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userIsAdmin = req.user!.isAdmin === true;
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      if (book.authorId !== userId && !userIsAdmin) return res.status(403).json({ error: "Not authorized to edit this book" });
      const updates = insertBookSchema.partial().parse(req.body);
      res.json(await storage.updateBook(req.params.id as string, updates));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid book data", details: (error as z.ZodError).errors });
      logger.error({ err: error }, "Error updating book");
      res.status(500).json({ error: "Failed to update book" });
    }
  });

  // Conversion status
  app.get("/api/books/:id/conversion-status", async (req: Request, res: Response) => {
    try {
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      res.json({ conversionStatus: book.conversionStatus || "none", epubFileUrl: book.epubFileUrl, originalFormat: book.originalFormat, hasLegacyFile: !book.originalFileUrl && !!book.fileData });
    } catch (error) { logger.error({ err: error }, "Error fetching conversion status"); res.status(500).json({ error: "Failed to fetch conversion status" }); }
  });

  // Reconvert
  app.post("/api/books/:id/reconvert", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      const userId = req.user!.id;
      const userIsAdmin = req.user!.isAdmin === true;
      if (book.authorId !== userId && !userIsAdmin) return res.status(403).json({ error: "Not authorized" });
      if (book.conversionStatus === "processing" || book.conversionStatus === "pending") return res.json({ message: "Conversion already in progress" });
      let fileUrl = book.originalFileUrl;
      if (!fileUrl && book.fileData && book.fileType) {
        try {
          const { uploadFileDataToStorage } = await import("../conversion-service");
          fileUrl = await uploadFileDataToStorage(book.fileData, book.fileType);
          await storage.updateBook(req.params.id as string, { originalFileUrl: fileUrl, originalFormat: book.fileType });
        } catch (migErr: any) {
          return res.status(500).json({ error: "Failed to upload book file for conversion" });
        }
      }
      if (!fileUrl) return res.status(400).json({ error: "No original file to convert" });
      await storage.updateBook(req.params.id as string, { conversionStatus: "pending", epubFileUrl: null });
      triggerConversion(req.params.id as string);
      res.json({ message: "Conversion restarted" });
    } catch (error) { logger.error({ err: error }, "Error reconverting"); res.status(500).json({ error: "Failed to reconvert" }); }
  });

  // Renew book subscription
  app.post("/api/books/:id/renew-subscription", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      if (book.authorId !== userId && !req.user!.isAdmin) return res.status(403).json({ error: "Not authorized" });
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      res.json(await storage.updateBook(req.params.id as string, { subscriptionActive: true, isActive: true, subscriptionExpiresAt: oneMonthFromNow }));
    } catch (error) { logger.error({ err: error }, "Error renewing subscription"); res.status(500).json({ error: "Failed to renew subscription" }); }
  });

  // Delete book
  app.delete("/api/books/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteBook(req.params.id as string); res.status(204).send(); }
    catch (error) { logger.error({ err: error }, "Error deleting book"); res.status(500).json({ error: "Failed to delete book" }); }
  });

  // Sales CRUD
  app.post("/api/sales", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { bookId, buyerId, paynowReference } = req.body;
      if (!bookId || !buyerId) return res.status(400).json({ error: "bookId and buyerId are required" });
      const book = await storage.getBook(bookId);
      let saleAmount: number, contentSellerId: string;
      if (book) { saleAmount = book.price; contentSellerId = book.authorId || "unknown"; }
      else {
        const course = await storage.getCourse(bookId);
        if (course) { saleAmount = course.price; contentSellerId = course.instructorId || "unknown"; }
        else { return res.status(404).json({ error: "Book or course not found" }); }
      }
      const commission = saleAmount * COMMISSION_RATE;
      const sellerEarnings = saleAmount - commission;
      const sale = await storage.createSale({ bookId, buyerId, sellerId: contentSellerId, amount: saleAmount, commission, sellerEarnings, paynowReference, status: "completed" });
      res.status(201).json(sale);
    } catch (error) { logger.error({ err: error }, "Error creating sale"); res.status(500).json({ error: "Failed to record sale" }); }
  });

  app.get("/api/sales", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      res.json((await storage.getEnrichedSalesPaginated(page, pageSize)).data);
    } catch (error) { logger.error({ err: error }, "Error fetching sales"); res.status(500).json({ error: "Failed to fetch sales" }); }
  });

  app.get("/api/admin/settlements", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      res.json((await storage.getSettlementsPaginated(page, pageSize)).data);
    } catch (error) { logger.error({ err: error }, "Error fetching settlements"); res.status(500).json({ error: "Failed to fetch settlements" }); }
  });

  app.post("/api/admin/settlements/:id/mark-paid", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      res.json(await storage.updateSettlement(req.params.id as string, { status: "paid", paidAt: new Date(), paynowReference: req.body.paynowReference }));
    } catch (error) { logger.error({ err: error }, "Error marking settlement paid"); res.status(500).json({ error: "Failed to update settlement" }); }
  });
}
