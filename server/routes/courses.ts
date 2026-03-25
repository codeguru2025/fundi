import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage, db } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { UPLOAD_FEE, MONTHLY_SUBSCRIPTION, COMMISSION_RATE, DEFAULT_CERTIFICATE_FEE } from "./types";
import { logger } from "../index";

const lessonSchema = z.object({
  title: z.string().min(1, "Lesson title is required"),
  contentType: z.enum(["video", "text", "image", "presentation", "infographic"]).optional(),
  videoUrl: z.string().nullable().optional(),
  textContent: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  voiceoverUrl: z.string().nullable().optional(),
  duration: z.union([z.number(), z.string()]).nullable().optional(),
  isFreePreview: z.boolean().optional(),
});

const quizQuestionSchema = z.object({
  prompt: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).min(2, "At least 2 options required"),
  correctIndex: z.number().int().min(0),
  explanation: z.string().nullable().optional(),
});

const quizSchema = z.object({
  title: z.string().min(1, "Quiz title is required"),
  quizType: z.string().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  lessonId: z.string().nullable().optional(),
  questions: z.array(quizQuestionSchema).min(1, "Each quiz must have at least 1 question"),
});

const moduleSchema = z.object({
  title: z.string().min(1, "Module title is required"),
  lessons: z.array(lessonSchema).optional(),
  quizzes: z.array(quizSchema).optional(),
});

const labSchema = z.object({
  title: z.string().min(1, "Lab title is required"),
  instructions: z.string().min(1, "Lab instructions are required"),
  resources: z.string().nullable().optional(),
});

const createCourseSchema = z.object({
  title: z.string().min(1, "Course title is required").max(200),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  cover: z.string().nullable().optional(),
  certificateFee: z.union([z.number(), z.string()]).optional(),
  paymentConfirmed: z.boolean().optional(),
  instructorId: z.string().optional(),
  instructorName: z.string().optional(),
  isActive: z.boolean().optional(),
  subscriptionActive: z.boolean().optional(),
  uploadFeePaid: z.boolean().optional(),
  totalLessons: z.number().optional(),
  totalDuration: z.string().nullable().optional(),
  modules: z.array(moduleSchema).optional(),
  labs: z.array(labSchema).optional(),
});

export function registerCourseRoutes(app: Express, _httpServer: Server): void {
  // List courses
  app.get("/api/courses", async (req: Request, res: Response) => {
    try {
      const hasPageParam = req.query.page !== undefined;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const search = req.query.search as string || undefined;
      const category = req.query.category as string || undefined;
      if (!hasPageParam && !search && !category) return res.json(await storage.getActiveCourses());
      const result = await storage.getActiveCoursesPaginated(page, pageSize, search, category);
      res.json({ data: result.data, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
    } catch (error) { logger.error({ err: error }, "Error fetching courses"); res.status(500).json({ error: "Failed to fetch courses" }); }
  });

  // Instructor's courses
  app.get("/api/courses/instructor/mine", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      res.json(await storage.getCoursesByInstructor(userId));
    } catch (error) { logger.error({ err: error }, "Error fetching instructor courses"); res.status(500).json({ error: "Failed to fetch courses" }); }
  });

  // Single course with modules
  app.get("/api/courses/:id", async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const courseModules = await storage.getModulesByCourse(course.id);
      const courseLessons = await storage.getLessonsByCourse(course.id);
      const lessonsByModule = new Map<string, any[]>();
      for (const lesson of courseLessons) {
        if (!lessonsByModule.has(lesson.moduleId)) lessonsByModule.set(lesson.moduleId, []);
        lessonsByModule.get(lesson.moduleId)!.push(lesson);
      }
      const modulesWithLessons = courseModules.map(mod => ({ ...mod, lessons: lessonsByModule.get(mod.id) || [] }));
      res.json({ ...course, modules: modulesWithLessons, lessons: courseLessons });
    } catch (error) { logger.error({ err: error }, "Error fetching course"); res.status(500).json({ error: "Failed to fetch course" }); }
  });

  // Check course access
  app.get("/api/courses/:id/access", async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const userId = req.user?.id;
      const buyerToken = req.query.buyerToken as string | undefined;
      let isInstructor = false, isAdminUser = false;
      if (userId) {
        const user = await storage.getUser(userId);
        if (user?.isAdmin) isAdminUser = true;
        if (course.instructorId === userId) isInstructor = true;
      }
      let isPurchased = false;
      if (userId) isPurchased = await storage.hasCoursePurchased(course.id, userId);
      if (!isPurchased && buyerToken) isPurchased = await storage.hasCoursePurchased(course.id, buyerToken);
      let hasSale = false;
      if (!isPurchased) {
        const courseSales = await storage.getSalesByBook(course.id);
        const completedSales = courseSales.filter(s => s.status === 'completed');
        if (userId) hasSale = completedSales.some(s => s.buyerId === userId);
        if (!hasSale && buyerToken) hasSale = completedSales.some(s => s.buyerId === buyerToken);
      }
      const hasAccess = isInstructor || isAdminUser || isPurchased || hasSale;
      res.json({ isInstructor, isPurchased: isPurchased || hasSale, hasAccess });
    } catch (error) { logger.error({ err: error }, "Error checking course access"); res.status(500).json({ error: "Failed to check access" }); }
  });

  // Create course
  app.post("/api/courses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      const userIsAdmin = user.isAdmin === true;
      const parsed = createCourseSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn({ fields: parsed.error.flatten().fieldErrors }, "Course creation validation failed");
        return res.status(400).json({ error: "Invalid course data", details: parsed.error.flatten().fieldErrors });
      }
      const { title, description, price, category, level, cover, modules: courseModules, labs: courseLabs, certificateFee, paymentConfirmed, instructorId, instructorName, isActive, subscriptionActive, uploadFeePaid, totalLessons: clientTotalLessons, totalDuration } = parsed.data;
      const contentCount = await storage.getUserContentCount(userId);
      const isFirst = contentCount === 0;
      if (!userIsAdmin && !isFirst) {
        if (!paymentConfirmed) return res.status(402).json({ error: "Payment required", uploadFee: UPLOAD_FEE, message: `$${UPLOAD_FEE} upload fee required for additional content` });
      }
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      let totalLessons = 0;
      if (courseModules) { for (const mod of courseModules) { totalLessons += (mod.lessons || []).length; } }
      const { courses: coursesTable, modules: modulesTable, lessons: lessonsTable, quizzes: quizzesTable, quizQuestions: quizQuestionsTable, labs: labsTable } = await import("@shared/schema");
      const course = await db.transaction(async (tx: any) => {
        const [newCourse] = await tx.insert(coursesTable).values({
          title,
          instructorId: instructorId || userId,
          instructorName: instructorName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Instructor',
          description,
          price: price || 29.99,
          category: category || 'Business',
          level: level || 'Certificate',
          cover,
          isApproved: userIsAdmin,
          isActive: isActive !== false,
          subscriptionActive: subscriptionActive !== false,
          subscriptionExpiresAt: userIsAdmin ? null : oneMonthFromNow,
          uploadFeePaid: uploadFeePaid !== false,
          totalLessons: clientTotalLessons !== undefined ? clientTotalLessons : totalLessons,
          totalDuration: totalDuration || null,
          certificateFee: certificateFee != null ? parseFloat(String(certificateFee)) : DEFAULT_CERTIFICATE_FEE,
        }).returning();
        if (courseModules && Array.isArray(courseModules)) {
          for (let mIdx = 0; mIdx < courseModules.length; mIdx++) {
            const mod = courseModules[mIdx];
            const [createdModule] = await tx.insert(modulesTable).values({ courseId: newCourse.id, title: mod.title, position: mIdx }).returning();
            if (mod.lessons && Array.isArray(mod.lessons)) {
              for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
                const lesson = mod.lessons[lIdx];
                await tx.insert(lessonsTable).values({
                  moduleId: createdModule.id, courseId: newCourse.id, title: lesson.title,
                  contentType: lesson.contentType || 'video', videoUrl: lesson.videoUrl || null,
                  textContent: lesson.textContent || null, imageUrl: lesson.imageUrl || null,
                  voiceoverUrl: lesson.voiceoverUrl || null, duration: lesson.duration || null,
                  position: lIdx, isFreePreview: lesson.isFreePreview || false,
                });
              }
            }
            if (mod.quizzes && Array.isArray(mod.quizzes)) {
              for (let qIdx = 0; qIdx < mod.quizzes.length; qIdx++) {
                const quizData = mod.quizzes[qIdx];
                const [quiz] = await tx.insert(quizzesTable).values({
                  moduleId: createdModule.id, courseId: newCourse.id, lessonId: quizData.lessonId || null,
                  title: quizData.title, quizType: quizData.quizType || 'revision',
                  passingScore: quizData.passingScore || 70, position: qIdx,
                }).returning();
                if (quizData.questions && Array.isArray(quizData.questions)) {
                  for (let qiIdx = 0; qiIdx < quizData.questions.length; qiIdx++) {
                    const q = quizData.questions[qiIdx];
                    await tx.insert(quizQuestionsTable).values({
                      quizId: quiz.id, prompt: q.prompt, options: q.options,
                      correctIndex: q.correctIndex ?? 0, explanation: q.explanation || null, position: qiIdx,
                    });
                  }
                }
              }
            }
          }
        }
        if (courseLabs && Array.isArray(courseLabs)) {
          for (let lIdx = 0; lIdx < courseLabs.length; lIdx++) {
            const lab = courseLabs[lIdx];
            await tx.insert(labsTable).values({ courseId: newCourse.id, title: lab.title, instructions: lab.instructions, resources: lab.resources || null, position: lIdx });
          }
        }
        return newCourse;
      });
      res.status(201).json(course);
    } catch (error) { logger.error({ err: error }, "Error creating course"); res.status(500).json({ error: "Failed to create course" }); }
  });

  // Update course
  app.patch("/api/courses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userIsAdmin = req.user!.isAdmin === true;
      const existing = await storage.getCourse(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Course not found" });
      if (existing.instructorId !== userId && !userIsAdmin) return res.status(403).json({ error: "Not authorized to edit this course" });
      res.json(await storage.updateCourse(req.params.id as string, req.body));
    } catch (error) { logger.error({ err: error }, "Error updating course"); res.status(500).json({ error: "Failed to update course" }); }
  });

  // Delete course
  app.delete("/api/courses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userIsAdmin = req.user!.isAdmin === true;
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (course.instructorId !== userId && !userIsAdmin) return res.status(403).json({ error: "Not authorized to delete this course" });
      await storage.deleteCourse(req.params.id as string);
      res.status(204).send();
    } catch (error) { logger.error({ err: error }, "Error deleting course"); res.status(500).json({ error: "Failed to delete course" }); }
  });

  // Renew course subscription
  app.post("/api/courses/:id/renew-subscription", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (course.instructorId !== userId && !req.user!.isAdmin) return res.status(403).json({ error: "Not authorized" });
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      res.json(await storage.updateCourse(req.params.id as string, { subscriptionActive: true, isActive: true, subscriptionExpiresAt: oneMonthFromNow }));
    } catch (error) { logger.error({ err: error }, "Error renewing course subscription"); res.status(500).json({ error: "Failed to renew subscription" }); }
  });

  // Lesson progress
  app.get("/api/courses/:courseId/progress", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      res.json(await storage.getLessonProgress(req.params.courseId as string, userId));
    } catch (error) { logger.error({ err: error }, "Error fetching progress"); res.status(500).json({ error: "Failed to fetch progress" }); }
  });

  app.post("/api/courses/:courseId/lessons/:lessonId/complete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      await storage.markLessonComplete(req.params.lessonId as string, req.params.courseId as string, userId);
      res.json({ success: true });
    } catch (error) { logger.error({ err: error }, "Error marking lesson complete"); res.status(500).json({ error: "Failed to mark lesson complete" }); }
  });

  // Course publish check
  app.post("/api/publish/check-course", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const instructorId = req.user!.id || req.body.instructorId;
      const user = instructorId ? await storage.getUser(instructorId) : null;
      const userIsAdmin = user?.isAdmin === true;
      if (!instructorId) return res.json({ isFirst: true, uploadFee: 0, monthlyFee: MONTHLY_SUBSCRIPTION, commission: COMMISSION_RATE * 100, isAdmin: false });
      const contentCount = await storage.getUserContentCount(instructorId);
      const isFirst = contentCount === 0;
      res.json({ isFirst, uploadFee: userIsAdmin ? 0 : (isFirst ? 0 : UPLOAD_FEE), monthlyFee: userIsAdmin ? 0 : MONTHLY_SUBSCRIPTION, commission: COMMISSION_RATE * 100, isAdmin: userIsAdmin });
    } catch (error) { logger.error({ err: error }, "Error checking course publish requirements"); res.status(500).json({ error: "Failed to check requirements" }); }
  });
}
