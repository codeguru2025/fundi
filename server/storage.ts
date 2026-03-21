import { 
  type User, type InsertUser, type Book, type InsertBook, 
  type Sale, type InsertSale, type Settlement, type InsertSettlement,
  type PaynowConfig, type InsertPaynowConfig,
  type PendingPayment, type InsertPendingPayment,
  type Course, type InsertCourse, type Module, type InsertModule,
  type Lesson, type InsertLesson, type CoursePurchase,
  type Quiz, type InsertQuiz, type QuizQuestion, type InsertQuizQuestion,
  type QuizAttempt, type InsertQuizAttempt, type Lab, type InsertLab, type LabSubmission,
  type InsertPageView, type PageView,
  users, books, sales, settlements, paynowConfig, pendingPayments, purchases,
  courses, modules, lessons, coursePurchases, coursePendingPayments, lessonProgress,
  quizzes, quizQuestions, quizAttempts, labs, labSubmissions, certificates, certificatePendingPayments, pageViews
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lte, gte, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  getAllBooks(): Promise<Book[]>;
  getActiveBooks(): Promise<Book[]>;
  getFeaturedBooks(titles: string[]): Promise<Book[]>;
  getPendingBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: string): Promise<void>;
  getBooksByAuthor(authorId: string): Promise<Book[]>;
  
  createSale(sale: InsertSale): Promise<Sale>;
  getSalesBySeller(sellerId: string): Promise<Sale[]>;
  getSalesByBook(bookId: string): Promise<Sale[]>;
  getAllSales(): Promise<Sale[]>;
  getUnsettledSales(sellerId: string): Promise<Sale[]>;
  
  createSettlement(settlement: InsertSettlement): Promise<Settlement>;
  getPendingSettlements(): Promise<Settlement[]>;
  getAllSettlements(): Promise<Settlement[]>;
  updateSettlement(id: string, data: Partial<Settlement>): Promise<Settlement | undefined>;
  getSettlementsBySeller(sellerId: string): Promise<Settlement[]>;
  
  getPaynowConfig(): Promise<PaynowConfig | undefined>;
  savePaynowConfig(config: InsertPaynowConfig): Promise<PaynowConfig>;
  
  createPendingPayment(payment: InsertPendingPayment): Promise<PendingPayment>;
  getPendingPaymentByBookId(bookId: string): Promise<PendingPayment[]>;
  updatePendingPaymentStatus(id: string, status: string): Promise<void>;
  createPurchase(bookId: string, buyerToken: string, email?: string, paynowReference?: string): Promise<void>;
  hasPurchased(bookId: string, buyerToken: string): Promise<boolean>;
  confirmBookPayment(params: { bookId: string; buyerToken: string; email?: string; sellerId: string; amount: number; commission: number; sellerEarnings: number; paynowReference: string; pendingPaymentId: string }): Promise<{ saleCreated: boolean; purchaseCreated: boolean }>;
  
  checkExpiredSubscriptions(): Promise<void>;
  generateWeeklySettlements(minAmount: number, scheduledFor: Date): Promise<void>;
  getSellerEarnings(sellerId: string): Promise<number>;

  // Course methods
  getAllCourses(): Promise<Course[]>;
  getActiveCourses(): Promise<Course[]>;
  getPendingCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<void>;
  getCoursesByInstructor(instructorId: string): Promise<Course[]>;

  getModulesByCourse(courseId: string): Promise<Module[]>;
  createModule(mod: InsertModule): Promise<Module>;
  updateModule(id: string, data: Partial<InsertModule>): Promise<Module | undefined>;
  deleteModule(id: string): Promise<void>;

  getLessonsByModule(moduleId: string): Promise<Lesson[]>;
  getLessonsByCourse(courseId: string): Promise<Lesson[]>;
  getLesson(id: string): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: string, data: Partial<InsertLesson>): Promise<Lesson | undefined>;
  deleteLesson(id: string): Promise<void>;

  createCoursePurchase(courseId: string, buyerToken: string, email?: string, paynowReference?: string): Promise<void>;
  hasCoursePurchased(courseId: string, buyerToken: string): Promise<boolean>;
  confirmCoursePayment(params: { courseId: string; buyerToken: string; email?: string; sellerId: string; amount: number; commission: number; sellerEarnings: number; paynowReference: string; pendingPaymentId: string }): Promise<{ saleCreated: boolean; purchaseCreated: boolean }>;
  createCoursePendingPayment(courseId: string, buyerToken: string, pollUrl: string, amount: number, email?: string): Promise<any>;
  getCoursePendingPayments(courseId: string): Promise<any[]>;
  updateCoursePendingPaymentStatus(id: string, status: string): Promise<void>;

  getLessonProgress(courseId: string, userId: string): Promise<any[]>;
  markLessonComplete(lessonId: string, courseId: string, userId: string): Promise<void>;

  // Quiz methods
  getQuizzesByModule(moduleId: string): Promise<Quiz[]>;
  getQuizzesByCourse(courseId: string): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;

  getQuestionsByQuiz(quizId: string): Promise<QuizQuestion[]>;
  createQuizQuestion(question: InsertQuizQuestion): Promise<QuizQuestion>;
  updateQuizQuestion(id: string, data: Partial<InsertQuizQuestion>): Promise<QuizQuestion | undefined>;
  deleteQuizQuestion(id: string): Promise<void>;
  deleteQuestionsByQuiz(quizId: string): Promise<void>;

  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getQuizAttempts(quizId: string, userId: string): Promise<QuizAttempt[]>;
  getBestQuizAttempt(quizId: string, userId: string): Promise<QuizAttempt | undefined>;
  getQuizAttemptsByCourse(courseId: string, userId: string): Promise<QuizAttempt[]>;

  // Lab methods
  getLabsByCourse(courseId: string): Promise<Lab[]>;
  createLab(lab: InsertLab): Promise<Lab>;
  deleteLab(id: string): Promise<void>;
  getLabSubmission(labId: string, userId: string): Promise<LabSubmission | undefined>;
  createLabSubmission(labId: string, userId: string, courseId: string, submissionText?: string): Promise<LabSubmission>;

  // Certificate methods
  getCertificate(courseId: string, userId: string): Promise<any | undefined>;
  getCertificateByToken(token: string): Promise<any | undefined>;
  createCertificate(data: { courseId: string; userId: string; userName: string; courseTitle: string; instructorName: string; verificationToken: string }): Promise<any>;
  markCertificatePaid(courseId: string, userId: string, verificationToken?: string): Promise<any>;
  updateCertificate(id: string, data: Partial<{ paid: boolean; verificationToken: string }>): Promise<any>;
  getAllCertificates(): Promise<any[]>;
  getCertificateById(id: string): Promise<any | undefined>;
  createCertPendingPayment(data: { courseId: string; userId: string; email?: string; pollUrl: string; amount: number; paymentMethod?: string }): Promise<any>;
  getCertPendingPayments(courseId: string, userId: string): Promise<any[]>;
  markCertPendingPaymentCompleted(id: string): Promise<void>;

  getUserContentCount(userId: string): Promise<number>;
  getCoursePurchaseCount(courseId: string): Promise<number>;

  // Analytics methods
  trackPageView(view: InsertPageView): Promise<PageView>;
  getPageViewsByContent(contentType: string, contentId: string, days?: number): Promise<number>;
  getPageViewsByPath(path: string, days?: number): Promise<number>;
  getTotalPageViews(days?: number): Promise<number>;
  getUniqueVisitors(days?: number): Promise<number>;
  getTopPages(limit?: number, days?: number): Promise<{ path: string; count: number }[]>;
  getViewsOverTime(days?: number): Promise<{ date: string; count: number }[]>;
  getContentViews(contentType: string, contentIds: string[], days?: number): Promise<{ contentId: string; count: number }[]>;
  getViewsOverTimeForContent(contentType: string, contentIds: string[], days?: number): Promise<{ date: string; count: number }[]>;

  getAllCoursePurchases(): Promise<any[]>;
  getPageViewsCount(): Promise<number>;
  getTopViewedContent(limit: number): Promise<any[]>;
  getUniqueSessionsCount(): Promise<number>;
  getAnalyticsCounts(): Promise<{ totalUsers: number; totalBooks: number; totalCourses: number; activeBooks: number; activeCourses: number }>;
  getBookCourseRevenueBreakdown(): Promise<{ bookRevenue: number; courseRevenue: number; bookCommission: number; courseCommission: number; bookSalesCount: number; courseSalesCount: number }>;
  getBookAnalytics(): Promise<{ books: any[]; summary: { totalBooks: number; activeBooks: number; totalSales: number; totalRevenue: number; totalCommission: number } }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllBooks(): Promise<Book[]> {
    return await db.select().from(books).orderBy(desc(books.createdAt));
  }

  async getActiveBooks(): Promise<Book[]> {
    return await db.select().from(books)
      .where(and(eq(books.isActive, true), eq(books.isApproved, true), eq(books.subscriptionActive, true)))
      .orderBy(desc(books.createdAt));
  }

  async getFeaturedBooks(titles: string[]): Promise<Book[]> {
    if (titles.length === 0) return [];
    const allBooks = await db.select().from(books)
      .where(and(eq(books.isActive, true), eq(books.isApproved, true), eq(books.subscriptionActive, true)))
      .orderBy(desc(books.createdAt));
    return allBooks.filter(b => 
      titles.some(t => b.title.toLowerCase().trim() === t.toLowerCase().trim())
    );
  }

  async getPendingBooks(): Promise<Book[]> {
    return await db.select().from(books)
      .where(eq(books.isApproved, false))
      .orderBy(desc(books.createdAt));
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }

  async createBook(book: InsertBook): Promise<Book> {
    const [newBook] = await db.insert(books).values(book).returning();
    return newBook;
  }

  async updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined> {
    const [updated] = await db
      .update(books)
      .set(book)
      .where(eq(books.id, id))
      .returning();
    return updated;
  }

  async deleteBook(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(pendingPayments).where(eq(pendingPayments.bookId, id));
      await tx.delete(purchases).where(eq(purchases.bookId, id));
      await tx.delete(sales).where(eq(sales.bookId, id));
      await tx.delete(books).where(eq(books.id, id));
    });
  }

  async getBooksByAuthor(authorId: string): Promise<Book[]> {
    return await db.select().from(books)
      .where(eq(books.authorId, authorId))
      .orderBy(desc(books.createdAt));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [newSale] = await db.insert(sales).values(sale).returning();
    return newSale;
  }

  async getSalesBySeller(sellerId: string): Promise<Sale[]> {
    return await db.select().from(sales)
      .where(eq(sales.sellerId, sellerId))
      .orderBy(desc(sales.createdAt));
  }

  async getSalesByBook(bookId: string): Promise<Sale[]> {
    return await db.select().from(sales)
      .where(eq(sales.bookId, bookId))
      .orderBy(desc(sales.createdAt));
  }

  async getAllSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getUnsettledSales(sellerId: string): Promise<Sale[]> {
    return await db.select().from(sales)
      .where(and(
        eq(sales.sellerId, sellerId),
        eq(sales.status, "completed")
      ))
      .orderBy(desc(sales.createdAt));
  }

  async createSettlement(settlement: InsertSettlement): Promise<Settlement> {
    const [newSettlement] = await db.insert(settlements).values(settlement).returning();
    return newSettlement;
  }

  async getPendingSettlements(): Promise<Settlement[]> {
    return await db.select().from(settlements)
      .where(eq(settlements.status, "pending"))
      .orderBy(desc(settlements.scheduledFor));
  }

  async getAllSettlements(): Promise<Settlement[]> {
    return await db.select().from(settlements)
      .orderBy(desc(settlements.scheduledFor));
  }

  async updateSettlement(id: string, data: Partial<Settlement>): Promise<Settlement | undefined> {
    const [updated] = await db.update(settlements).set(data).where(eq(settlements.id, id)).returning();
    return updated;
  }

  async getSettlementsBySeller(sellerId: string): Promise<Settlement[]> {
    return await db.select().from(settlements)
      .where(eq(settlements.sellerId, sellerId))
      .orderBy(desc(settlements.createdAt));
  }

  async getPaynowConfig(): Promise<PaynowConfig | undefined> {
    const [config] = await db.select().from(paynowConfig)
      .where(eq(paynowConfig.isActive, true))
      .limit(1);
    return config;
  }

  async savePaynowConfig(config: InsertPaynowConfig): Promise<PaynowConfig> {
    await db.update(paynowConfig).set({ isActive: false });
    const [newConfig] = await db.insert(paynowConfig).values(config).returning();
    return newConfig;
  }

  async checkExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    await db.update(books)
      .set({ subscriptionActive: false, isActive: false })
      .where(and(
        eq(books.subscriptionActive, true),
        lte(books.subscriptionExpiresAt, now)
      ));
    await db.update(courses)
      .set({ subscriptionActive: false, isActive: false })
      .where(and(
        eq(courses.subscriptionActive, true),
        lte(courses.subscriptionExpiresAt, now)
      ));
  }

  async getSellerEarnings(sellerId: string): Promise<number> {
    const result = await db.select({
      total: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
    }).from(sales).where(and(
      eq(sales.sellerId, sellerId),
      eq(sales.status, "completed")
    ));
    return result[0]?.total || 0;
  }

  async generateWeeklySettlements(minAmount: number, scheduledFor: Date): Promise<void> {
    const earningsBySeller = await db.select({
      sellerId: sales.sellerId,
      total: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
    }).from(sales)
      .where(eq(sales.status, "completed"))
      .groupBy(sales.sellerId);
    
    for (const { sellerId, total } of earningsBySeller) {
      if (total >= minAmount) {
        await db.transaction(async (tx) => {
          const existingPending = await tx.select().from(settlements)
            .where(and(
              eq(settlements.sellerId, sellerId),
              eq(settlements.status, "pending")
            ));
          
          if (existingPending.length === 0) {
            await tx.insert(settlements).values({
              sellerId,
              amount: total,
              status: "pending",
              scheduledFor,
            });
            
            await tx.update(sales)
              .set({ status: "settled" })
              .where(and(
                eq(sales.sellerId, sellerId),
                eq(sales.status, "completed")
              ));
          }
        });
      }
    }
  }

  async createPendingPayment(payment: InsertPendingPayment): Promise<PendingPayment> {
    const [created] = await db.insert(pendingPayments).values(payment).returning();
    return created;
  }

  async getPendingPaymentByBookId(bookId: string): Promise<PendingPayment[]> {
    return await db.select().from(pendingPayments)
      .where(and(
        eq(pendingPayments.bookId, bookId),
        eq(pendingPayments.status, "pending")
      ))
      .orderBy(desc(pendingPayments.createdAt));
  }

  async updatePendingPaymentStatus(id: string, status: string): Promise<void> {
    await db.update(pendingPayments)
      .set({ status })
      .where(eq(pendingPayments.id, id));
  }

  async createPurchase(bookId: string, buyerToken: string, email?: string, paynowReference?: string): Promise<void> {
    await db.insert(purchases).values({
      bookId,
      buyerToken,
      email: email || null,
      paynowReference: paynowReference || null,
    });
  }

  async hasPurchased(bookId: string, buyerToken: string): Promise<boolean> {
    const [purchase] = await db.select()
      .from(purchases)
      .where(and(
        eq(purchases.bookId, bookId),
        eq(purchases.buyerToken, buyerToken)
      ));
    return !!purchase;
  }

  async confirmBookPayment(params: {
    bookId: string;
    buyerToken: string;
    email?: string;
    sellerId: string;
    amount: number;
    commission: number;
    sellerEarnings: number;
    paynowReference: string;
    pendingPaymentId: string;
  }): Promise<{ saleCreated: boolean; purchaseCreated: boolean }> {
    return await db.transaction(async (tx) => {
      let saleCreated = false;
      let purchaseCreated = false;

      const [existingSale] = await tx.select().from(sales)
        .where(and(
          eq(sales.bookId, params.bookId),
          eq(sales.buyerId, params.buyerToken),
          eq(sales.status, "completed")
        ));

      if (!existingSale) {
        await tx.insert(sales).values({
          bookId: params.bookId,
          buyerId: params.buyerToken,
          sellerId: params.sellerId,
          amount: params.amount,
          commission: params.commission,
          sellerEarnings: params.sellerEarnings,
          paynowReference: params.paynowReference,
          status: "completed",
        });
        saleCreated = true;
      }

      const [existingPurchase] = await tx.select().from(purchases)
        .where(and(
          eq(purchases.bookId, params.bookId),
          eq(purchases.buyerToken, params.buyerToken)
        ));

      if (!existingPurchase) {
        await tx.insert(purchases).values({
          bookId: params.bookId,
          buyerToken: params.buyerToken,
          email: params.email || null,
          paynowReference: params.paynowReference,
        });
        purchaseCreated = true;
      }

      await tx.update(pendingPayments)
        .set({ status: "completed" })
        .where(eq(pendingPayments.id, params.pendingPaymentId));

      return { saleCreated, purchaseCreated };
    });
  }

  // Course methods
  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  async getActiveCourses(): Promise<Course[]> {
    return await db.select().from(courses)
      .where(and(eq(courses.isApproved, true), eq(courses.isActive, true), eq(courses.subscriptionActive, true)))
      .orderBy(desc(courses.createdAt));
  }

  async getPendingCourses(): Promise<Course[]> {
    return await db.select().from(courses)
      .where(eq(courses.isApproved, false))
      .orderBy(desc(courses.createdAt));
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await db.update(courses).set(data).where(eq(courses.id, id)).returning();
    return updated;
  }

  async deleteCourse(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const courseModules = await tx.select().from(modules).where(eq(modules.courseId, id));

      for (const mod of courseModules) {
        const moduleQuizzes = await tx.select().from(quizzes).where(eq(quizzes.moduleId, mod.id));
        for (const quiz of moduleQuizzes) {
          await tx.delete(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
          await tx.delete(quizAttempts).where(eq(quizAttempts.quizId, quiz.id));
        }
        await tx.delete(quizzes).where(eq(quizzes.moduleId, mod.id));
      }

      await tx.delete(lessonProgress).where(eq(lessonProgress.courseId, id));
      await tx.delete(labSubmissions).where(eq(labSubmissions.courseId, id));
      await tx.delete(certificates).where(eq(certificates.courseId, id));
      await tx.delete(coursePurchases).where(eq(coursePurchases.courseId, id));
      await tx.delete(coursePendingPayments).where(eq(coursePendingPayments.courseId, id));
      await tx.delete(labs).where(eq(labs.courseId, id));
      await tx.delete(lessons).where(eq(lessons.courseId, id));
      await tx.delete(modules).where(eq(modules.courseId, id));
      await tx.delete(courses).where(eq(courses.id, id));
    });
  }

  async getCoursesByInstructor(instructorId: string): Promise<Course[]> {
    return await db.select().from(courses)
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(courses.createdAt));
  }

  async getModulesByCourse(courseId: string): Promise<Module[]> {
    return await db.select().from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(modules.position);
  }

  async createModule(mod: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(mod).returning();
    return newModule;
  }

  async updateModule(id: string, data: Partial<InsertModule>): Promise<Module | undefined> {
    const [updated] = await db.update(modules).set(data).where(eq(modules.id, id)).returning();
    return updated;
  }

  async deleteModule(id: string): Promise<void> {
    await db.delete(lessons).where(eq(lessons.moduleId, id));
    await db.delete(modules).where(eq(modules.id, id));
  }

  async getLessonsByModule(moduleId: string): Promise<Lesson[]> {
    return await db.select().from(lessons)
      .where(eq(lessons.moduleId, moduleId))
      .orderBy(lessons.position);
  }

  async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
    return await db.select().from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(lessons.position);
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  async updateLesson(id: string, data: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const [updated] = await db.update(lessons).set(data).where(eq(lessons.id, id)).returning();
    return updated;
  }

  async deleteLesson(id: string): Promise<void> {
    await db.delete(lessons).where(eq(lessons.id, id));
  }

  async createCoursePurchase(courseId: string, buyerToken: string, email?: string, paynowReference?: string): Promise<void> {
    await db.insert(coursePurchases).values({
      courseId,
      buyerToken,
      email: email || null,
      paynowReference: paynowReference || null,
    });
  }

  async hasCoursePurchased(courseId: string, buyerToken: string): Promise<boolean> {
    const [purchase] = await db.select()
      .from(coursePurchases)
      .where(and(
        eq(coursePurchases.courseId, courseId),
        eq(coursePurchases.buyerToken, buyerToken)
      ));
    return !!purchase;
  }

  async confirmCoursePayment(params: {
    courseId: string;
    buyerToken: string;
    email?: string;
    sellerId: string;
    amount: number;
    commission: number;
    sellerEarnings: number;
    paynowReference: string;
    pendingPaymentId: string;
  }): Promise<{ saleCreated: boolean; purchaseCreated: boolean }> {
    return await db.transaction(async (tx) => {
      let saleCreated = false;
      let purchaseCreated = false;

      const [existingSale] = await tx.select().from(sales)
        .where(and(
          eq(sales.bookId, params.courseId),
          eq(sales.buyerId, params.buyerToken),
          eq(sales.status, "completed")
        ));

      if (!existingSale) {
        await tx.insert(sales).values({
          bookId: params.courseId,
          buyerId: params.buyerToken,
          sellerId: params.sellerId,
          amount: params.amount,
          commission: params.commission,
          sellerEarnings: params.sellerEarnings,
          paynowReference: params.paynowReference,
          status: "completed",
        });
        saleCreated = true;
      }

      const [existingPurchase] = await tx.select().from(coursePurchases)
        .where(and(
          eq(coursePurchases.courseId, params.courseId),
          eq(coursePurchases.buyerToken, params.buyerToken)
        ));

      if (!existingPurchase) {
        await tx.insert(coursePurchases).values({
          courseId: params.courseId,
          buyerToken: params.buyerToken,
          email: params.email || null,
          paynowReference: params.paynowReference,
        });
        purchaseCreated = true;
      }

      await tx.update(coursePendingPayments)
        .set({ status: "completed" })
        .where(eq(coursePendingPayments.id, params.pendingPaymentId));

      return { saleCreated, purchaseCreated };
    });
  }

  async createCoursePendingPayment(courseId: string, buyerToken: string, pollUrl: string, amount: number, email?: string) {
    const [created] = await db.insert(coursePendingPayments).values({
      courseId,
      buyerToken,
      pollUrl,
      amount,
      email: email || null,
      status: "pending",
    }).returning();
    return created;
  }

  async getCoursePendingPayments(courseId: string) {
    return await db.select().from(coursePendingPayments)
      .where(and(
        eq(coursePendingPayments.courseId, courseId),
        eq(coursePendingPayments.status, "pending")
      ))
      .orderBy(desc(coursePendingPayments.createdAt));
  }

  async updateCoursePendingPaymentStatus(id: string, status: string): Promise<void> {
    await db.update(coursePendingPayments)
      .set({ status })
      .where(eq(coursePendingPayments.id, id));
  }

  async getLessonProgress(courseId: string, userId: string) {
    return await db.select().from(lessonProgress)
      .where(and(
        eq(lessonProgress.courseId, courseId),
        eq(lessonProgress.userId, userId)
      ));
  }

  async markLessonComplete(lessonId: string, courseId: string, userId: string): Promise<void> {
    const existing = await db.select().from(lessonProgress)
      .where(and(
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.userId, userId)
      ));
    
    if (existing.length === 0) {
      await db.insert(lessonProgress).values({
        lessonId,
        courseId,
        userId,
        completed: true,
        completedAt: new Date(),
      });
    } else {
      await db.update(lessonProgress)
        .set({ completed: true, completedAt: new Date() })
        .where(and(
          eq(lessonProgress.lessonId, lessonId),
          eq(lessonProgress.userId, userId)
        ));
    }
  }

  // Quiz methods
  async getQuizzesByModule(moduleId: string): Promise<Quiz[]> {
    return await db.select().from(quizzes)
      .where(eq(quizzes.moduleId, moduleId))
      .orderBy(quizzes.position);
  }

  async getQuizzesByCourse(courseId: string): Promise<Quiz[]> {
    return await db.select().from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .orderBy(quizzes.position);
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return quiz;
  }

  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const [newQuiz] = await db.insert(quizzes).values(quiz).returning();
    return newQuiz;
  }

  async updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const [updated] = await db.update(quizzes).set(data).where(eq(quizzes.id, id)).returning();
    return updated;
  }

  async deleteQuiz(id: string): Promise<void> {
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
    await db.delete(quizzes).where(eq(quizzes.id, id));
  }

  async getQuestionsByQuiz(quizId: string): Promise<QuizQuestion[]> {
    return await db.select().from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position);
  }

  async createQuizQuestion(question: InsertQuizQuestion): Promise<QuizQuestion> {
    const [newQuestion] = await db.insert(quizQuestions).values(question).returning();
    return newQuestion;
  }

  async updateQuizQuestion(id: string, data: Partial<InsertQuizQuestion>): Promise<QuizQuestion | undefined> {
    const [updated] = await db.update(quizQuestions).set(data).where(eq(quizQuestions.id, id)).returning();
    return updated;
  }

  async deleteQuizQuestion(id: string): Promise<void> {
    await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
  }

  async deleteQuestionsByQuiz(quizId: string): Promise<void> {
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  }

  async createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const [newAttempt] = await db.insert(quizAttempts).values(attempt).returning();
    return newAttempt;
  }

  async getQuizAttempts(quizId: string, userId: string): Promise<QuizAttempt[]> {
    return await db.select().from(quizAttempts)
      .where(and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.userId, userId)
      ))
      .orderBy(desc(quizAttempts.completedAt));
  }

  async getBestQuizAttempt(quizId: string, userId: string): Promise<QuizAttempt | undefined> {
    const [best] = await db.select().from(quizAttempts)
      .where(and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.userId, userId)
      ))
      .orderBy(desc(quizAttempts.score))
      .limit(1);
    return best;
  }

  async getQuizAttemptsByCourse(courseId: string, userId: string): Promise<QuizAttempt[]> {
    return await db.select().from(quizAttempts)
      .where(and(
        eq(quizAttempts.courseId, courseId),
        eq(quizAttempts.userId, userId)
      ))
      .orderBy(desc(quizAttempts.completedAt));
  }

  // Lab methods
  async getLabsByCourse(courseId: string): Promise<Lab[]> {
    return await db.select().from(labs)
      .where(eq(labs.courseId, courseId))
      .orderBy(labs.position);
  }

  async createLab(lab: InsertLab): Promise<Lab> {
    const [newLab] = await db.insert(labs).values(lab).returning();
    return newLab;
  }

  async deleteLab(id: string): Promise<void> {
    await db.delete(labSubmissions).where(eq(labSubmissions.labId, id));
    await db.delete(labs).where(eq(labs.id, id));
  }

  async getLabSubmission(labId: string, userId: string): Promise<LabSubmission | undefined> {
    const [submission] = await db.select().from(labSubmissions)
      .where(and(
        eq(labSubmissions.labId, labId),
        eq(labSubmissions.userId, userId)
      ));
    return submission;
  }

  async createLabSubmission(labId: string, userId: string, courseId: string, submissionText?: string): Promise<LabSubmission> {
    const [submission] = await db.insert(labSubmissions).values({
      labId,
      userId,
      courseId,
      submissionText: submissionText || null,
      completed: true,
    }).returning();
    return submission;
  }

  // Certificate methods
  async getCertificate(courseId: string, userId: string): Promise<any | undefined> {
    const [cert] = await db.select().from(certificates)
      .where(and(
        eq(certificates.courseId, courseId),
        eq(certificates.userId, userId)
      ));
    return cert;
  }

  async getCertificateByToken(token: string): Promise<any | undefined> {
    const [cert] = await db.select().from(certificates)
      .where(eq(certificates.verificationToken, token));
    return cert;
  }

  async createCertificate(data: { courseId: string; userId: string; userName: string; courseTitle: string; instructorName: string; verificationToken: string }): Promise<any> {
    const [cert] = await db.insert(certificates).values(data).returning();
    return cert;
  }

  async markCertificatePaid(courseId: string, userId: string, verificationToken?: string): Promise<any> {
    const updates: any = { paid: true };
    if (verificationToken) updates.verificationToken = verificationToken;
    const [cert] = await db.update(certificates)
      .set(updates)
      .where(and(eq(certificates.courseId, courseId), eq(certificates.userId, userId)))
      .returning();
    return cert;
  }

  async updateCertificate(id: string, data: Partial<{ paid: boolean; verificationToken: string }>): Promise<any> {
    const [cert] = await db.update(certificates)
      .set(data)
      .where(eq(certificates.id, id))
      .returning();
    return cert;
  }

  async getAllCertificates(): Promise<any[]> {
    return db.select().from(certificates).orderBy(certificates.issuedAt);
  }

  async getCertificateById(id: string): Promise<any | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert;
  }

  async createCertPendingPayment(data: { courseId: string; userId: string; email?: string; pollUrl: string; amount: number; paymentMethod?: string }): Promise<any> {
    const [pp] = await db.insert(certificatePendingPayments).values(data).returning();
    return pp;
  }

  async getCertPendingPayments(courseId: string, userId: string): Promise<any[]> {
    return db.select().from(certificatePendingPayments)
      .where(and(
        eq(certificatePendingPayments.courseId, courseId),
        eq(certificatePendingPayments.userId, userId),
        eq(certificatePendingPayments.status, "pending")
      ));
  }

  async markCertPendingPaymentCompleted(id: string): Promise<void> {
    await db.update(certificatePendingPayments)
      .set({ status: "completed" })
      .where(eq(certificatePendingPayments.id, id));
  }

  // Analytics methods
  async trackPageView(view: InsertPageView): Promise<PageView> {
    const [pv] = await db.insert(pageViews).values(view).returning();
    return pv;
  }

  private getDaysAgoDate(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getPageViewsByContent(contentType: string, contentId: string, days = 30): Promise<number> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(pageViews)
      .where(and(
        eq(pageViews.contentType, contentType),
        eq(pageViews.contentId, contentId),
        gte(pageViews.createdAt, since)
      ));
    return result[0]?.count || 0;
  }

  async getPageViewsByPath(path: string, days = 30): Promise<number> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(pageViews)
      .where(and(
        eq(pageViews.path, path),
        gte(pageViews.createdAt, since)
      ));
    return result[0]?.count || 0;
  }

  async getTotalPageViews(days = 30): Promise<number> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(pageViews)
      .where(gte(pageViews.createdAt, since));
    return result[0]?.count || 0;
  }

  async getUniqueVisitors(days = 30): Promise<number> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({ count: sql<number>`count(distinct ${pageViews.sessionId})::int` }).from(pageViews)
      .where(gte(pageViews.createdAt, since));
    return result[0]?.count || 0;
  }

  async getTopPages(limit = 10, days = 30): Promise<{ path: string; count: number }[]> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({
      path: pageViews.path,
      count: sql<number>`count(*)::int`,
    }).from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(pageViews.path)
      .orderBy(sql`count(*) desc`)
      .limit(limit);
    return result;
  }

  async getViewsOverTime(days = 30): Promise<{ date: string; count: number }[]> {
    const since = this.getDaysAgoDate(days);
    const result = await db.select({
      date: sql<string>`to_char(${pageViews.createdAt}::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    }).from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(sql`${pageViews.createdAt}::date`)
      .orderBy(sql`${pageViews.createdAt}::date`);
    return result;
  }

  async getContentViews(contentType: string, contentIds: string[], days = 30): Promise<{ contentId: string; count: number }[]> {
    if (contentIds.length === 0) return [];
    const since = this.getDaysAgoDate(days);
    const result = await db.select({
      contentId: pageViews.contentId,
      count: sql<number>`count(*)::int`,
    }).from(pageViews)
      .where(and(
        eq(pageViews.contentType, contentType),
        inArray(pageViews.contentId, contentIds),
        gte(pageViews.createdAt, since)
      ))
      .groupBy(pageViews.contentId);
    return result.map(r => ({ contentId: r.contentId || '', count: r.count }));
  }

  async getViewsOverTimeForContent(contentType: string, contentIds: string[], days = 30): Promise<{ date: string; count: number }[]> {
    if (contentIds.length === 0) return [];
    const since = this.getDaysAgoDate(days);
    const result = await db.select({
      date: sql<string>`to_char(${pageViews.createdAt}::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    }).from(pageViews)
      .where(and(
        eq(pageViews.contentType, contentType),
        inArray(pageViews.contentId, contentIds),
        gte(pageViews.createdAt, since)
      ))
      .groupBy(sql`${pageViews.createdAt}::date`)
      .orderBy(sql`${pageViews.createdAt}::date`);
    return result;
  }

  async getCoursePurchaseCount(courseId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(coursePurchases)
      .where(eq(coursePurchases.courseId, courseId));
    return result[0]?.count || 0;
  }

  async getAllCoursePurchases() {
    return await db.select().from(coursePurchases);
  }

  async getPageViewsCount() {
    const result = await db.select({ count: sql<number>`count(*)` }).from(pageViews);
    return Number(result[0]?.count || 0);
  }

  async getTopViewedContent(limit: number) {
    const result = await db.select({
      path: pageViews.path,
      contentType: pageViews.contentType,
      views: sql<number>`count(*)`,
    }).from(pageViews)
      .where(sql`${pageViews.contentType} IS NOT NULL`)
      .groupBy(pageViews.path, pageViews.contentType)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);
    return result;
  }

  async getUniqueSessionsCount() {
    const result = await db.select({ count: sql<number>`count(distinct ${pageViews.sessionId})` }).from(pageViews);
    return Number(result[0]?.count || 0);
  }

  async getSalesAggregates(): Promise<{
    totalRevenue: number;
    totalCommission: number;
    totalSellerEarnings: number;
    salesCount: number;
  }> {
    const result = await db.select({
      totalRevenue: sql<number>`coalesce(sum(${sales.amount}), 0)::real`,
      totalCommission: sql<number>`coalesce(sum(${sales.commission}), 0)::real`,
      totalSellerEarnings: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
      salesCount: sql<number>`count(*)::int`,
    }).from(sales);
    return result[0] || { totalRevenue: 0, totalCommission: 0, totalSellerEarnings: 0, salesCount: 0 };
  }

  async getSettlementAggregates(): Promise<{
    totalSettlements: number;
    pendingCount: number;
    paidCount: number;
    totalPending: number;
    totalPaid: number;
  }> {
    const result = await db.select({
      totalSettlements: sql<number>`count(*)::int`,
      pendingCount: sql<number>`count(*) filter (where ${settlements.status} = 'pending')::int`,
      paidCount: sql<number>`count(*) filter (where ${settlements.status} = 'paid')::int`,
      totalPending: sql<number>`coalesce(sum(${settlements.amount}) filter (where ${settlements.status} = 'pending'), 0)::real`,
      totalPaid: sql<number>`coalesce(sum(${settlements.amount}) filter (where ${settlements.status} = 'paid'), 0)::real`,
    }).from(settlements);
    return result[0] || { totalSettlements: 0, pendingCount: 0, paidCount: 0, totalPending: 0, totalPaid: 0 };
  }

  async getBookCounts(): Promise<{
    totalBooks: number;
    activeBooks: number;
    expiredBooks: number;
    pendingBooks: number;
    approvedBooks: number;
  }> {
    const result = await db.select({
      totalBooks: sql<number>`count(*)::int`,
      activeBooks: sql<number>`count(*) filter (where ${books.isActive} = true and ${books.isApproved} = true and ${books.subscriptionActive} = true)::int`,
      expiredBooks: sql<number>`count(*) filter (where ${books.isActive} = false or ${books.subscriptionActive} = false)::int`,
      pendingBooks: sql<number>`count(*) filter (where ${books.isApproved} = false)::int`,
      approvedBooks: sql<number>`count(*) filter (where ${books.isApproved} = true)::int`,
    }).from(books);
    return result[0] || { totalBooks: 0, activeBooks: 0, expiredBooks: 0, pendingBooks: 0, approvedBooks: 0 };
  }

  async getCourseCounts(): Promise<{
    totalCourses: number;
    activeCourses: number;
    pendingCourses: number;
  }> {
    const result = await db.select({
      totalCourses: sql<number>`count(*)::int`,
      activeCourses: sql<number>`count(*) filter (where ${courses.isActive} = true and ${courses.isApproved} = true)::int`,
      pendingCourses: sql<number>`count(*) filter (where ${courses.isApproved} = false)::int`,
    }).from(courses);
    return result[0] || { totalCourses: 0, activeCourses: 0, pendingCourses: 0 };
  }

  async getCoursePurchaseTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(coursePurchases);
    return result[0]?.count || 0;
  }

  async getRecentSales(limit = 20): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt)).limit(limit);
  }

  async getSellerSalesAggregates(sellerId: string): Promise<{
    totalRevenue: number;
    totalCommission: number;
    salesCount: number;
  }> {
    const result = await db.select({
      totalRevenue: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
      totalCommission: sql<number>`coalesce(sum(${sales.commission}), 0)::real`,
      salesCount: sql<number>`count(*)::int`,
    }).from(sales).where(eq(sales.sellerId, sellerId));
    return result[0] || { totalRevenue: 0, totalCommission: 0, salesCount: 0 };
  }

  async getSellerSalesByBook(sellerId: string): Promise<{ bookId: string; salesCount: number; revenue: number }[]> {
    return await db.select({
      bookId: sales.bookId,
      salesCount: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
    }).from(sales)
      .where(eq(sales.sellerId, sellerId))
      .groupBy(sales.bookId);
  }

  async getCoursePurchaseCountsBatch(courseIds: string[]): Promise<{ courseId: string; count: number }[]> {
    if (courseIds.length === 0) return [];
    return await db.select({
      courseId: coursePurchases.courseId,
      count: sql<number>`count(*)::int`,
    }).from(coursePurchases)
      .where(inArray(coursePurchases.courseId, courseIds))
      .groupBy(coursePurchases.courseId);
  }

  async getSellerEarningsSQL(sellerId: string): Promise<number> {
    const result = await db.select({
      total: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
    }).from(sales).where(and(
      eq(sales.sellerId, sellerId),
      eq(sales.status, "completed")
    ));
    return result[0]?.total || 0;
  }

  async getSettlementEarningsBySeller(): Promise<{ sellerId: string; total: number }[]> {
    return await db.select({
      sellerId: sales.sellerId,
      total: sql<number>`coalesce(sum(${sales.sellerEarnings}), 0)::real`,
    }).from(sales)
      .where(eq(sales.status, "completed"))
      .groupBy(sales.sellerId);
  }

  async getBooksPaginated(page: number, pageSize: number, filters?: { isApproved?: boolean; isActive?: boolean }): Promise<{ data: Book[]; total: number }> {
    const conditions = [];
    if (filters?.isApproved !== undefined) conditions.push(eq(books.isApproved, filters.isApproved));
    if (filters?.isActive !== undefined) conditions.push(eq(books.isActive, filters.isActive));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(books).where(whereClause);
    const data = await db.select().from(books)
      .where(whereClause)
      .orderBy(desc(books.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: countResult?.count || 0 };
  }

  async getCoursesPaginated(page: number, pageSize: number, filters?: { isApproved?: boolean; isActive?: boolean }): Promise<{ data: Course[]; total: number }> {
    const conditions = [];
    if (filters?.isApproved !== undefined) conditions.push(eq(courses.isApproved, filters.isApproved));
    if (filters?.isActive !== undefined) conditions.push(eq(courses.isActive, filters.isActive));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(courses).where(whereClause);
    const data = await db.select().from(courses)
      .where(whereClause)
      .orderBy(desc(courses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: countResult?.count || 0 };
  }

  async getActiveBooksPaginated(page: number, pageSize: number, search?: string, category?: string): Promise<{ data: Book[]; total: number }> {
    const conditions = [
      eq(books.isActive, true),
      eq(books.isApproved, true),
      eq(books.subscriptionActive, true),
    ];
    if (category && category !== 'all') conditions.push(eq(books.category, category));
    if (search) conditions.push(sql`(lower(${books.title}) like ${'%' + search.toLowerCase() + '%'} or lower(${books.author}) like ${'%' + search.toLowerCase() + '%'})`);

    const whereClause = and(...conditions);

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(books).where(whereClause);
    const data = await db.select().from(books)
      .where(whereClause)
      .orderBy(desc(books.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: countResult?.count || 0 };
  }

  async getActiveCoursesPaginated(page: number, pageSize: number, search?: string, category?: string): Promise<{ data: Course[]; total: number }> {
    const conditions = [
      eq(courses.isApproved, true),
      eq(courses.isActive, true),
      eq(courses.subscriptionActive, true),
    ];
    if (category && category !== 'all') conditions.push(eq(courses.category, category));
    if (search) conditions.push(sql`(lower(${courses.title}) like ${'%' + search.toLowerCase() + '%'} or lower(${courses.instructorName}) like ${'%' + search.toLowerCase() + '%'})`);

    const whereClause = and(...conditions);

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(courses).where(whereClause);
    const data = await db.select().from(courses)
      .where(whereClause)
      .orderBy(desc(courses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: countResult?.count || 0 };
  }

  async getSalesPaginated(page: number, pageSize: number): Promise<{ data: Sale[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sales);
    const data = await db.select().from(sales)
      .orderBy(desc(sales.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { data, total: countResult?.count || 0 };
  }

  async getEnrichedSalesPaginated(page: number, pageSize: number): Promise<{ data: any[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sales);
    const result = await db.execute(sql`
      SELECT s.*,
        CASE
          WHEN b.id IS NOT NULL THEN b.title
          WHEN c.id IS NOT NULL THEN c.title
          ELSE s.book_id
        END AS item_title,
        CASE
          WHEN b.id IS NOT NULL THEN 'book'
          WHEN c.id IS NOT NULL THEN 'course'
          ELSE 'unknown'
        END AS item_type
      FROM sales s
      LEFT JOIN books b ON b.id = s.book_id
      LEFT JOIN courses c ON c.id = s.book_id
      ORDER BY s.created_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `);
    const rows = (result as any).rows || result;
    const data = (rows as any[]).map((r: any) => ({
      id: r.id,
      bookId: r.book_id,
      buyerId: r.buyer_id,
      sellerId: r.seller_id,
      amount: r.amount,
      commission: r.commission,
      sellerEarnings: r.seller_earnings,
      paynowReference: r.paynow_reference,
      status: r.status,
      createdAt: r.created_at,
      itemTitle: r.item_title,
      itemType: r.item_type,
    }));
    return { data, total: countResult?.count || 0 };
  }

  async getSettlementsPaginated(page: number, pageSize: number): Promise<{ data: Settlement[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(settlements);
    const data = await db.select().from(settlements)
      .orderBy(desc(settlements.scheduledFor))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { data, total: countResult?.count || 0 };
  }

  async getAnalyticsCounts(): Promise<{ totalUsers: number; totalBooks: number; totalCourses: number; activeBooks: number; activeCourses: number }> {
    const [usersCount, booksCount, coursesCount, activeBooksCount, activeCoursesCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(books),
      db.select({ count: sql<number>`count(*)::int` }).from(courses),
      db.select({ count: sql<number>`count(*)::int` }).from(books).where(and(eq(books.isActive, true), eq(books.subscriptionActive, true))),
      db.select({ count: sql<number>`count(*)::int` }).from(courses).where(and(eq(courses.isActive, true), eq(courses.subscriptionActive, true))),
    ]);
    return {
      totalUsers: usersCount[0]?.count || 0,
      totalBooks: booksCount[0]?.count || 0,
      totalCourses: coursesCount[0]?.count || 0,
      activeBooks: activeBooksCount[0]?.count || 0,
      activeCourses: activeCoursesCount[0]?.count || 0,
    };
  }

  async getBookAnalytics(): Promise<{ books: any[]; summary: { totalBooks: number; activeBooks: number; totalSales: number; totalRevenue: number; totalCommission: number } }> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const [bookRows, summaryResult, viewsResult] = await Promise.all([
      db.execute(sql`
        SELECT b.id, b.title, b.author, b.price, b.cover, b.is_active, b.subscription_active, b.is_approved, b.created_at,
          coalesce(s.sale_count, 0)::int AS total_sales,
          coalesce(s.total_revenue, 0)::real AS total_revenue,
          coalesce(s.total_commission, 0)::real AS total_commission,
          coalesce(s.total_revenue - s.total_commission, 0)::real AS seller_earnings
        FROM books b
        LEFT JOIN (
          SELECT book_id, count(*) AS sale_count, sum(amount) AS total_revenue, sum(commission) AS total_commission
          FROM sales GROUP BY book_id
        ) s ON s.book_id = b.id
        ORDER BY coalesce(s.total_revenue, 0) DESC
      `),
      db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM books) AS total_books,
          (SELECT count(*)::int FROM books WHERE is_active = true AND subscription_active = true) AS active_books,
          coalesce(sum(s.amount), 0)::real AS total_revenue,
          coalesce(sum(s.commission), 0)::real AS total_commission,
          count(*)::int AS total_sales
        FROM sales s
        INNER JOIN books b ON b.id = s.book_id
      `),
      db.execute(sql`
        SELECT content_id, count(*)::int AS views
        FROM page_views
        WHERE content_type = 'book' AND created_at >= ${cutoff}
        GROUP BY content_id
      `),
    ]);
    const rows = (bookRows as any).rows || bookRows;
    const sum = ((summaryResult as any).rows || summaryResult)?.[0] || {};
    const viewRows = (viewsResult as any).rows || viewsResult;
    const viewsMap: Record<string, number> = {};
    for (const v of viewRows) {
      viewsMap[v.content_id] = Number(v.views || 0);
    }
    return {
      books: rows.map((r: any) => {
        const views = viewsMap[r.id] || 0;
        return {
          id: r.id, title: r.title, author: r.author, price: r.price,
          coverUrl: r.cover, isActive: r.is_active, subscriptionActive: r.subscription_active,
          isApproved: r.is_approved, createdAt: r.created_at,
          totalSales: r.total_sales, totalRevenue: r.total_revenue,
          totalCommission: r.total_commission, sellerEarnings: r.seller_earnings,
          views, conversionRate: views > 0 ? ((r.total_sales / views) * 100).toFixed(1) : "0.0",
        };
      }),
      summary: {
        totalBooks: Number(sum.total_books || 0),
        activeBooks: Number(sum.active_books || 0),
        totalSales: Number(sum.total_sales || 0),
        totalRevenue: Number(sum.total_revenue || 0),
        totalCommission: Number(sum.total_commission || 0),
      },
    };
  }

  async getUserContentCount(userId: string): Promise<number> {
    const [bookCount] = await db.select({ count: sql<number>`count(*)::int` }).from(books).where(eq(books.authorId, userId));
    const [courseCount] = await db.select({ count: sql<number>`count(*)::int` }).from(courses).where(eq(courses.instructorId, userId));
    return (bookCount?.count || 0) + (courseCount?.count || 0);
  }

  async getBookCourseRevenueBreakdown(): Promise<{ bookRevenue: number; courseRevenue: number; bookCommission: number; courseCommission: number; bookSalesCount: number; courseSalesCount: number }> {
    const result = await db.execute(sql`
      SELECT
        coalesce(sum(CASE WHEN b.id IS NOT NULL THEN s.amount ELSE 0 END), 0)::real AS book_revenue,
        coalesce(sum(CASE WHEN c.id IS NOT NULL THEN s.amount ELSE 0 END), 0)::real AS course_revenue,
        coalesce(sum(CASE WHEN b.id IS NOT NULL THEN s.commission ELSE 0 END), 0)::real AS book_commission,
        coalesce(sum(CASE WHEN c.id IS NOT NULL THEN s.commission ELSE 0 END), 0)::real AS course_commission,
        coalesce(sum(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS book_sales_count,
        coalesce(sum(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS course_sales_count
      FROM sales s
      LEFT JOIN books b ON b.id = s.book_id
      LEFT JOIN courses c ON c.id = s.book_id
    `);
    const row = (result as any).rows?.[0] || (result as any)[0] || {};
    return {
      bookRevenue: Number(row.book_revenue || 0),
      courseRevenue: Number(row.course_revenue || 0),
      bookCommission: Number(row.book_commission || 0),
      courseCommission: Number(row.course_commission || 0),
      bookSalesCount: Number(row.book_sales_count || 0),
      courseSalesCount: Number(row.course_sales_count || 0),
    };
  }
}

export { db };
export const storage = new DatabaseStorage();
