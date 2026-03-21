import type { Express, Request, Response } from "express";
import type { Server } from "http";
import crypto from "crypto";
import { Paynow } from "paynow";
import { storage } from "../storage";
import { isAuthenticated } from "../auth/googleAuth";
import { generateCertificatePDF } from "../certificate-generator";
import { DEFAULT_CERTIFICATE_FEE } from "./types";

export function registerCertificateRoutes(app: Express, _httpServer: Server): void {
  // Generate certificate
  app.post("/api/courses/:courseId/certificate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const userIsAdmin = (req.user as any)?.isAdmin === true;
      const courseId = String(req.params.courseId);
      const user = await storage.getUser(userId);
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const existing = await storage.getCertificate(courseId, userId);
      if (existing) {
        if (userIsAdmin || existing.paid) return res.json(existing);
        const { verificationToken, ...redacted } = existing;
        return res.json(redacted);
      }
      if (!userIsAdmin) {
        const allLessons = await storage.getLessonsByCourse(courseId);
        const lessonProgress = await storage.getLessonProgress(courseId, userId);
        const completedLessons = lessonProgress.filter((p: any) => p.completed);
        if (allLessons.length > 0 && completedLessons.length < allLessons.length) {
          return res.status(400).json({ error: `You must complete all lessons first. ${completedLessons.length}/${allLessons.length} completed.` });
        }
        const progressTests = await storage.getQuizzesByCourse(courseId);
        const moduleTests = progressTests.filter(q => q.quizType === "progress_test");
        for (const test of moduleTests) {
          const best = await storage.getBestQuizAttempt(test.id, userId);
          if (!best || !best.passed) return res.status(400).json({ error: `You must pass all module tests. Failed on: ${test.title}` });
        }
      }
      const verificationToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
      const certificate = await storage.createCertificate({
        courseId, userId,
        userName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || "Student",
        courseTitle: course.title, instructorName: course.instructorName,
        verificationToken: userIsAdmin ? verificationToken : "PENDING_" + verificationToken,
      });
      if (userIsAdmin) {
        await storage.updateCertificate(certificate.id, { paid: true });
        return res.json({ ...certificate, paid: true });
      }
      const { verificationToken: _token, ...redactedCert } = certificate;
      res.json(redactedCert);
    } catch (error) { console.error("Error generating certificate:", error); res.status(500).json({ error: "Failed to generate certificate" }); }
  });

  // Get certificate
  app.get("/api/courses/:courseId/certificate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const userIsAdmin = (req.user as any)?.isAdmin === true;
      const cert = await storage.getCertificate(String(req.params.courseId), userId);
      if (!cert) return res.json(null);
      if (userIsAdmin || cert.paid) return res.json(cert);
      const { verificationToken, ...redacted } = cert;
      res.json(redacted);
    } catch (error) { console.error("Error fetching certificate:", error); res.status(500).json({ error: "Failed to fetch certificate" }); }
  });

  // Public: verify certificate
  app.get("/api/certificates/verify/:token", async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token);
      if (token.startsWith("PENDING_")) return res.status(404).json({ error: "Certificate not found", valid: false });
      const cert = await storage.getCertificateByToken(token);
      if (!cert || !cert.paid) return res.status(404).json({ error: "Certificate not found", valid: false });
      const course = await storage.getCourse(cert.courseId);
      res.json({ valid: true, certificate: { ...cert, courseLevel: (course as any)?.level || null } });
    } catch (error) { console.error("Error verifying certificate:", error); res.status(500).json({ error: "Failed to verify certificate" }); }
  });

  // Download certificate PDF
  app.get("/api/courses/:courseId/certificate/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const userIsAdmin = (req.user as any)?.isAdmin === true;
      const courseId = String(req.params.courseId);
      const cert = await storage.getCertificate(courseId, userId);
      if (!cert) return res.status(404).json({ error: "Certificate not found" });
      if (!userIsAdmin && !cert.paid) return res.status(403).json({ error: "Certificate payment required" });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const verifyUrl = `${baseUrl}/verify/${cert.verificationToken}`;
      const course = await storage.getCourse(courseId);
      const pdfBuffer = await generateCertificatePDF({
        studentName: cert.userName, courseTitle: cert.courseTitle, instructorName: cert.instructorName,
        completionDate: new Date(cert.createdAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        verificationToken: cert.verificationToken, certificateId: cert.id, verifyUrl,
        courseLevel: (course as any)?.level || undefined,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="certificate-${cert.verificationToken}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) { console.error("Error downloading certificate PDF:", error); res.status(500).json({ error: "Failed to generate certificate PDF" }); }
  });

  // Certificate payment initiation
  app.post("/api/certificates/payments/initiate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const { courseId, email, phone, paymentMethod } = req.body;
      if (!courseId) return res.status(400).json({ error: "Course ID is required" });
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const existing = await storage.getCertificate(courseId, userId);
      if (existing?.paid) return res.json({ success: true, alreadyPaid: true });
      const integrationId = process.env.PAYNOW_INTEGRATION_ID?.trim();
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY?.trim();
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const paynow = new Paynow(integrationId, integrationKey);
      const host = req.headers.host || 'localhost:5000';
      const protocol = req.headers['x-forwarded-proto'] as string || 'http';
      const baseUrl = `${protocol}://${host}`;
      paynow.resultUrl = `${baseUrl}/api/certificates/payments/callback`;
      paynow.returnUrl = `${baseUrl}/course/${courseId}/learn?tab=certificate&payment=success`;
      const payerEmail = email || (req.user as any)?.email || 'student@fundi.app';
      const certFee = course.certificateFee ?? DEFAULT_CERTIFICATE_FEE;
      const payment = paynow.createPayment(`Cert_${courseId}_${userId}_${Date.now()}`, payerEmail);
      payment.add(`Certificate: ${course.title}`, certFee);
      let response;
      if (paymentMethod === 'ecocash' && phone) response = await paynow.sendMobile(payment, phone, 'ecocash');
      else if (paymentMethod === 'onemoney' && phone) response = await paynow.sendMobile(payment, phone, 'onemoney');
      else response = await paynow.send(payment);
      if (response.success) {
        await storage.createCertPendingPayment({ courseId, userId, email: payerEmail, pollUrl: response.pollUrl, amount: certFee, paymentMethod });
        res.json({ success: true, redirectUrl: response.redirectUrl, pollUrl: response.pollUrl, instructions: response.instructions, paymentMethod });
      } else { res.status(400).json({ success: false, error: response.error }); }
    } catch (error) { console.error("Certificate payment initiation error:", error); res.status(500).json({ error: "Failed to initiate certificate payment" }); }
  });

  // Certificate payment check-status
  app.post("/api/certificates/payments/check-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const { pollUrl, courseId } = req.body;
      const integrationId = process.env.PAYNOW_INTEGRATION_ID?.trim();
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY?.trim();
      if (!integrationId || !integrationKey) return res.status(500).json({ error: "Payment gateway not configured" });
      const paynow = new Paynow(integrationId, integrationKey);
      const status = await paynow.pollTransaction(pollUrl);
      if (status.paid()) {
        const user = await storage.getUser(userId);
        const course = await storage.getCourse(courseId);
        if (!course) return res.status(404).json({ error: "Course not found" });
        let cert = await storage.getCertificate(courseId, userId);
        if (!cert) {
          cert = await storage.createCertificate({
            courseId, userId,
            userName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || "Student",
            courseTitle: course.title, instructorName: course.instructorName,
            verificationToken: "PENDING_" + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
          });
        }
        const realToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
        await storage.markCertificatePaid(courseId, userId, realToken);
        const pendingPayments = await storage.getCertPendingPayments(courseId, userId);
        for (const pp of pendingPayments) await storage.markCertPendingPaymentCompleted(pp.id);
        res.json({ success: true, paid: true, certificate: await storage.getCertificate(courseId, userId) });
      } else { res.json({ success: true, paid: false, status: status.status }); }
    } catch (error) { console.error("Certificate payment status check error:", error); res.status(500).json({ error: "Failed to check certificate payment status" }); }
  });

  // Certificate payment callback (webhook)
  app.post("/api/certificates/payments/callback", async (req: Request, res: Response) => {
    try {
      const { reference, paynowreference, pollurl } = req.body;
      const referenceParts = reference?.split("_");
      const courseId = referenceParts?.[1];
      const userId = referenceParts?.[2];
      if (!courseId || !userId) return res.send("OK");
      const integrationId = process.env.PAYNOW_INTEGRATION_ID?.trim();
      const integrationKey = process.env.PAYNOW_INTEGRATION_KEY?.trim();
      if (!integrationId || !integrationKey) return res.send("OK");
      const paynow = new Paynow(integrationId, integrationKey);
      const verifiedStatus = await paynow.pollTransaction(pollurl);
      if (verifiedStatus.paid()) {
        const user = await storage.getUser(userId);
        const course = await storage.getCourse(courseId);
        if (course) {
          let cert = await storage.getCertificate(courseId, userId);
          if (!cert) {
            cert = await storage.createCertificate({
              courseId, userId,
              userName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || "Student",
              courseTitle: course.title, instructorName: course.instructorName,
              verificationToken: "PENDING_" + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
            });
          }
          const realToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
          await storage.markCertificatePaid(courseId, userId, realToken);
          const pendingPayments = await storage.getCertPendingPayments(courseId, userId);
          for (const pp of pendingPayments) await storage.markCertPendingPaymentCompleted(pp.id);
        }
      }
      res.send("OK");
    } catch (error) { console.error("Certificate payment callback error:", error); res.send("OK"); }
  });
}
