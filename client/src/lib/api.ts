import type { Book, InsertBook, Sale, Settlement, Course } from "@shared/schema";

const API_BASE = "/api";

export async function fetchBooks(): Promise<Book[]> {
  const response = await fetch(`${API_BASE}/books`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch books");
  }
  return response.json();
}

export async function fetchBook(id: string): Promise<Book> {
  const response = await fetch(`${API_BASE}/books/${id}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch book");
  }
  return response.json();
}

export class PaymentRequiredError extends Error {
  uploadFee: number;
  constructor(message: string, uploadFee: number) {
    super(message);
    this.name = "PaymentRequiredError";
    this.uploadFee = uploadFee;
  }
}

export async function createBook(book: InsertBook & { paymentConfirmed?: boolean }): Promise<Book> {
  const response = await fetch(`${API_BASE}/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(book),
  });
  if (!response.ok) {
    if (response.status === 402) {
      const data = await response.json();
      throw new PaymentRequiredError(data.message, data.uploadFee);
    }
    throw new Error("Failed to create book");
  }
  return response.json();
}

export async function updateBook(id: string, updates: Partial<InsertBook>): Promise<Book> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error("Failed to update book");
  }
  return response.json();
}

export async function deleteBook(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete book");
  }
}

export async function renewBookSubscription(id: string): Promise<Book> {
  const response = await fetch(`${API_BASE}/books/${id}/renew-subscription`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to renew subscription");
  }
  return response.json();
}

export async function fetchSales(): Promise<Sale[]> {
  const response = await fetch(`${API_BASE}/sales`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch sales");
  }
  return response.json();
}

export async function createSale(sale: {
  bookId: string;
  buyerId?: string;
  sellerId: string;
  amount: number;
  paynowReference?: string;
}): Promise<Sale> {
  const response = await fetch(`${API_BASE}/sales`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(sale),
  });
  if (!response.ok) {
    throw new Error("Failed to record sale");
  }
  return response.json();
}

export async function fetchSettlements(): Promise<Settlement[]> {
  const response = await fetch(`${API_BASE}/admin/settlements`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch settlements");
  }
  return response.json();
}

export async function markSettlementPaid(id: string, paynowReference?: string): Promise<Settlement> {
  const response = await fetch(`${API_BASE}/admin/settlements/${id}/mark-paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ paynowReference }),
  });
  if (!response.ok) {
    throw new Error("Failed to mark settlement as paid");
  }
  return response.json();
}

export interface PaynowConfigResponse {
  configured: boolean;
  integrationId?: string;
  hasKey?: boolean;
}

export async function fetchPaynowConfig(): Promise<PaynowConfigResponse> {
  const response = await fetch(`${API_BASE}/paynow-config`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch Paynow config");
  }
  return response.json();
}

export async function savePaynowConfig(integrationId: string, integrationKey: string): Promise<PaynowConfigResponse> {
  const response = await fetch(`${API_BASE}/paynow-config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ integrationId, integrationKey }),
  });
  if (!response.ok) {
    throw new Error("Failed to save Paynow config");
  }
  return response.json();
}

export interface PricingInfo {
  uploadFee: number;
  monthlySubscription: number;
  commissionRate: number;
  minSettlement: number;
  firstBookFree: boolean;
}

export async function fetchPricing(): Promise<PricingInfo> {
  const response = await fetch(`${API_BASE}/pricing`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch pricing");
  }
  return response.json();
}

export interface AdminReportSales {
  totalRevenue: number;
  totalCommission: number;
  totalAuthorEarnings: number;
  salesCount: number;
  recentSales: Sale[];
}

export interface AdminReportSettlements {
  totalPending: number;
  totalPaid: number;
  pendingCount: number;
  paidCount: number;
  pendingSettlements: Settlement[];
}

export interface AdminReportBooks {
  totalBooks: number;
  activeBooks: number;
  expiredBooks: number;
  books: {
    id: string;
    title: string;
    author: string;
    authorId: string | null;
    subscriptionActive: boolean;
    price: number;
    createdAt: Date | null;
  }[];
}

export async function fetchAdminReportSales(): Promise<AdminReportSales> {
  const response = await fetch(`${API_BASE}/admin/reports/sales`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch sales report");
  }
  return response.json();
}

export async function fetchAdminReportSettlements(): Promise<AdminReportSettlements> {
  const response = await fetch(`${API_BASE}/admin/reports/settlements`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch settlements report");
  }
  return response.json();
}

export async function fetchAdminReportBooks(): Promise<AdminReportBooks> {
  const response = await fetch(`${API_BASE}/admin/reports/books`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch books report");
  }
  return response.json();
}

// Course API functions
export async function fetchCourses(): Promise<Course[]> {
  const response = await fetch(`${API_BASE}/courses`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch courses");
  return response.json();
}

export async function fetchCourse(id: string): Promise<any> {
  const response = await fetch(`${API_BASE}/courses/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch course");
  return response.json();
}

export async function createCourse(data: any): Promise<Course> {
  const response = await fetch(`${API_BASE}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 402) {
      const d = await response.json();
      throw new PaymentRequiredError(d.message, d.uploadFee);
    }
    throw new Error("Failed to create course");
  }
  return response.json();
}

export async function checkCoursePurchase(courseId: string, buyerToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/courses/purchases/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ courseId, buyerToken }),
  });
  const data = await response.json();
  return data.purchased;
}

export async function initiateCoursePayment(data: {
  courseId: string;
  buyerToken: string;
  email?: string;
  phone?: string;
  paymentMethod: string;
}): Promise<any> {
  const response = await fetch(`${API_BASE}/courses/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to initiate payment");
  return response.json();
}

export async function checkCoursePaymentStatus(data: {
  pollUrl: string;
  courseId: string;
  buyerToken: string;
  email?: string;
}): Promise<any> {
  const response = await fetch(`${API_BASE}/courses/payments/check-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function fetchLessonProgress(courseId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/progress`, { credentials: "include" });
  if (!response.ok) return [];
  return response.json();
}

export async function markLessonComplete(courseId: string, lessonId: string): Promise<void> {
  await fetch(`${API_BASE}/courses/${courseId}/lessons/${lessonId}/complete`, {
    method: "POST",
    credentials: "include",
  });
}

export async function fetchPendingCourses(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/admin/courses/pending`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch pending courses");
  return response.json();
}

export async function approveCourse(courseId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to approve course");
  return response.json();
}

export async function rejectCourse(courseId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to reject course");
  return response.json();
}

export async function fetchPendingBooks(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/admin/books/pending`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch pending books");
  return response.json();
}

export async function approveBook(bookId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/books/${bookId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to approve book");
  return response.json();
}

export async function rejectBook(bookId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/books/${bookId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to reject book");
  return response.json();
}

export async function toggleBookVisibility(bookId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/books/${bookId}/toggle-visibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to toggle book visibility");
  return response.json();
}

export async function toggleCourseVisibility(courseId: string, comment?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}/toggle-visibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ comment }),
  });
  if (!response.ok) throw new Error("Failed to toggle course visibility");
  return response.json();
}

export async function fetchAdminAllCourses(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/admin/courses/all`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch courses");
  return response.json();
}

export async function adminUpdateCourse(courseId: string, data: { title?: string; description?: string; price?: number; category?: string; cover?: string }): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update course");
  return response.json();
}

export async function adminDeleteCourse(courseId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete course");
}

export async function fetchAdminCourseFull(courseId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/courses/${courseId}/full`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch course details");
  return response.json();
}

async function adminApiCall(method: string, path: string, body?: any): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

export const adminUpdateModule = (id: string, data: any) => adminApiCall("PATCH", `/admin/modules/${id}`, data);
export const adminDeleteModule = (id: string) => adminApiCall("DELETE", `/admin/modules/${id}`);
export const adminCreateModule = (data: any) => adminApiCall("POST", `/admin/modules`, data);
export const adminUpdateLesson = (id: string, data: any) => adminApiCall("PATCH", `/admin/lessons/${id}`, data);
export const adminDeleteLesson = (id: string) => adminApiCall("DELETE", `/admin/lessons/${id}`);
export const adminCreateLesson = (data: any) => adminApiCall("POST", `/admin/lessons`, data);
export const adminUpdateQuiz = (id: string, data: any) => adminApiCall("PATCH", `/admin/quizzes/${id}`, data);
export const adminDeleteQuiz = (id: string) => adminApiCall("DELETE", `/admin/quizzes/${id}`);
export const adminCreateQuiz = (data: any) => adminApiCall("POST", `/admin/quizzes`, data);
export const adminUpdateQuestion = (id: string, data: any) => adminApiCall("PATCH", `/admin/questions/${id}`, data);
export const adminDeleteQuestion = (id: string) => adminApiCall("DELETE", `/admin/questions/${id}`);
export const adminCreateQuestion = (data: any) => adminApiCall("POST", `/admin/questions`, data);

export async function fetchAdminUsers(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

export async function toggleUserAdmin(userId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/admin/users/${userId}/toggle-admin`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to toggle admin");
  }
  return response.json();
}

export async function fetchCourseQuizzes(courseId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/quizzes`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch quizzes");
  return res.json();
}

export async function fetchQuizQuestions(quizId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/questions`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json();
}

export async function submitQuizAttempt(quizId: string, answers: number[], courseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ answers, courseId }),
  });
  if (!res.ok) throw new Error("Failed to submit quiz");
  return res.json();
}

export async function fetchBestQuizAttempt(quizId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/best-attempt`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch best attempt");
  return res.json();
}

export async function fetchCourseQuizAttempts(courseId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/quiz-attempts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch quiz attempts");
  return res.json();
}

export async function fetchCourseLabs(courseId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/labs`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch labs");
  return res.json();
}

export async function submitLabCompletion(labId: string, courseId: string, submissionText?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/labs/${labId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ courseId, submissionText }),
  });
  if (!res.ok) throw new Error("Failed to submit lab");
  return res.json();
}

export async function fetchLabSubmission(labId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/labs/${labId}/submission`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch submission");
  return res.json();
}

export async function fetchCourseCertificate(courseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/certificate`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch certificate");
  return res.json();
}

export async function generateCertificate(courseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/courses/${courseId}/certificate`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate certificate");
  }
  return res.json();
}

export async function verifyCertificate(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/certificates/verify/${token}`);
  if (!res.ok) throw new Error("Certificate not found");
  return res.json();
}

export async function initiateCertificatePayment(courseId: string, data: { email?: string; phone?: string; paymentMethod?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/certificates/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ courseId, ...data }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to initiate certificate payment");
  }
  return res.json();
}

export async function checkCertificatePaymentStatus(pollUrl: string, courseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/certificates/payments/check-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pollUrl, courseId }),
  });
  if (!res.ok) throw new Error("Failed to check certificate payment status");
  return res.json();
}

export interface AdminOverview {
  sales: {
    salesCount: number;
    totalSales: number;
    totalRevenue: number;
    totalCommission: number;
    totalAuthorEarnings: number;
    bookSalesCount?: number;
    courseSalesCount?: number;
    recentSales: any[];
  };
  settlements: {
    totalSettlements: number;
    pendingCount: number;
    paidCount: number;
    totalPending: number;
    totalPaid: number;
    settlements: any[];
  };
  books: {
    totalBooks: number;
    activeBooks: number;
    expiredBooks: number;
    pendingBooks: number;
    approvedBooks: number;
    books: any[];
  };
  courses?: {
    totalCourses: number;
    activeCourses: number;
    pendingCourses: number;
    totalCoursePurchases: number;
    courses: any[];
  };
  pendingBooks: any[];
  pendingCourses: any[];
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch(`${API_BASE}/admin/overview`, { credentials: "include" });
  if (!response.ok) {
    const err = await response.text();
    console.error("Admin overview fetch failed:", response.status, err);
    throw new Error(`Failed to fetch admin overview: ${response.status}`);
  }
  return response.json();
}

export async function fetchAdminAnalytics(): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/analytics`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function fetchAdminCertificates(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/certificates`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch certificates");
  return res.json();
}

export async function downloadAdminCertificate(certId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/certificates/${certId}/download`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to download certificate");
  return res.blob();
}

export async function fetchBookAnalytics(): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/book-analytics`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch book analytics");
  return res.json();
}
