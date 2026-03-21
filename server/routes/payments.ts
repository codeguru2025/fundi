import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { Paynow } from "paynow";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { rateLimit, COMMISSION_RATE, UPLOAD_FEE, MONTHLY_SUBSCRIPTION, DEFAULT_CERTIFICATE_FEE } from "./types";

export function registerPaymentRoutes(app: Express, _httpServer: Server): void {
  // Paynow config GET/POST
  app.get("/api/paynow-config", async (_req: Request, res: Response) => {
    try {
      const integrationId = process.env.PAYNOW_INTEGRATION_ID;
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
      res.json({ configured: !!(integrationId && integrationKey) });
    } catch (error) { console.error("Error fetching Paynow config:", error); res.status(500).json({ error: "Failed to fetch Paynow config" }); }
  });

  app.post("/api/paynow-config", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { integrationId, integrationKey } = req.body;
      if (!integrationId || !integrationKey) return res.status(400).json({ error: "Integration ID and Key are required" });
      const config = await storage.savePaynowConfig({ integrationId, integrationKey, isActive: true });
      res.json({ configured: true, integrationId: config.integrationId });
    } catch (error) { console.error("Error saving Paynow config:", error); res.status(500).json({ error: "Failed to save Paynow config" }); }
  });

  // Pricing
  app.get("/api/pricing", (_req: Request, res: Response) => {
    res.json({ uploadFee: UPLOAD_FEE, monthlySubscription: MONTHLY_SUBSCRIPTION, commissionRate: COMMISSION_RATE, minSettlement: 50, firstBookFree: true });
  });

  // Book payment initiation
  app.post("/api/payments/initiate", rateLimit(60000, 10), async (req: Request, res: Response) => {
    try {
      const paymentSchema = z.object({ bookId: z.string().min(1), buyerToken: z.string().min(1), email: z.string().email().optional().or(z.literal("")), phone: z.string().optional(), paymentMethod: z.enum(["web", "ecocash", "onemoney"]).optional() });
      const parsed = paymentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid payment data", details: parsed.error.flatten().fieldErrors });
      const { bookId, buyerToken, email, phone, paymentMethod } = parsed.data;
      const integrationId = process.env.PAYNOW_INTEGRATION_ID?.trim();
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY?.trim();
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const book = await storage.getBook(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });
      const paynow = new Paynow(integrationId, integrationKey);
      const host = req.headers.host || 'localhost:5000';
      const protocol = req.headers['x-forwarded-proto'] as string || 'http';
      const baseUrl = `${protocol}://${host}`;
      paynow.resultUrl = `${baseUrl}/api/payments/callback`;
      paynow.returnUrl = `${baseUrl}/book/${bookId}?payment=success`;
      const payment = paynow.createPayment(`Book_${bookId}_${Date.now()}`, email || 'customer@lumina.app');
      payment.add(book.title, book.price);
      let response;
      if (paymentMethod === 'ecocash' && phone) response = await paynow.sendMobile(payment, phone, 'ecocash');
      else if (paymentMethod === 'onemoney' && phone) response = await paynow.sendMobile(payment, phone, 'onemoney');
      else response = await paynow.send(payment);
      if (response.success) {
        await storage.createPendingPayment({ bookId, buyerToken, email: email || null, pollUrl: response.pollUrl, amount: book.price, status: 'pending' });
        res.json({ success: true, redirectUrl: response.redirectUrl, pollUrl: response.pollUrl, instructions: response.instructions, paymentMethod });
      } else { res.status(400).json({ success: false, error: response.error }); }
    } catch (error) { console.error("Payment initiation error:", error); res.status(500).json({ error: "Failed to initiate payment" }); }
  });

  // Book payment check-status
  app.post("/api/payments/check-status", rateLimit(60000, 30), async (req: Request, res: Response) => {
    try {
      const { pollUrl, bookId, buyerToken, email } = req.body;
      if (!buyerToken) return res.status(400).json({ error: "Buyer token is required" });
      const integrationId = process.env.PAYNOW_INTEGRATION_ID;
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const paynow = new Paynow(integrationId, integrationKey);
      const status = await paynow.pollTransaction(pollUrl);
      if (status.paid()) {
        const book = await storage.getBook(bookId);
        if (book) {
          const saleAmount = book.price;
          const commission = saleAmount * COMMISSION_RATE;
          const sellerEarnings = saleAmount - commission;
          const pendingPayments = await storage.getPendingPaymentByBookId(bookId);
          const matched = pendingPayments.find((p: any) => p.buyerToken === buyerToken && p.status === "pending");
          await storage.confirmBookPayment({ bookId, buyerToken, email, sellerId: book.authorId || "unknown", amount: saleAmount, commission, sellerEarnings, paynowReference: status.reference, pendingPaymentId: matched?.id || "" });
        }
        res.json({ success: true, paid: true, status: 'paid', message: 'Payment successful! You now have full access to this book.' });
      } else { res.json({ success: true, paid: false, status: status.status, message: `Payment status: ${status.status}` }); }
    } catch (error) { console.error("Payment status check error:", error); res.status(500).json({ error: "Failed to check payment status" }); }
  });

  // Book purchase check
  app.post("/api/purchases/check", async (req: Request, res: Response) => {
    try {
      const { bookId, buyerToken, userId } = req.body;
      if (!bookId) return res.json({ purchased: false });
      let purchased = false;
      if (buyerToken) purchased = await storage.hasPurchased(bookId, buyerToken);
      if (!purchased && userId) purchased = await storage.hasPurchased(bookId, userId);
      res.json({ purchased });
    } catch (error) { console.error("Purchase check error:", error); res.json({ purchased: false }); }
  });

  // Book payment callback (webhook)
  app.post("/api/payments/callback", async (req: Request, res: Response) => {
    try {
      const { reference, paynowreference, pollurl } = req.body;
      const referenceParts = reference?.split("_");
      if (!referenceParts || referenceParts.length < 2) return res.status(200).send("OK");
      const bookId = referenceParts[1];
      const pendingPayments = await storage.getPendingPaymentByBookId(bookId);
      const matchedPayment = pendingPayments.find((p: any) => p.pollUrl === pollurl);
      if (!matchedPayment) return res.status(200).send("OK");
      const integrationId = process.env.PAYNOW_INTEGRATION_ID;
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
      if (!integrationId || !integrationKey) return res.status(200).send("OK");
      const paynow = new Paynow(integrationId, integrationKey);
      const verifiedStatus = await paynow.pollTransaction(matchedPayment.pollUrl);
      if (!verifiedStatus.paid()) return res.status(200).send("OK");
      const book = await storage.getBook(bookId);
      if (!book) return res.status(200).send("OK");
      const saleAmount = matchedPayment.amount;
      const commission = saleAmount * COMMISSION_RATE;
      const sellerEarnings = saleAmount - commission;
      await storage.confirmBookPayment({ bookId, buyerToken: matchedPayment.buyerToken, email: matchedPayment.email || undefined, sellerId: book.authorId || "unknown", amount: saleAmount, commission, sellerEarnings, paynowReference: paynowreference || verifiedStatus.reference, pendingPaymentId: matchedPayment.id });
      res.status(200).send("OK");
    } catch (error) { console.error("Payment callback error:", error); res.status(500).send("Error"); }
  });

  // Course payment initiation
  app.post("/api/courses/payments/initiate", rateLimit(60000, 10), async (req: Request, res: Response) => {
    try {
      const coursePaymentSchema = z.object({ courseId: z.string().min(1), buyerToken: z.string().min(1), email: z.string().email().optional().or(z.literal("")), phone: z.string().optional(), paymentMethod: z.enum(["web", "ecocash", "onemoney"]).optional() });
      const parsed = coursePaymentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid payment data", details: parsed.error.flatten().fieldErrors });
      const { courseId, buyerToken, email, phone, paymentMethod } = parsed.data;
      const integrationId = process.env.PAYNOW_INTEGRATION_ID?.trim();
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY?.trim();
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const paynow = new Paynow(integrationId, integrationKey);
      const host = req.headers.host || 'localhost:5000';
      const protocol = req.headers['x-forwarded-proto'] as string || 'http';
      const baseUrl = `${protocol}://${host}`;
      paynow.resultUrl = `${baseUrl}/api/courses/payments/callback`;
      paynow.returnUrl = `${baseUrl}/course/${courseId}?payment=success`;
      const payment = paynow.createPayment(`Course_${courseId}_${Date.now()}`, email || 'customer@lumina.app');
      payment.add(course.title, course.price);
      let response;
      if (paymentMethod === 'ecocash' && phone) response = await paynow.sendMobile(payment, phone, 'ecocash');
      else if (paymentMethod === 'onemoney' && phone) response = await paynow.sendMobile(payment, phone, 'onemoney');
      else response = await paynow.send(payment);
      if (response.success) {
        await storage.createCoursePendingPayment(courseId, buyerToken, response.pollUrl, course.price, email);
        res.json({ success: true, redirectUrl: response.redirectUrl, pollUrl: response.pollUrl, instructions: response.instructions, paymentMethod });
      } else { res.status(400).json({ success: false, error: response.error }); }
    } catch (error) { console.error("Course payment initiation error:", error); res.status(500).json({ error: "Failed to initiate payment" }); }
  });

  // Course payment check-status
  app.post("/api/courses/payments/check-status", rateLimit(60000, 30), async (req: Request, res: Response) => {
    try {
      const { pollUrl, courseId, buyerToken, email } = req.body;
      if (!buyerToken) return res.status(400).json({ error: "Buyer token required" });
      const integrationId = process.env.PAYNOW_INTEGRATION_ID;
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const paynow = new Paynow(integrationId, integrationKey);
      const status = await paynow.pollTransaction(pollUrl);
      if (status.paid()) {
        const course = await storage.getCourse(courseId);
        if (course) {
          const saleAmount = course.price;
          const commission = saleAmount * COMMISSION_RATE;
          const sellerEarnings = saleAmount - commission;
          const pp = await storage.getCoursePendingPayments(courseId);
          const matched = pp.find((p: any) => p.buyerToken === buyerToken && p.status === "pending");
          await storage.confirmCoursePayment({ courseId, buyerToken, email, sellerId: course.instructorId, amount: saleAmount, commission, sellerEarnings, paynowReference: status.reference, pendingPaymentId: matched?.id || "" });
        }
        res.json({ success: true, paid: true, status: 'paid', message: 'Payment successful! You now have access to this course.' });
      } else { res.json({ success: true, paid: false, status: status.status, message: `Payment status: ${status.status}` }); }
    } catch (error) { console.error("Course payment status check error:", error); res.status(500).json({ error: "Failed to check payment status" }); }
  });

  // Course payment callback (webhook)
  app.post("/api/courses/payments/callback", async (req: Request, res: Response) => {
    try {
      const { reference, paynowreference, pollurl } = req.body;
      const referenceParts = reference?.split("_");
      if (!referenceParts || referenceParts.length < 2) return res.status(200).send("OK");
      const courseId = referenceParts[1];
      const pp = await storage.getCoursePendingPayments(courseId);
      const matchedPayment = pp.find((p: any) => p.pollUrl === pollurl);
      if (!matchedPayment) return res.status(200).send("OK");
      const integrationId = process.env.PAYNOW_INTEGRATION_ID;
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
      if (!integrationId || !integrationKey) return res.status(200).send("OK");
      const paynow = new Paynow(integrationId, integrationKey);
      const verifiedStatus = await paynow.pollTransaction(matchedPayment.pollUrl);
      if (!verifiedStatus.paid()) return res.status(200).send("OK");
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(200).send("OK");
      const saleAmount = matchedPayment.amount;
      const commission = saleAmount * COMMISSION_RATE;
      const sellerEarnings = saleAmount - commission;
      await storage.confirmCoursePayment({ courseId, buyerToken: matchedPayment.buyerToken, email: matchedPayment.email || undefined, sellerId: course.instructorId, amount: saleAmount, commission, sellerEarnings, paynowReference: paynowreference || verifiedStatus.reference, pendingPaymentId: matchedPayment.id });
      res.status(200).send("OK");
    } catch (error) { console.error("Course payment callback error:", error); res.status(500).send("Error"); }
  });

  // Course purchase check
  app.post("/api/courses/purchases/check", async (req: Request, res: Response) => {
    try {
      const { courseId, buyerToken, userId } = req.body;
      if (!courseId) return res.json({ purchased: false });
      let purchased = false;
      if (buyerToken) purchased = await storage.hasCoursePurchased(courseId, buyerToken);
      if (!purchased && userId) purchased = await storage.hasCoursePurchased(courseId, userId);
      res.json({ purchased });
    } catch (error) { console.error("Course purchase check error:", error); res.json({ purchased: false }); }
  });
}
