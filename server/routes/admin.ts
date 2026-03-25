import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage, db } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { coursePendingPayments, pendingPayments } from "@shared/schema";
import { desc } from "drizzle-orm";
import { stripBooksContent, stripSensitiveUserFields, rateLimit, COMMISSION_RATE } from "./types";
import { generateCertificatePDF } from "../certificate-generator";
import { logger } from "../index";

export function registerAdminRoutes(app: Express, _httpServer: Server): void {
  // Unified admin overview
  app.get("/api/admin/overview", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

      const [salesAgg, settlementAgg, bookCounts, courseCounts, coursePurchaseTotal, recentSales, pendingBooks, pendingCourses, booksPaginated, coursesPaginated, settlementsPaginated] = await Promise.all([
        storage.getSalesAggregates(),
        storage.getSettlementAggregates(),
        storage.getBookCounts(),
        storage.getCourseCounts(),
        storage.getCoursePurchaseTotal(),
        storage.getRecentSales(20),
        storage.getPendingBooks(),
        storage.getPendingCourses(),
        storage.getBooksPaginated(page, pageSize),
        storage.getCoursesPaginated(page, pageSize),
        storage.getSettlementsPaginated(page, pageSize),
      ]);

      res.json({
        sales: {
          salesCount: salesAgg.salesCount + coursePurchaseTotal,
          totalSales: salesAgg.salesCount + coursePurchaseTotal,
          totalRevenue: salesAgg.totalRevenue,
          totalCommission: salesAgg.totalCommission,
          totalAuthorEarnings: salesAgg.totalSellerEarnings,
          bookSalesCount: salesAgg.salesCount,
          courseSalesCount: coursePurchaseTotal,
          recentSales,
        },
        settlements: {
          ...settlementAgg,
          settlements: settlementsPaginated.data,
          totalPages: Math.ceil(settlementsPaginated.total / pageSize),
        },
        books: {
          ...bookCounts,
          books: booksPaginated.data,
          totalPages: Math.ceil(booksPaginated.total / pageSize),
        },
        courses: {
          ...courseCounts,
          totalCoursePurchases: coursePurchaseTotal,
          courses: coursesPaginated.data,
          totalPages: Math.ceil(coursesPaginated.total / pageSize),
        },
        pendingBooks,
        pendingCourses,
        pagination: { page, pageSize },
      });
    } catch (error: any) {
      logger.error({ err: error }, "Admin overview failed");
      res.status(500).json({ error: "Failed to fetch admin overview" });
    }
  });

  // Admin: manually grant course access
  app.post("/api/admin/grant-course-access", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { courseId, buyerToken, email, paynowReference } = req.body;
      if (!courseId || !buyerToken) {
        return res.status(400).json({ error: "courseId and buyerToken are required" });
      }

      const existing = await storage.hasCoursePurchased(courseId, buyerToken);
      if (existing) {
        return res.json({ success: true, message: "User already has access to this course" });
      }

      await storage.createCoursePurchase(courseId, buyerToken, email || undefined, paynowReference || "manual-grant");

      const course = await storage.getCourse(courseId);
      if (course && paynowReference) {
        const saleAmount = course.price || 0;
        const commission = saleAmount * 0.25;
        const sellerEarnings = saleAmount - commission;
        await storage.createSale({
          bookId: courseId,
          buyerId: buyerToken,
          sellerId: course.instructorId,
          amount: saleAmount,
          commission,
          sellerEarnings,
          paynowReference,
          status: "completed",
        });
      }

      logger.info({ courseId, buyerToken }, "Admin manually granted course access");
      res.json({ success: true, message: "Course access granted successfully" });
    } catch (error: any) {
      logger.error({ err: error }, "Error granting course access");
      res.status(500).json({ error: "Failed to grant course access" });
    }
  });

  // Admin: lookup pending payments
  app.get("/api/admin/pending-payments", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { email, contentId } = req.query;
      const allCoursePending = await db.select().from(coursePendingPayments).orderBy(desc(coursePendingPayments.createdAt));
      const allBookPending = await db.select().from(pendingPayments).orderBy(desc(pendingPayments.createdAt));

      const results: any[] = [];

      for (const p of allCoursePending) {
        if (email && (!p.email || !p.email.toLowerCase().includes(String(email).toLowerCase()))) continue;
        if (contentId && p.courseId !== contentId) continue;
        const course = await storage.getCourse(p.courseId);
        results.push({
          id: p.id, type: "course", courseId: p.courseId,
          contentTitle: course?.title || p.courseId, buyerToken: p.buyerToken,
          email: p.email, amount: p.amount, status: p.status, createdAt: p.createdAt,
        });
      }

      for (const p of allBookPending) {
        if (email && (!p.email || !p.email.toLowerCase().includes(String(email).toLowerCase()))) continue;
        if (contentId && p.bookId !== contentId) continue;
        const book = await storage.getBook(p.bookId);
        results.push({
          id: p.id, type: "book", bookId: p.bookId,
          contentTitle: book?.title || p.bookId, buyerToken: p.buyerToken,
          email: p.email, amount: p.amount, status: p.status, createdAt: p.createdAt,
        });
      }

      res.json({ payments: results });
    } catch (error: any) {
      logger.error({ err: error }, "Pending payments lookup error");
      res.status(500).json({ error: "Failed to lookup pending payments" });
    }
  });

  // Internal fix-purchase endpoint
  app.post("/api/internal/fix-purchase", rateLimit(60000, 5), async (req: Request, res: Response) => {
    try {
      const { secret, courseId, buyerToken, email, paynowReference } = req.body;
      if (secret !== process.env.SESSION_SECRET) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!courseId || !buyerToken) {
        return res.status(400).json({ error: "courseId and buyerToken required" });
      }
      const existing = await storage.hasCoursePurchased(courseId, buyerToken);
      if (existing) {
        return res.json({ success: true, message: "Already has access" });
      }
      await storage.createCoursePurchase(courseId, buyerToken, email || undefined, paynowReference || "manual-fix");
      const course = await storage.getCourse(courseId);
      if (course) {
        const saleAmount = course.price || 0;
        const commission = saleAmount * 0.25;
        const sellerEarnings = saleAmount - commission;
        await storage.createSale({
          bookId: courseId, buyerId: buyerToken, sellerId: course.instructorId,
          amount: saleAmount, commission, sellerEarnings,
          paynowReference: paynowReference || "manual-fix", status: "completed",
        });
      }
      await storage.updateCoursePendingPaymentStatus(
        (await storage.getCoursePendingPayments(courseId))
          .find((p: any) => p.buyerToken === buyerToken && p.status === "pending")?.id || "",
        "completed"
      );
      logger.info({ courseId, buyerToken }, "Fix-purchase: granted course access");
      res.json({ success: true, message: "Course access granted" });
    } catch (error: any) {
      logger.error({ err: error }, "Fix-purchase error");
      res.status(500).json({ error: "Failed to fix purchase" });
    }
  });

  // Admin reports: sales
  app.get("/api/admin/reports/sales", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const [salesAgg, recentResult] = await Promise.all([
        storage.getSalesAggregates(),
        storage.getSalesPaginated(1, 20),
      ]);
      res.json({
        salesCount: salesAgg.salesCount, totalSales: salesAgg.salesCount,
        totalRevenue: salesAgg.totalRevenue, totalCommission: salesAgg.totalCommission,
        totalAuthorEarnings: salesAgg.totalSellerEarnings, recentSales: recentResult.data,
      });
    } catch (error) {
      logger.error({ err: error }, "Error fetching sales report");
      res.status(500).json({ error: "Failed to fetch sales report" });
    }
  });

  // Admin reports: settlements
  app.get("/api/admin/reports/settlements", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      const [settlementAgg, result] = await Promise.all([
        storage.getSettlementAggregates(),
        storage.getSettlementsPaginated(page, pageSize),
      ]);
      res.json({
        totalSettlements: settlementAgg.totalSettlements, pendingCount: settlementAgg.pendingCount,
        paidCount: settlementAgg.paidCount, pendingAmount: settlementAgg.totalPending,
        paidAmount: settlementAgg.totalPaid, totalPending: settlementAgg.totalPending,
        totalPaid: settlementAgg.totalPaid, settlements: result.data,
        total: result.total, page, pageSize,
      });
    } catch (error) {
      logger.error({ err: error }, "Error fetching settlements report");
      res.status(500).json({ error: "Failed to fetch settlements report" });
    }
  });

  // Admin reports: books
  app.get("/api/admin/reports/books", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      const result = await storage.getBooksPaginated(page, pageSize);
      const counts = await storage.getAnalyticsCounts();
      res.json({
        totalBooks: counts.totalBooks, activeBooks: counts.activeBooks,
        expiredBooks: counts.totalBooks - counts.activeBooks,
        inactiveBooks: counts.totalBooks - counts.activeBooks,
        books: stripBooksContent(result.data), total: result.total, page, pageSize,
      });
    } catch (error) {
      logger.error({ err: error }, "Error fetching books report");
      res.status(500).json({ error: "Failed to fetch books report" });
    }
  });

  // Admin: user management
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
        profileImageUrl: u.profileImageUrl, isAdmin: u.isAdmin, isSeller: u.isSeller, createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      logger.error({ err: error }, "Error fetching users");
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users/:id/toggle-admin", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.id as string;
      const currentUserId = req.user?.id;
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "You cannot remove your own admin privileges" });
      }
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(targetUserId, { isAdmin: !targetUser.isAdmin });
      res.json({ id: updated?.id, email: updated?.email, isAdmin: updated?.isAdmin });
    } catch (error) {
      logger.error({ err: error }, "Error toggling admin status");
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Admin: course approval
  app.get("/api/admin/courses/pending", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(await storage.getPendingCourses()); }
    catch (error) { logger.error({ err: error }, "Error fetching pending courses"); res.status(500).json({ error: "Failed to fetch pending courses" }); }
  });

  app.post("/api/admin/courses/:id/approve", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const course = await storage.updateCourse(req.params.id as string, { isApproved: true, adminComment: comment || null });
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.json(course);
    } catch (error) { logger.error({ err: error }, "Error approving course"); res.status(500).json({ error: "Failed to approve course" }); }
  });

  app.post("/api/admin/courses/:id/reject", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const course = await storage.updateCourse(req.params.id as string, { isApproved: false, adminComment: comment || "Does not meet platform standards. Please review and resubmit." });
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.json(course);
    } catch (error) { logger.error({ err: error }, "Error rejecting course"); res.status(500).json({ error: "Failed to reject course" }); }
  });

  // Admin: book moderation
  app.get("/api/admin/books/pending", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(await storage.getPendingBooks()); }
    catch (error) { logger.error({ err: error }, "Error fetching pending books"); res.status(500).json({ error: "Failed to fetch pending books" }); }
  });

  app.post("/api/admin/books/:id/approve", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const book = await storage.updateBook(req.params.id as string, { isApproved: true, adminComment: comment || null });
      if (!book) return res.status(404).json({ error: "Book not found" });
      res.json(book);
    } catch (error) { logger.error({ err: error }, "Error approving book"); res.status(500).json({ error: "Failed to approve book" }); }
  });

  app.post("/api/admin/books/:id/reject", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const book = await storage.updateBook(req.params.id as string, { isApproved: false, isActive: false, adminComment: comment || "Does not meet platform standards. Please review and resubmit." });
      if (!book) return res.status(404).json({ error: "Book not found" });
      res.json(book);
    } catch (error) { logger.error({ err: error }, "Error rejecting book"); res.status(500).json({ error: "Failed to reject book" }); }
  });

  app.post("/api/admin/books/:id/toggle-visibility", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const book = await storage.getBook(req.params.id as string);
      if (!book) return res.status(404).json({ error: "Book not found" });
      const { comment } = req.body || {};
      const updated = await storage.updateBook(req.params.id as string, { isActive: !book.isActive, adminComment: comment || book.adminComment });
      res.json(updated);
    } catch (error) { logger.error({ err: error }, "Error toggling book visibility"); res.status(500).json({ error: "Failed to update book" }); }
  });

  app.post("/api/admin/courses/:id/toggle-visibility", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const { comment } = req.body || {};
      const updated = await storage.updateCourse(req.params.id as string, { isActive: !course.isActive, adminComment: comment || course.adminComment });
      res.json(updated);
    } catch (error) { logger.error({ err: error }, "Error toggling course visibility"); res.status(500).json({ error: "Failed to update course" }); }
  });

  app.get("/api/admin/courses/all", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(await storage.getAllCourses()); }
    catch (error) { logger.error({ err: error }, "Error fetching all courses"); res.status(500).json({ error: "Failed to fetch courses" }); }
  });

  app.patch("/api/admin/courses/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { title, description, price, category, cover } = req.body;
      const updateData: any = {};
      if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length === 0) return res.status(400).json({ error: "Title cannot be empty" });
        updateData.title = title.trim();
      }
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ error: "Price must be a valid positive number" });
        updateData.price = numPrice;
      }
      if (category !== undefined) updateData.category = category;
      if (cover !== undefined) updateData.cover = cover;
      if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      const course = await storage.updateCourse(req.params.id as string, updateData);
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.json(course);
    } catch (error) { logger.error({ err: error }, "Error updating course (admin)"); res.status(500).json({ error: "Failed to update course" }); }
  });

  app.delete("/api/admin/courses/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      await storage.deleteCourse(req.params.id as string);
      res.status(204).send();
    } catch (error) { logger.error({ err: error }, "Error deleting course (admin)"); res.status(500).json({ error: "Failed to delete course" }); }
  });

  app.get("/api/admin/courses/:id/full", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const courseModules = await storage.getModulesByCourse(course.id);
      const allQuizzes = await storage.getQuizzesByCourse(course.id);
      const modulesWithDetails = await Promise.all(courseModules.map(async (mod) => {
        const lessons = await storage.getLessonsByModule(mod.id);
        const moduleQuizzes = allQuizzes.filter(q => q.moduleId === mod.id);
        const quizzesWithQuestions = await Promise.all(moduleQuizzes.map(async (quiz) => {
          const questions = await storage.getQuestionsByQuiz(quiz.id);
          return { ...quiz, questions };
        }));
        return { ...mod, lessons, quizzes: quizzesWithQuestions };
      }));
      res.json({ ...course, modules: modulesWithDetails });
    } catch (error) { logger.error({ err: error }, "Error fetching full course (admin)"); res.status(500).json({ error: "Failed to fetch course details" }); }
  });

  app.put("/api/admin/courses/:id/full", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const courseId = req.params.id as string;
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });

      const { title, description, category, level, price, certificateFee, cover, totalLessons, modules: newModules, labs: newLabs } = req.body;

      await storage.updateCourse(courseId, {
        title, description, category, level,
        price: typeof price === "number" ? price : parseFloat(price) || 0,
        certificateFee: typeof certificateFee === "number" ? certificateFee : parseFloat(certificateFee) || 100,
        cover, totalLessons,
      });

      const existingModules = await storage.getModulesByCourse(courseId);
      for (const mod of existingModules) {
        const moduleQuizzes = await storage.getQuizzesByModule(mod.id);
        for (const quiz of moduleQuizzes) {
          await storage.deleteQuestionsByQuiz(quiz.id);
          await storage.deleteQuiz(quiz.id);
        }
        await storage.deleteModule(mod.id);
      }

      const existingLabs = await storage.getLabsByCourse(courseId);
      for (const lab of existingLabs) { await storage.deleteLab(lab.id); }

      if (newModules && Array.isArray(newModules)) {
        for (const modData of newModules) {
          const mod = await storage.createModule({ courseId, title: modData.title, position: modData.position ?? 0 });
          if (modData.lessons && Array.isArray(modData.lessons)) {
            for (const lessonData of modData.lessons) {
              await storage.createLesson({
                moduleId: mod.id, courseId, title: lessonData.title,
                contentType: lessonData.contentType || "video",
                videoUrl: lessonData.videoUrl || null, textContent: lessonData.textContent || null,
                imageUrl: lessonData.imageUrl || null, voiceoverUrl: lessonData.voiceoverUrl || null,
                duration: lessonData.duration || null, position: lessonData.position ?? 0,
                isFreePreview: lessonData.isFreePreview || false,
              });
            }
          }
          if (modData.quizzes && Array.isArray(modData.quizzes)) {
            for (const quizData of modData.quizzes) {
              const quiz = await storage.createQuiz({
                moduleId: mod.id, courseId, title: quizData.title,
                quizType: quizData.quizType || "revision", passingScore: quizData.passingScore || 70,
                position: quizData.position ?? 0,
              });
              if (quizData.questions && Array.isArray(quizData.questions)) {
                for (const qData of quizData.questions) {
                  await storage.createQuizQuestion({
                    quizId: quiz.id, prompt: qData.prompt, options: qData.options,
                    correctIndex: qData.correctIndex ?? 0, explanation: qData.explanation || null,
                    position: qData.position ?? 0,
                  });
                }
              }
            }
          }
        }
      }

      if (newLabs && Array.isArray(newLabs)) {
        for (const labData of newLabs) {
          await storage.createLab({
            courseId, title: labData.title, instructions: labData.instructions,
            resources: labData.resources || null, position: labData.position ?? 0,
          });
        }
      }

      res.json(await storage.getCourse(courseId));
    } catch (error) { logger.error({ err: error }, "Error updating full course (admin)"); res.status(500).json({ error: "Failed to update course" }); }
  });

  // Admin: module CRUD
  app.patch("/api/admin/modules/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { title, position } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (position !== undefined) updateData.position = position;
      const mod = await storage.updateModule(req.params.id as string, updateData);
      if (!mod) return res.status(404).json({ error: "Module not found" });
      res.json(mod);
    } catch (error) { logger.error({ err: error }, "Error updating module (admin)"); res.status(500).json({ error: "Failed to update module" }); }
  });

  app.delete("/api/admin/modules/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteModule(req.params.id as string); res.status(204).send(); }
    catch (error) { logger.error({ err: error }, "Error deleting module (admin)"); res.status(500).json({ error: "Failed to delete module" }); }
  });

  app.post("/api/admin/modules", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { courseId, title, position } = req.body;
      res.json(await storage.createModule({ courseId, title, position: position ?? 0 }));
    } catch (error) { logger.error({ err: error }, "Error creating module (admin)"); res.status(500).json({ error: "Failed to create module" }); }
  });

  // Admin: lesson CRUD
  app.patch("/api/admin/lessons/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { title, contentType, videoUrl, imageUrl, textContent, duration, position, isFreePreview } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (contentType !== undefined) updateData.contentType = contentType;
      if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (textContent !== undefined) updateData.textContent = textContent;
      if (duration !== undefined) updateData.duration = duration;
      if (position !== undefined) updateData.position = position;
      if (isFreePreview !== undefined) updateData.isFreePreview = isFreePreview;
      const lesson = await storage.updateLesson(req.params.id as string, updateData);
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      res.json(lesson);
    } catch (error) { logger.error({ err: error }, "Error updating lesson (admin)"); res.status(500).json({ error: "Failed to update lesson" }); }
  });

  app.delete("/api/admin/lessons/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteLesson(req.params.id as string); res.status(204).send(); }
    catch (error) { logger.error({ err: error }, "Error deleting lesson (admin)"); res.status(500).json({ error: "Failed to delete lesson" }); }
  });

  app.post("/api/admin/lessons", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId, courseId, title, contentType, videoUrl, imageUrl, textContent, duration, position, isFreePreview } = req.body;
      res.json(await storage.createLesson({
        moduleId, courseId, title, contentType: contentType || "video",
        videoUrl: videoUrl || null, imageUrl: imageUrl || null,
        textContent: textContent || null, duration: duration || null,
        position: position ?? 0, isFreePreview: isFreePreview || false,
      }));
    } catch (error) { logger.error({ err: error }, "Error creating lesson (admin)"); res.status(500).json({ error: "Failed to create lesson" }); }
  });

  // Admin: quiz CRUD
  app.patch("/api/admin/quizzes/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { title, quizType, passingScore } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (quizType !== undefined) updateData.quizType = quizType;
      if (passingScore !== undefined) updateData.passingScore = passingScore;
      const quiz = await storage.updateQuiz(req.params.id as string, updateData);
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      res.json(quiz);
    } catch (error) { logger.error({ err: error }, "Error updating quiz (admin)"); res.status(500).json({ error: "Failed to update quiz" }); }
  });

  app.delete("/api/admin/quizzes/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteQuiz(req.params.id as string); res.status(204).send(); }
    catch (error) { logger.error({ err: error }, "Error deleting quiz (admin)"); res.status(500).json({ error: "Failed to delete quiz" }); }
  });

  app.post("/api/admin/quizzes", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId, courseId, title, quizType, passingScore, position } = req.body;
      res.json(await storage.createQuiz({
        moduleId, courseId, title, quizType: quizType || "revision",
        passingScore: passingScore ?? 70, position: position ?? 0,
      }));
    } catch (error) { logger.error({ err: error }, "Error creating quiz (admin)"); res.status(500).json({ error: "Failed to create quiz" }); }
  });

  // Admin: question CRUD
  app.patch("/api/admin/questions/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { prompt, options, correctIndex, explanation, position } = req.body;
      const updateData: any = {};
      if (prompt !== undefined) updateData.prompt = prompt;
      if (options !== undefined) updateData.options = options;
      if (correctIndex !== undefined) updateData.correctIndex = correctIndex;
      if (explanation !== undefined) updateData.explanation = explanation;
      if (position !== undefined) updateData.position = position;
      const question = await storage.updateQuizQuestion(req.params.id as string, updateData);
      if (!question) return res.status(404).json({ error: "Question not found" });
      res.json(question);
    } catch (error) { logger.error({ err: error }, "Error updating question (admin)"); res.status(500).json({ error: "Failed to update question" }); }
  });

  app.delete("/api/admin/questions/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteQuizQuestion(req.params.id as string); res.status(204).send(); }
    catch (error) { logger.error({ err: error }, "Error deleting question (admin)"); res.status(500).json({ error: "Failed to delete question" }); }
  });

  app.post("/api/admin/questions", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { quizId, prompt, options, correctIndex, explanation, position } = req.body;
      res.json(await storage.createQuizQuestion({
        quizId, prompt, options, correctIndex: correctIndex ?? 0,
        explanation: explanation || null, position: position ?? 0,
      }));
    } catch (error) { logger.error({ err: error }, "Error creating question (admin)"); res.status(500).json({ error: "Failed to create question" }); }
  });

  // Admin: analytics
  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const [counts, salesAgg, revenueBreakdown, pageViewsCount, topContent, uniqueSessions] = await Promise.all([
        storage.getAnalyticsCounts(), storage.getSalesAggregates(),
        storage.getBookCourseRevenueBreakdown(), storage.getPageViewsCount(),
        storage.getTopViewedContent(10), storage.getUniqueSessionsCount(),
      ]);
      res.json({
        totalUsers: counts.totalUsers, totalBooks: counts.totalBooks, totalCourses: counts.totalCourses,
        activeBooks: counts.activeBooks, activeCourses: counts.activeCourses,
        totalBookSales: revenueBreakdown.bookSalesCount, totalCourseSales: revenueBreakdown.courseSalesCount,
        totalPageViews: pageViewsCount, uniqueSessions, totalRevenue: salesAgg.totalRevenue,
        totalCommission: salesAgg.totalCommission, bookRevenue: revenueBreakdown.bookRevenue,
        courseRevenue: revenueBreakdown.courseRevenue, topContent,
      });
    } catch (error) { logger.error({ err: error }, "Error fetching admin analytics"); res.status(500).json({ error: "Failed to fetch analytics" }); }
  });

  // Admin: certificates
  app.get("/api/admin/certificates", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(await storage.getAllCertificates()); }
    catch (error) { logger.error({ err: error }, "Error fetching all certificates"); res.status(500).json({ error: "Failed to fetch certificates" }); }
  });

  app.get("/api/admin/certificates/:id/download", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const cert = await storage.getCertificateById(req.params.id as string);
      if (!cert) return res.status(404).json({ error: "Certificate not found" });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const verifyUrl = `${baseUrl}/verify/${cert.verificationToken}`;
      const course = await storage.getCourse(cert.courseId);
      const pdfBuffer = await generateCertificatePDF({
        studentName: cert.userName, courseTitle: cert.courseTitle,
        instructorName: cert.instructorName,
        completionDate: new Date(cert.issuedAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        verificationToken: cert.verificationToken, certificateId: cert.id,
        verifyUrl, courseLevel: course?.level || undefined,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="certificate-${cert.userName.replace(/[^a-zA-Z0-9]/g, '_')}-${cert.verificationToken}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) { logger.error({ err: error }, "Error downloading admin certificate PDF"); res.status(500).json({ error: "Failed to generate certificate PDF" }); }
  });

  // Admin: book analytics
  app.get("/api/admin/book-analytics", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try { res.json(await storage.getBookAnalytics()); }
    catch (error) { logger.error({ err: error }, "Error fetching book analytics"); res.status(500).json({ error: "Failed to fetch book analytics" }); }
  });

  // Admin: assign author
  app.post("/api/admin/books/:id/assign-author", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { authorId } = req.body;
      const book = await storage.updateBook(req.params.id as string, { authorId });
      if (!book) return res.status(404).json({ error: "Book not found" });
      res.json(book);
    } catch (error) { logger.error({ err: error }, "Error assigning author"); res.status(500).json({ error: "Failed to assign author" }); }
  });

  // Admin: migrate legacy books
  app.post("/api/admin/books/migrate-legacy", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const allBooks = await storage.getAllBooks();
      const legacyBooks = allBooks.filter((b: any) => !b.originalFileUrl && b.fileData && b.fileType);
      if (legacyBooks.length === 0) return res.json({ message: "No legacy books to migrate", migrated: 0 });
      const { uploadFileDataToStorage } = await import("../conversion-service");
      const { triggerConversion } = await import("../conversion-service");
      let migrated = 0;
      const results: any[] = [];
      for (const book of legacyBooks) {
        try {
          const objectPath = await uploadFileDataToStorage(book.fileData!, book.fileType!);
          await storage.updateBook(book.id, { originalFileUrl: objectPath, originalFormat: book.fileType, conversionStatus: "pending" });
          triggerConversion(book.id);
          migrated++;
          results.push({ id: book.id, title: book.title, status: "migrated" });
        } catch (err: any) {
          results.push({ id: book.id, title: book.title, status: "failed", error: err.message });
        }
      }
      res.json({ message: `Migrated ${migrated} of ${legacyBooks.length} legacy books`, migrated, results });
    } catch (error) { logger.error({ err: error }, "Error migrating legacy books"); res.status(500).json({ error: "Failed to migrate legacy books" }); }
  });
}
