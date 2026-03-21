import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, boolean, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table with auth, seller banking details, and admin fields
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSeller: boolean("is_seller").notNull().default(false),
  // Banking details for sellers
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountName: text("bank_account_name"),
  mobileMoneyNumber: text("mobile_money_number"),
  mobileMoneyProvider: text("mobile_money_provider"),
  // Paynow integration for receiving payments
  paynowIntegrationId: text("paynow_integration_id"),
  paynowIntegrationKey: text("paynow_integration_key"),
  firstFreeBookUsed: boolean("first_free_book_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  authorId: varchar("author_id"),
  cover: text("cover"),
  content: text("content").notNull(),
  fileData: text("file_data"),
  fileType: text("file_type"),
  sampleText: text("sample_text"),
  price: real("price").notNull().default(9.99),
  category: text("category").notNull().default("Indie"),
  rating: real("rating").notNull().default(0),
  bestseller: boolean("bestseller").notNull().default(false),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(false),
  adminComment: text("admin_comment"),
  subscriptionActive: boolean("subscription_active").notNull().default(true),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  uploadFeePaid: boolean("upload_fee_paid").notNull().default(false),
  originalFileUrl: text("original_file_url"),
  epubFileUrl: text("epub_file_url"),
  originalFormat: text("original_format"),
  conversionStatus: text("conversion_status").default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_books_author_id").on(table.authorId),
  index("idx_books_approved_active_sub").on(table.isApproved, table.isActive, table.subscriptionActive),
  index("idx_books_created_at").on(table.createdAt),
  index("idx_books_conversion_status").on(table.conversionStatus),
]);

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
});

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull(),
  buyerId: varchar("buyer_id"),
  sellerId: varchar("seller_id").notNull(),
  amount: real("amount").notNull(),
  commission: real("commission").notNull(),
  sellerEarnings: real("seller_earnings").notNull(),
  paynowReference: text("paynow_reference"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_sales_seller_id").on(table.sellerId),
  index("idx_sales_book_id").on(table.bookId),
  index("idx_sales_status").on(table.status),
  index("idx_sales_buyer_id").on(table.buyerId),
  index("idx_sales_created_at").on(table.createdAt),
]);

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  paidAt: timestamp("paid_at"),
  paynowReference: text("paynow_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_settlements_seller_id").on(table.sellerId),
  index("idx_settlements_status").on(table.status),
]);

export const insertSettlementSchema = createInsertSchema(settlements).omit({
  id: true,
  createdAt: true,
});

export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlements.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull(),
  userId: varchar("user_id").notNull(),
  monthlyFee: real("monthly_fee").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_subscriptions_book_id").on(table.bookId),
  index("idx_subscriptions_user_id").on(table.userId),
]);

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const paynowConfig = pgTable("paynow_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: text("integration_id").notNull(),
  integrationKey: text("integration_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaynowConfigSchema = createInsertSchema(paynowConfig).omit({
  id: true,
  createdAt: true,
});

export type InsertPaynowConfig = z.infer<typeof insertPaynowConfigSchema>;
export type PaynowConfig = typeof paynowConfig.$inferSelect;

export const pendingPayments = pgTable("pending_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull(),
  buyerToken: text("buyer_token").notNull(),
  email: text("email"),
  pollUrl: text("poll_url").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_pending_payments_book_id").on(table.bookId),
  index("idx_pending_payments_status").on(table.status),
]);

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull(),
  buyerToken: text("buyer_token").notNull(),
  email: text("email"),
  paynowReference: text("paynow_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_purchases_book_buyer").on(table.bookId, table.buyerToken),
  uniqueIndex("uniq_purchases_book_buyer").on(table.bookId, table.buyerToken),
]);

export const insertPendingPaymentSchema = createInsertSchema(pendingPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertPendingPayment = z.infer<typeof insertPendingPaymentSchema>;
export type PendingPayment = typeof pendingPayments.$inferSelect;

// Courses
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  instructorId: varchar("instructor_id").notNull(),
  instructorName: text("instructor_name").notNull(),
  cover: text("cover"),
  description: text("description"),
  price: real("price").notNull().default(29.99),
  category: text("category").notNull().default("Business"),
  level: text("level").notNull().default("Certificate"),
  isApproved: boolean("is_approved").notNull().default(false),
  adminComment: text("admin_comment"),
  isActive: boolean("is_active").notNull().default(true),
  subscriptionActive: boolean("subscription_active").notNull().default(true),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  uploadFeePaid: boolean("upload_fee_paid").notNull().default(false),
  totalLessons: integer("total_lessons").notNull().default(0),
  totalDuration: text("total_duration"),
  certificateFee: real("certificate_fee").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_courses_instructor_id").on(table.instructorId),
  index("idx_courses_approved_active_sub").on(table.isApproved, table.isActive, table.subscriptionActive),
  index("idx_courses_created_at").on(table.createdAt),
]);

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
}, (table) => [
  index("idx_modules_course_id").on(table.courseId),
]);

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
});

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

export const lessons = pgTable("lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  contentType: text("content_type").notNull().default("video"),
  videoUrl: text("video_url"),
  textContent: text("text_content"),
  imageUrl: text("image_url"),
  voiceoverUrl: text("voiceover_url"),
  duration: text("duration"),
  position: integer("position").notNull().default(0),
  isFreePreview: boolean("is_free_preview").notNull().default(false),
}, (table) => [
  index("idx_lessons_module_id").on(table.moduleId),
  index("idx_lessons_course_id").on(table.courseId),
]);

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
});

export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// Quizzes - used for revision exercises and module progress tests
export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  courseId: varchar("course_id").notNull(),
  lessonId: varchar("lesson_id"),
  title: text("title").notNull(),
  quizType: text("quiz_type").notNull().default("revision"),
  passingScore: integer("passing_score").notNull().default(70),
  position: integer("position").notNull().default(0),
}, (table) => [
  index("idx_quizzes_module_id").on(table.moduleId),
  index("idx_quizzes_course_id").on(table.courseId),
]);

export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

export const quizQuestions = pgTable("quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull(),
  prompt: text("prompt").notNull(),
  options: text("options").array().notNull(),
  correctIndex: integer("correct_index").notNull().default(0),
  explanation: text("explanation"),
  position: integer("position").notNull().default(0),
}, (table) => [
  index("idx_quiz_questions_quiz_id").on(table.quizId),
]);

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({ id: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;

export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull(),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  score: integer("score").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  answers: jsonb("answers"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => [
  index("idx_quiz_attempts_quiz_user").on(table.quizId, table.userId),
  index("idx_quiz_attempts_course_id").on(table.courseId),
]);

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({ id: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Labs - optional final exercise after all modules
export const labs = pgTable("labs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  resources: text("resources"),
  position: integer("position").notNull().default(0),
}, (table) => [
  index("idx_labs_course_id").on(table.courseId),
]);

export const insertLabSchema = createInsertSchema(labs).omit({ id: true });
export type InsertLab = z.infer<typeof insertLabSchema>;
export type Lab = typeof labs.$inferSelect;

export const labSubmissions = pgTable("lab_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  labId: varchar("lab_id").notNull(),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  submissionText: text("submission_text"),
  completed: boolean("completed").notNull().default(false),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lab_submissions_lab_user").on(table.labId, table.userId),
  index("idx_lab_submissions_course_id").on(table.courseId),
]);

export type LabSubmission = typeof labSubmissions.$inferSelect;

// Certificates - issued after course completion, verifiable via QR code
export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  courseTitle: text("course_title").notNull(),
  instructorName: text("instructor_name").notNull(),
  verificationToken: varchar("verification_token").notNull().unique(),
  paid: boolean("paid").notNull().default(false),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
}, (table) => [
  index("idx_certificates_course_user").on(table.courseId, table.userId),
]);

export const certificatePendingPayments = pgTable("certificate_pending_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  userId: varchar("user_id").notNull(),
  pollUrl: text("poll_url").notNull(),
  email: text("email"),
  amount: real("amount").notNull().default(100),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_cert_pending_course_user").on(table.courseId, table.userId),
]);

export const coursePurchases = pgTable("course_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  buyerToken: text("buyer_token").notNull(),
  email: text("email"),
  paynowReference: text("paynow_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_course_purchases_course_buyer").on(table.courseId, table.buyerToken),
  uniqueIndex("uniq_course_purchases_course_buyer").on(table.courseId, table.buyerToken),
]);

export type CoursePurchase = typeof coursePurchases.$inferSelect;

export const coursePendingPayments = pgTable("course_pending_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  buyerToken: text("buyer_token").notNull(),
  email: text("email"),
  pollUrl: text("poll_url").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_course_pending_course_id").on(table.courseId),
  index("idx_course_pending_status").on(table.status),
]);

export const lessonProgress = pgTable("lesson_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").notNull(),
  courseId: varchar("course_id").notNull(),
  userId: varchar("user_id").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_lesson_progress_course_user").on(table.courseId, table.userId),
  index("idx_lesson_progress_lesson_id").on(table.lessonId),
]);

export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  userId: varchar("user_id"),
  contentType: text("content_type"),
  contentId: varchar("content_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_page_views_content").on(table.contentType, table.contentId),
  index("idx_page_views_created_at").on(table.createdAt),
  index("idx_page_views_path").on(table.path),
  index("idx_page_views_session_id").on(table.sessionId),
]);

export const insertPageViewSchema = createInsertSchema(pageViews).omit({ id: true, createdAt: true });
export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type PageView = typeof pageViews.$inferSelect;
