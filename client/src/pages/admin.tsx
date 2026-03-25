import React, { useState } from "react";
import { csrfHeaders } from "@/lib/csrf";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { 
  fetchPaynowConfig, savePaynowConfig, fetchSettlements, fetchSales,
  markSettlementPaid, type PaynowConfigResponse,
  fetchAdminReportSales, fetchAdminReportSettlements, fetchAdminReportBooks,
  fetchAdminUsers, toggleUserAdmin,
  fetchPendingCourses, approveCourse, rejectCourse,
  fetchPendingBooks, approveBook, rejectBook,
  toggleBookVisibility, toggleCourseVisibility,
  fetchAdminAnalytics,
  fetchAdminCertificates,
  downloadAdminCertificate,
  fetchBookAnalytics,
  fetchAdminAllCourses, adminUpdateCourse, adminDeleteCourse,
  fetchAdminCourseFull,
  adminUpdateModule, adminDeleteModule, adminCreateModule,
  adminUpdateLesson, adminDeleteLesson, adminCreateLesson,
  adminUpdateQuiz, adminDeleteQuiz, adminCreateQuiz,
  adminUpdateQuestion, adminDeleteQuestion, adminCreateQuestion,
  fetchAdminOverview, type AdminOverview,
} from "@/lib/api";
import { Settings, DollarSign, CreditCard, Check, Clock, AlertCircle, BarChart3, BookOpen, TrendingUp, ShieldAlert, LogIn, Users, Shield, ShieldOff, GraduationCap, CheckCircle, XCircle, Activity, Eye, EyeOff, Globe, Layers, MessageSquare, Pencil, Trash2, Save, X, Award, Download, FileText, ExternalLink, RefreshCw } from "lucide-react";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-4">
              Admin Access Required
            </h1>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Please sign in to access the admin dashboard.
            </p>
            <Button asChild size="lg" className="text-lg px-8" data-testid="button-signin-admin">
              <a href="/api/login">
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </a>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="bg-destructive/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-destructive mb-4">
              Access Denied
            </h1>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              You do not have permission to access the admin dashboard. 
              Contact the platform administrator if you believe this is an error.
            </p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchOnWindowFocus: true,
    staleTime: 5000,
    retry: 3,
  });

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3" data-testid="text-admin-title">
            <Settings className="w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Manage payments, settlements, and platform settings</p>
          {overviewError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm" data-testid="text-overview-error">
              Failed to load dashboard data. Please refresh the page. ({(overviewError as Error).message})
            </div>
          )}
        </div>

        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="moderation">Content Moderation</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="book-analytics">Book Analytics</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
            <TabsTrigger value="sales">Sales Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="grant-access">Grant Access</TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <ReportsSection overview={overview} isLoading={overviewLoading} />
          </TabsContent>

          <TabsContent value="moderation">
            <ContentModerationSection overview={overview} isLoading={overviewLoading} />
          </TabsContent>

          <TabsContent value="users">
            <UsersSection />
          </TabsContent>

          <TabsContent value="certificates">
            <CertificatesSection />
          </TabsContent>

          <TabsContent value="book-analytics">
            <BookAnalyticsSection />
          </TabsContent>

          <TabsContent value="settlements">
            <SettlementsSection />
          </TabsContent>

          <TabsContent value="sales">
            <SalesSection />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsSection />
          </TabsContent>

          <TabsContent value="grant-access">
            <GrantAccessSection />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function ContentModerationSection({ overview, isLoading: overviewLoading }: { overview?: AdminOverview; isLoading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});

  const pendingBooks = overview?.pendingBooks || [];
  const pendingCourses = overview?.pendingCourses || [];
  const loadingBooks = overviewLoading;
  const loadingCourses = overviewLoading;
  const approvedBooks = overview?.books?.books?.filter((b: any) => b.isApproved) || [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const approveBookMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => approveBook(id, comment),
    onSuccess: () => { invalidateAll(); toast({ title: "Book approved", description: "The book is now visible in the store." }); },
    onError: () => { toast({ title: "Error", description: "Failed to approve book", variant: "destructive" }); },
  });

  const rejectBookMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => rejectBook(id, comment),
    onSuccess: () => { invalidateAll(); toast({ title: "Book rejected", description: "The publisher has been notified to fix and resubmit." }); },
    onError: () => { toast({ title: "Error", description: "Failed to reject book", variant: "destructive" }); },
  });

  const toggleBookMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => toggleBookVisibility(id, comment),
    onSuccess: (data: any) => { invalidateAll(); toast({ title: data.isActive ? "Book visible" : "Book hidden", description: data.isActive ? "Book is now visible in the store." : "Book has been removed from the store." }); },
    onError: () => { toast({ title: "Error", description: "Failed to update book", variant: "destructive" }); },
  });

  const approveCourseMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => approveCourse(id, comment),
    onSuccess: () => { invalidateAll(); toast({ title: "Course approved", description: "The course is now visible in the marketplace." }); },
    onError: () => { toast({ title: "Error", description: "Failed to approve course", variant: "destructive" }); },
  });

  const rejectCourseMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => rejectCourse(id, comment),
    onSuccess: () => { invalidateAll(); toast({ title: "Course rejected", description: "The instructor has been notified to fix and resubmit." }); },
    onError: () => { toast({ title: "Error", description: "Failed to reject course", variant: "destructive" }); },
  });

  const toggleCourseMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => toggleCourseVisibility(id, comment),
    onSuccess: (data: any) => { invalidateAll(); toast({ title: data.isActive ? "Course visible" : "Course hidden", description: data.isActive ? "Course is now visible." : "Course has been removed from marketplace." }); },
    onError: () => { toast({ title: "Error", description: "Failed to update course", variant: "destructive" }); },
  });

  const getComment = (id: string) => commentMap[id] || "";
  const setComment = (id: string, value: string) => setCommentMap(prev => ({ ...prev, [id]: value }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Pending Books ({pendingBooks?.length || 0})
          </CardTitle>
          <CardDescription>Review books before they appear in the store. Add feedback for publishers if content doesn't meet standards.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBooks ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !pendingBooks?.length ? (
            <div className="text-center py-6">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">No books pending approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBooks.map((book: any) => (
                <div key={book.id} className="p-4 border rounded-lg space-y-3" data-testid={`pending-book-${book.id}`}>
                  <div className="flex items-start gap-4">
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} className="w-16 h-20 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-20 bg-muted rounded flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold" data-testid={`text-book-title-${book.id}`}>{book.title}</h3>
                      <p className="text-sm text-muted-foreground">by {book.author}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{book.category}</Badge>
                        <Badge variant="outline">${book.price}</Badge>
                      </div>
                      {book.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{book.description}</p>}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Add feedback for the publisher (optional for approval, recommended for rejection)..."
                    value={getComment(book.id)}
                    onChange={(e) => setComment(book.id, e.target.value)}
                    className="text-sm"
                    data-testid={`input-comment-book-${book.id}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { approveBookMutation.mutate({ id: book.id, comment: getComment(book.id) }); setComment(book.id, ""); }} disabled={approveBookMutation.isPending} data-testid={`button-approve-book-${book.id}`}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { rejectBookMutation.mutate({ id: book.id, comment: getComment(book.id) }); setComment(book.id, ""); }} disabled={rejectBookMutation.isPending} data-testid={`button-reject-book-${book.id}`}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Pending Courses ({pendingCourses?.length || 0})
          </CardTitle>
          <CardDescription>Review courses before they appear in the marketplace. Add feedback for instructors if improvements are needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCourses ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !pendingCourses?.length ? (
            <div className="text-center py-6">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">No courses pending approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCourses.map((course: any) => (
                <div key={course.id} className="p-4 border rounded-lg space-y-3" data-testid={`pending-course-${course.id}`}>
                  <div className="flex items-start gap-4">
                    {course.cover ? (
                      <img src={course.cover} alt={course.title} className="w-20 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-20 h-14 bg-muted rounded flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold" data-testid={`text-course-title-${course.id}`}>{course.title}</h3>
                      <p className="text-sm text-muted-foreground">by {course.instructorName}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{course.category}</Badge>
                        <Badge variant="outline">${course.price}</Badge>
                        <Badge variant="outline">{course.totalLessons} lessons</Badge>
                      </div>
                      {course.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Add feedback for the instructor (optional for approval, recommended for rejection)..."
                    value={getComment(course.id)}
                    onChange={(e) => setComment(course.id, e.target.value)}
                    className="text-sm"
                    data-testid={`input-comment-course-${course.id}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { approveCourseMutation.mutate({ id: course.id, comment: getComment(course.id) }); setComment(course.id, ""); }} disabled={approveCourseMutation.isPending} data-testid={`button-approve-course-${course.id}`}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { rejectCourseMutation.mutate({ id: course.id, comment: getComment(course.id) }); setComment(course.id, ""); }} disabled={rejectCourseMutation.isPending} data-testid={`button-reject-course-${course.id}`}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Manage Published Content
          </CardTitle>
          <CardDescription>Toggle visibility of approved books and courses. Remove content that doesn't meet standards with feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          {approvedBooks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No approved books yet.</p>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Books</h3>
              {approvedBooks.map((book: any) => (
                <div key={book.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`manage-book-${book.id}`}>
                  <div className="flex items-center gap-3">
                    <Badge variant={book.isActive ? "default" : "secondary"} className="text-xs">
                      {book.isActive ? "Visible" : "Hidden"}
                    </Badge>
                    <span className="font-medium text-sm">{book.title}</span>
                    <span className="text-xs text-muted-foreground">by {book.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Reason..."
                      className="w-48 h-8 text-xs"
                      value={getComment(`vis-${book.id}`)}
                      onChange={(e) => setComment(`vis-${book.id}`, e.target.value)}
                      data-testid={`input-visibility-comment-book-${book.id}`}
                    />
                    <Button
                      size="sm"
                      variant={book.isActive ? "destructive" : "default"}
                      onClick={() => { toggleBookMutation.mutate({ id: book.id, comment: getComment(`vis-${book.id}`) }); setComment(`vis-${book.id}`, ""); }}
                      disabled={toggleBookMutation.isPending}
                      data-testid={`button-toggle-book-${book.id}`}
                    >
                      {book.isActive ? <><EyeOff className="w-3 h-3 mr-1" /> Hide</> : <><Eye className="w-3 h-3 mr-1" /> Show</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CourseManagementSection />
    </div>
  );
}

function AdminCourseFullEditor({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: fullCourse, isLoading, refetch } = useQuery({
    queryKey: ["admin-course-full", courseId],
    queryFn: () => fetchAdminCourseFull(courseId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-all-courses"] });
    queryClient.invalidateQueries({ queryKey: ["admin-course-full", courseId] });
  };

  const [editForm, setEditForm] = useState<{ title: string; description: string; price: string; category: string; cover: string }>({ title: "", description: "", price: "", category: "", cover: "" });
  const [coverUploading, setCoverUploading] = useState(false);

  React.useEffect(() => {
    if (fullCourse) {
      setEditForm({
        title: fullCourse.title || "",
        description: fullCourse.description || "",
        price: String(fullCourse.price || ""),
        category: fullCourse.category || "",
        cover: fullCourse.cover || "",
      });
    }
  }, [fullCourse]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", headers: csrfHeaders(), body: formData, credentials: "include" });
      const data = await res.json();
      if (data.url) setEditForm(f => ({ ...f, cover: data.url }));
    } catch {
      toast({ title: "Error", description: "Failed to upload cover image", variant: "destructive" });
    } finally { setCoverUploading(false); }
  };

  const saveCourseDetails = async () => {
    setSaving(true);
    try {
      await adminUpdateCourse(courseId, {
        title: editForm.title,
        description: editForm.description,
        price: parseFloat(editForm.price) || undefined,
        category: editForm.category,
        cover: editForm.cover || undefined,
      });
      invalidateAll();
      toast({ title: "Saved", description: "Course details updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveModule = async (modId: string, data: any) => {
    try {
      await adminUpdateModule(modId, data);
      refetch();
      toast({ title: "Saved" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const addModule = async () => {
    try {
      await adminCreateModule({ courseId, title: "New Module", position: (fullCourse?.modules?.length || 0) });
      refetch();
      toast({ title: "Module added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const removeModule = async (modId: string) => {
    try {
      await adminDeleteModule(modId);
      refetch();
      toast({ title: "Module deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const saveLesson = async (lessonId: string, data: any) => {
    try {
      await adminUpdateLesson(lessonId, data);
      refetch();
      toast({ title: "Saved" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const addLesson = async (moduleId: string, position: number) => {
    try {
      await adminCreateLesson({ moduleId, courseId, title: "New Lesson", contentType: "video", position });
      refetch();
      toast({ title: "Lesson added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const removeLesson = async (lessonId: string) => {
    try {
      await adminDeleteLesson(lessonId);
      refetch();
      toast({ title: "Lesson deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const saveQuiz = async (quizId: string, data: any) => {
    try {
      await adminUpdateQuiz(quizId, data);
      refetch();
      toast({ title: "Saved" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const addQuiz = async (moduleId: string, position: number) => {
    try {
      await adminCreateQuiz({ moduleId, courseId, title: "New Quiz", quizType: "revision", passingScore: 70, position });
      refetch();
      toast({ title: "Quiz added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const removeQuiz = async (quizId: string) => {
    try {
      await adminDeleteQuiz(quizId);
      refetch();
      toast({ title: "Quiz deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const saveQuestion = async (qId: string, data: any) => {
    try {
      await adminUpdateQuestion(qId, data);
      await refetch();
      toast({ title: "Saved" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const addQuestion = async (quizId: string, position: number) => {
    try {
      await adminCreateQuestion({ quizId, prompt: "New question", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0, position });
      refetch();
      toast({ title: "Question added" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const removeQuestion = async (qId: string) => {
    try {
      await adminDeleteQuestion(qId);
      refetch();
      toast({ title: "Question deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading course details...</div>;
  if (!fullCourse) return <div className="p-6 text-center text-muted-foreground">Course not found</div>;

  return (
    <div className="p-4 bg-muted/20 space-y-4 border-t" data-testid={`admin-full-editor-${courseId}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Pencil className="w-4 h-4" /> Full Course Editor</h3>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      <div className="bg-background rounded-lg border p-4 space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Course Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Cover Image</Label>
            <div className="flex items-center gap-3 mt-1">
              {editForm.cover ? (
                <img src={editForm.cover} alt="Cover" className="w-24 h-16 object-cover rounded border" />
              ) : (
                <div className="w-24 h-16 bg-muted rounded border flex items-center justify-center"><GraduationCap className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted transition-colors text-sm">
                {coverUploading ? "Uploading..." : "Change Cover"}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} data-testid={`input-admin-cover-${courseId}`} />
              </label>
              {editForm.cover && <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditForm(f => ({ ...f, cover: "" }))}>Remove</Button>}
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid={`input-admin-title-${courseId}`} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Price ($)</Label>
            <Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))} data-testid={`input-admin-price-${courseId}`} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Input value={editForm.category} onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))} data-testid={`input-admin-category-${courseId}`} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} data-testid={`input-admin-desc-${courseId}`} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveCourseDetails} disabled={saving || !editForm.title.trim()} data-testid={`button-save-details-${courseId}`}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Details"}
          </Button>
        </div>
      </div>

      {(fullCourse.modules || []).map((mod: any, mi: number) => (
        <div key={mod.id} className="bg-background rounded-lg border overflow-hidden">
          <div className="p-3 bg-muted/30 flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">M{mi + 1}</span>
            <Input
              className="flex-1 h-8 text-sm font-medium"
              defaultValue={mod.title}
              onBlur={(e) => { if (e.target.value !== mod.title) saveModule(mod.id, { title: e.target.value }); }}
              data-testid={`input-admin-module-title-${mod.id}`}
            />
            <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeModule(mod.id)} data-testid={`button-delete-module-${mod.id}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lessons</p>
            {(mod.lessons || []).map((lesson: any, li: number) => (
              <div key={lesson.id} className="border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">L{li + 1}</span>
                  <Input
                    className="flex-1 h-7 text-sm"
                    defaultValue={lesson.title}
                    onBlur={(e) => { if (e.target.value !== lesson.title) saveLesson(lesson.id, { title: e.target.value }); }}
                    data-testid={`input-admin-lesson-title-${lesson.id}`}
                  />
                  <select
                    className="h-7 text-xs border rounded px-1 bg-background"
                    defaultValue={lesson.contentType || "video"}
                    onChange={(e) => saveLesson(lesson.id, { contentType: e.target.value })}
                    data-testid={`select-admin-lesson-type-${lesson.id}`}
                  >
                    <option value="video">Video</option>
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                    <option value="presentation">Presentation</option>
                    <option value="infographic">Infographic</option>
                  </select>
                  <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeLesson(lesson.id)} data-testid={`button-delete-lesson-${lesson.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {lesson.contentType === "video" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Video URL</Label>
                    <Input
                      className="h-7 text-xs"
                      defaultValue={lesson.videoUrl || ""}
                      placeholder="Video URL or object path"
                      onBlur={(e) => saveLesson(lesson.id, { videoUrl: e.target.value })}
                      data-testid={`input-admin-lesson-video-${lesson.id}`}
                    />
                  </div>
                )}
                {(lesson.contentType === "text") && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Text Content</Label>
                    <Textarea
                      className="text-xs min-h-[60px]"
                      defaultValue={lesson.textContent || ""}
                      onBlur={(e) => saveLesson(lesson.id, { textContent: e.target.value })}
                      data-testid={`input-admin-lesson-text-${lesson.id}`}
                    />
                  </div>
                )}
                {(lesson.contentType === "image" || lesson.contentType === "presentation" || lesson.contentType === "infographic") && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Image URL</Label>
                    <Input
                      className="h-7 text-xs"
                      defaultValue={lesson.imageUrl || ""}
                      placeholder="Image URL or object path"
                      onBlur={(e) => saveLesson(lesson.id, { imageUrl: e.target.value })}
                      data-testid={`input-admin-lesson-image-${lesson.id}`}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <Input className="h-7 text-xs" defaultValue={lesson.duration || ""} placeholder="e.g. 5:30"
                      onBlur={(e) => saveLesson(lesson.id, { duration: e.target.value })}
                      data-testid={`input-admin-lesson-duration-${lesson.id}`} />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" defaultChecked={lesson.isFreePreview || false}
                        onChange={(e) => saveLesson(lesson.id, { isFreePreview: e.target.checked })}
                        data-testid={`checkbox-admin-lesson-preview-${lesson.id}`} />
                      Free Preview
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => addLesson(mod.id, (mod.lessons || []).length)} data-testid={`button-add-lesson-${mod.id}`}>
              + Add Lesson
            </Button>
          </div>

          <div className="p-3 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quizzes</p>
            {(mod.quizzes || []).map((quiz: any, qi: number) => (
              <div key={quiz.id} className="border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">Q{qi + 1}</span>
                  <Input
                    className="flex-1 h-7 text-sm"
                    defaultValue={quiz.title}
                    onBlur={(e) => { if (e.target.value !== quiz.title) saveQuiz(quiz.id, { title: e.target.value }); }}
                    data-testid={`input-admin-quiz-title-${quiz.id}`}
                  />
                  <select
                    className="h-7 text-xs border rounded px-1 bg-background"
                    defaultValue={quiz.quizType || "revision"}
                    onChange={(e) => saveQuiz(quiz.id, { quizType: e.target.value })}
                    data-testid={`select-admin-quiz-type-${quiz.id}`}
                  >
                    <option value="revision">Revision</option>
                    <option value="progress_test">Progress Test</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Pass:</Label>
                    <Input
                      type="number" className="h-7 w-16 text-xs" defaultValue={quiz.passingScore || 70} min={0} max={100}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== quiz.passingScore) saveQuiz(quiz.id, { passingScore: v }); }}
                      data-testid={`input-admin-quiz-passing-${quiz.id}`}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeQuiz(quiz.id)} data-testid={`button-delete-quiz-${quiz.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                <div className="ml-4 space-y-2">
                  {(quiz.questions || []).map((q: any, qIdx: number) => (
                    <div key={q.id} className="border rounded p-2 space-y-1.5 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{qIdx + 1}.</span>
                        <Input
                          className="flex-1 h-7 text-xs"
                          defaultValue={q.prompt}
                          onBlur={(e) => { if (e.target.value !== q.prompt) saveQuestion(q.id, { prompt: e.target.value }); }}
                          data-testid={`input-admin-q-prompt-${q.id}`}
                        />
                        <Button size="sm" variant="ghost" className="text-destructive h-6 px-1.5" onClick={() => removeQuestion(q.id)} data-testid={`button-delete-question-${q.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="ml-4 space-y-1">
                        {(q.options || []).map((opt: string, oi: number) => (
                          <div key={oi} className="flex items-center gap-1.5">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${q.correctIndex === oi ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-300'}`}
                              onClick={() => saveQuestion(q.id, { correctIndex: oi })}
                              data-testid={`radio-admin-correct-${q.id}-${oi}`}
                            >
                              {q.correctIndex === oi && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <Input
                              className="flex-1 h-6 text-xs"
                              defaultValue={opt}
                              onBlur={(e) => {
                                const newOptions = [...q.options];
                                newOptions[oi] = e.target.value;
                                saveQuestion(q.id, { options: newOptions });
                              }}
                              data-testid={`input-admin-option-${q.id}-${oi}`}
                            />
                          </div>
                        ))}
                        <p className="text-xs text-green-600 mt-1">Click the circle to set the correct answer</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Explanation (optional)</Label>
                        <Input
                          className="h-6 text-xs"
                          defaultValue={q.explanation || ""}
                          placeholder="Why this answer is correct..."
                          onBlur={(e) => saveQuestion(q.id, { explanation: e.target.value || null })}
                          data-testid={`input-admin-q-explanation-${q.id}`}
                        />
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full text-xs h-6" onClick={() => addQuestion(quiz.id, (quiz.questions || []).length)} data-testid={`button-add-question-${quiz.id}`}>
                    + Add Question
                  </Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => addQuiz(mod.id, (mod.quizzes || []).length)} data-testid={`button-add-quiz-${mod.id}`}>
              + Add Quiz
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" className="w-full" onClick={addModule} data-testid={`button-add-module-${courseId}`}>
        + Add Module
      </Button>
    </div>
  );
}

function CourseManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allCourses, isLoading } = useQuery({
    queryKey: ["admin-all-courses"],
    queryFn: fetchAdminAllCourses,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-courses"] });
      setDeleteConfirmId(null);
      toast({ title: "Course deleted", description: "The course and all its content have been permanently removed." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete course", variant: "destructive" }); },
  });

  const filteredCourses = (allCourses || []).filter((c: any) =>
    c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.instructorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Course Management ({allCourses?.length || 0})
        </CardTitle>
        <CardDescription>Edit everything on any course — details, modules, lessons, quizzes, and questions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search courses by title, instructor, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
            data-testid="input-search-courses"
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading courses...</p>
        ) : !filteredCourses.length ? (
          <div className="text-center py-6">
            <GraduationCap className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">{searchTerm ? "No courses match your search." : "No courses on the platform yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCourses.map((course: any) => (
              <div key={course.id} className="border rounded-lg overflow-hidden" data-testid={`manage-course-${course.id}`}>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {course.cover ? (
                      <img src={course.cover} alt={course.title} className="w-14 h-10 object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-14 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" data-testid={`text-manage-course-title-${course.id}`}>{course.title}</p>
                      <p className="text-xs text-muted-foreground">by {course.instructorName} &middot; ${course.price} &middot; {course.totalLessons || 0} lessons</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant={course.isApproved ? "default" : "secondary"} className="text-xs">
                        {course.isApproved ? "Approved" : "Pending"}
                      </Badge>
                      <Badge variant={course.isActive ? "default" : "outline"} className="text-xs">
                        {course.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button size="sm" variant={editingId === course.id ? "default" : "outline"} onClick={() => setEditingId(editingId === course.id ? null : course.id)} data-testid={`button-edit-course-${course.id}`}>
                      <Pencil className="w-3 h-3 mr-1" /> {editingId === course.id ? "Close Editor" : "Edit"}
                    </Button>
                    <Link href={`/edit-course/${course.id}`}>
                      <Button size="sm" variant="outline" data-testid={`button-wizard-edit-course-${course.id}`}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Edit in Wizard
                      </Button>
                    </Link>
                    {deleteConfirmId === course.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-destructive font-medium">Delete?</span>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(course.id)} disabled={deleteMutation.isPending} data-testid={`button-confirm-delete-${course.id}`}>
                          Yes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid={`button-cancel-delete-${course.id}`}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => setDeleteConfirmId(course.id)} data-testid={`button-delete-course-${course.id}`}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
                {editingId === course.id && (
                  <AdminCourseFullEditor courseId={course.id} onClose={() => setEditingId(null)} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsersSection() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: usersList, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  const toggleAdmin = useMutation({
    mutationFn: (userId: string) => toggleUserAdmin(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: data.isAdmin ? "Admin granted" : "Admin removed",
        description: `${data.email} is ${data.isAdmin ? "now" : "no longer"} an admin.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          User Management
        </CardTitle>
        <CardDescription>
          Manage user roles and admin privileges. Admins can create courses and access this dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading users...</p>
        ) : !usersList?.length ? (
          <p className="text-muted-foreground">No users found.</p>
        ) : (
          <div className="space-y-3">
            {usersList.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`user-row-${u.id}`}>
                <div className="flex items-center gap-3">
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium" data-testid={`text-user-name-${u.id}`}>
                      {u.firstName || ""} {u.lastName || ""}
                      {!u.firstName && !u.lastName && (u.email || "Unknown")}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {u.isAdmin ? (
                    <Badge className="bg-primary/10 text-primary">Admin</Badge>
                  ) : (
                    <Badge variant="outline">User</Badge>
                  )}
                  {u.id !== currentUser?.id && (
                    <Button
                      variant={u.isAdmin ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleAdmin.mutate(u.id)}
                      disabled={toggleAdmin.isPending}
                      data-testid={`button-toggle-admin-${u.id}`}
                    >
                      {u.isAdmin ? (
                        <><ShieldOff className="w-4 h-4 mr-1" /> Remove Admin</>
                      ) : (
                        <><Shield className="w-4 h-4 mr-1" /> Make Admin</>
                      )}
                    </Button>
                  )}
                  {u.id === currentUser?.id && (
                    <span className="text-xs text-muted-foreground">(You)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaynowConfigSection() {
  const { data: config, isLoading } = useQuery({
    queryKey: ["paynow-config"],
    queryFn: fetchPaynowConfig,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Paynow Integration
        </CardTitle>
        <CardDescription>
          Payment processing for book purchases and author payouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground">Checking configuration...</p>
        ) : config?.configured ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Paynow is configured</p>
              <p className="text-xs text-green-500 mt-1">Credentials stored securely in server secrets</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Paynow not configured</p>
              <p className="text-sm text-amber-600">Contact the administrator to set up payment credentials in Replit Secrets.</p>
            </div>
          </div>
        )}

        <div className="bg-muted rounded-lg p-4 text-sm">
          <p className="font-medium mb-2">Security Note:</p>
          <p className="text-muted-foreground">
            Paynow credentials are stored securely as environment secrets on the server. 
            They are never exposed to the frontend for security purposes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SettlementsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settlements, isLoading } = useQuery({
    queryKey: ["settlements"],
    queryFn: fetchSettlements,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Settlement marked as paid" });
    },
  });

  const getNextMonday = () => {
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Pending Settlements
        </CardTitle>
        <CardDescription>
          Auto-generated settlements for author payouts. Minimum payout: $50. Next settlement date: {getNextMonday()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading settlements...</p>
        ) : !settlements?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No pending settlements</p>
            <p className="text-sm">Settlements are generated every Monday for authors with $50+ earnings</p>
          </div>
        ) : (
          <div className="space-y-4">
            {settlements.map((settlement) => (
              <div 
                key={settlement.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">Seller: {settlement.sellerId}</p>
                  <p className="text-2xl font-bold text-green-600">${settlement.amount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    Scheduled: {new Date(settlement.scheduledFor).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={settlement.status === "paid" ? "default" : "secondary"}>
                    {settlement.status}
                  </Badge>
                  {settlement.status === "pending" && (
                    <Button 
                      size="sm"
                      onClick={() => markPaidMutation.mutate(settlement.id)}
                      disabled={markPaidMutation.isPending}
                    >
                      Mark Paid
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SalesSection() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
  });

  const totalSales = sales?.reduce((sum: number, s: any) => sum + s.amount, 0) || 0;
  const totalCommission = sales?.reduce((sum: number, s: any) => sum + s.commission, 0) || 0;
  const bookSales = sales?.filter((s: any) => s.itemType === "book") || [];
  const courseSales = sales?.filter((s: any) => s.itemType === "course") || [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">${totalSales.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform Commission (25%)</CardDescription>
            <CardTitle className="text-3xl text-green-600">${totalCommission.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-3xl">{sales?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Book Sales
            </CardDescription>
            <CardTitle className="text-2xl">{bookSales.length}</CardTitle>
            <p className="text-xs text-muted-foreground">${bookSales.reduce((s: number, b: any) => s + b.amount, 0).toFixed(2)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" /> Course Sales
            </CardDescription>
            <CardTitle className="text-2xl">{courseSales.length}</CardTitle>
            <p className="text-xs text-muted-foreground">${courseSales.reduce((s: number, c: any) => s + c.amount, 0).toFixed(2)}</p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales (Books & Courses)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading sales...</p>
          ) : !sales?.length ? (
            <p className="text-center py-8 text-muted-foreground">No sales recorded yet</p>
          ) : (
            <div className="space-y-2">
              {sales.slice(0, 20).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sale.itemType === "course" ? "default" : "outline"} className="text-xs">
                        {sale.itemType === "course" ? "Course" : "Book"}
                      </Badge>
                      <p className="font-medium">{sale.itemTitle || sale.bookId}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${sale.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      Commission: ${sale.commission.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSection({ overview, isLoading }: { overview?: AdminOverview; isLoading: boolean }) {
  const salesReport = overview?.sales;
  const settlementsReport = overview?.settlements;
  const booksReport = overview?.books;
  const coursesReport = overview?.courses;

  const totalPublished = (booksReport?.totalBooks || 0) + (coursesReport?.totalCourses || 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Revenue
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-revenue">
              {isLoading ? "..." : `$${(salesReport?.totalRevenue || 0).toFixed(2)}`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Platform Commission
            </CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="text-platform-commission">
              {isLoading ? "..." : `$${(salesReport?.totalCommission || 0).toFixed(2)}`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Total Published
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-published">
              {isLoading ? "..." : totalPublished}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {booksReport?.totalBooks || 0} books, {coursesReport?.totalCourses || 0} courses
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Total Sales
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-sales">
              {isLoading ? "..." : salesReport?.salesCount || 0}
            </CardTitle>
            {(salesReport?.bookSalesCount || salesReport?.courseSalesCount) ? (
              <p className="text-xs text-muted-foreground mt-1">
                {salesReport?.bookSalesCount || 0} book, {salesReport?.courseSalesCount || 0} course
              </p>
            ) : null}
          </CardHeader>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Settlements Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="text-sm text-amber-600">Pending Settlements</p>
                  <p className="font-semibold text-amber-800">{settlementsReport?.pendingCount || 0} settlements</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  ${(settlementsReport?.totalPending || 0).toFixed(2)}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-green-600">Paid Settlements</p>
                  <p className="font-semibold text-green-800">{settlementsReport?.paidCount || 0} settlements</p>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${(settlementsReport?.totalPaid || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Content Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <div>
                  <p className="text-sm text-primary/80">Active Books</p>
                  <p className="font-semibold text-primary">With active subscriptions</p>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {booksReport?.activeBooks || 0}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-blue-600">Active Courses</p>
                  <p className="font-semibold text-blue-800">Approved and visible</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {coursesReport?.activeCourses || 0}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="text-sm text-amber-600">Pending Approval</p>
                  <p className="font-semibold text-amber-800">Awaiting review</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  {(booksReport?.pendingBooks || 0) + (coursesReport?.pendingCourses || 0)}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Expired Subscriptions</p>
                  <p className="font-semibold">Need renewal</p>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">
                  {booksReport?.expiredBooks || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Author Earnings</CardTitle>
          <CardDescription>
            Total author earnings after 25% commission: ${(salesReport?.totalAuthorEarnings || 0).toFixed(2)}
          </CardDescription>
        </CardHeader>
      </Card>

      <MigrateLegacyBooksCard />
    </div>
  );
}

function MigrateLegacyBooksCard() {
  const { toast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/books/migrate-legacy", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      setResult(data);
      toast({
        title: "Migration complete",
        description: data.message,
      });
    } catch (err) {
      toast({
        title: "Migration failed",
        description: "Could not migrate legacy books",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Book File Migration
        </CardTitle>
        <CardDescription>
          Migrate older books that have files stored in the database to cloud storage and convert them to EPUB format for the reader.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleMigrate} disabled={isMigrating} data-testid="button-migrate-legacy">
          {isMigrating ? "Migrating..." : "Migrate Legacy Books"}
        </Button>
        {result && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">{result.message}</p>
            {result.results?.map((r: any, i: number) => (
              <p key={i} className={`mt-1 ${r.status === "failed" ? "text-red-600" : "text-green-600"}`}>
                {r.title}: {r.status}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CertificatesSection() {
  const { toast } = useToast();
  const { data: certificates, isLoading } = useQuery({
    queryKey: ["admin-certificates"],
    queryFn: fetchAdminCertificates,
  });

  const handleDownload = async (cert: any) => {
    try {
      const blob = await downloadAdminCertificate(cert.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cert.userName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Certificate downloaded" });
    } catch {
      toast({ title: "Error", description: "Failed to download certificate", variant: "destructive" });
    }
  };

  const paidCerts = certificates?.filter((c: any) => c.paid) || [];
  const unpaidCerts = certificates?.filter((c: any) => !c.paid) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Certificate Management
        </CardTitle>
        <CardDescription>View all issued certificates, payment status, and download PDFs for students.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading certificates...</p>
        ) : !certificates?.length ? (
          <p className="text-muted-foreground text-center py-8">No certificates issued yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700" data-testid="text-total-certs">{certificates.length}</p>
                <p className="text-sm text-blue-600">Total Certificates</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700" data-testid="text-paid-certs">{paidCerts.length}</p>
                <p className="text-sm text-green-600">Paid</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-700" data-testid="text-unpaid-certs">{unpaidCerts.length}</p>
                <p className="text-sm text-amber-600">Unpaid</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Course</th>
                    <th className="text-left py-3 px-2 font-medium">Instructor</th>
                    <th className="text-left py-3 px-2 font-medium">Date Issued</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                    <th className="text-center py-3 px-2 font-medium">Token</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert: any) => (
                    <tr key={cert.id} className="border-b hover:bg-muted/30" data-testid={`row-cert-${cert.id}`}>
                      <td className="py-3 px-2 font-medium">{cert.userName}</td>
                      <td className="py-3 px-2">{cert.courseTitle}</td>
                      <td className="py-3 px-2 text-muted-foreground">{cert.instructorName}</td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {new Date(cert.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {cert.paid ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`badge-paid-${cert.id}`}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300" data-testid={`badge-unpaid-${cert.id}`}>
                            <Clock className="w-3 h-3 mr-1" /> Unpaid
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {cert.verificationToken?.startsWith("PENDING_") ? "Pending" : cert.verificationToken}
                        </code>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(cert)}
                          data-testid={`button-download-cert-${cert.id}`}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BookAnalyticsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-book-analytics"],
    queryFn: fetchBookAnalytics,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Book Analytics
        </CardTitle>
        <CardDescription>Detailed statistics and performance data for all books on the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading book analytics...</p>
        ) : !data?.books?.length ? (
          <p className="text-muted-foreground text-center py-8">No books published yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700" data-testid="text-total-books-analytics">{data.summary.totalBooks}</p>
                <p className="text-xs text-blue-600">Total Books</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700" data-testid="text-active-books-analytics">{data.summary.activeBooks}</p>
                <p className="text-xs text-green-600">Active</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-700" data-testid="text-total-book-sales">{data.summary.totalSales}</p>
                <p className="text-xs text-purple-600">Total Sales</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-700" data-testid="text-total-book-revenue">${data.summary.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-amber-600">Total Revenue</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700" data-testid="text-total-commission">${data.summary.totalCommission.toFixed(2)}</p>
                <p className="text-xs text-emerald-600">Commission</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Book</th>
                    <th className="text-left py-3 px-2 font-medium">Author</th>
                    <th className="text-right py-3 px-2 font-medium">Price</th>
                    <th className="text-right py-3 px-2 font-medium">Views</th>
                    <th className="text-right py-3 px-2 font-medium">Sales</th>
                    <th className="text-right py-3 px-2 font-medium">Conv. Rate</th>
                    <th className="text-right py-3 px-2 font-medium">Revenue</th>
                    <th className="text-right py-3 px-2 font-medium">Commission</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.books.map((book: any) => (
                    <tr key={book.id} className="border-b hover:bg-muted/30" data-testid={`row-book-analytics-${book.id}`}>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt="" className="w-8 h-10 object-contain rounded bg-muted" />
                          ) : (
                            <div className="w-8 h-10 bg-muted rounded flex items-center justify-center">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium truncate max-w-[200px]">{book.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{book.author}</td>
                      <td className="py-3 px-2 text-right">${(book.price || 0).toFixed(2)}</td>
                      <td className="py-3 px-2 text-right">{book.views.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-medium">{book.totalSales}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{book.conversionRate}%</td>
                      <td className="py-3 px-2 text-right font-medium text-green-700">${book.totalRevenue.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right text-primary">${book.totalCommission.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center">
                        {book.isActive && book.subscriptionActive ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Active</Badge>
                        ) : !book.isApproved ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Pending</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-700 border-red-300 text-xs">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsSection() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: fetchAdminAnalytics,
  });

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Users
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : analytics?.totalUsers || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Total Books
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : analytics?.totalBooks || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Total Courses
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : analytics?.totalCourses || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Total Page Views
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : analytics?.totalPageViews?.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Active Books
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {isLoading ? "..." : analytics?.activeBooks || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Active Courses
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {isLoading ? "..." : analytics?.activeCourses || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : `$${(analytics?.totalRevenue || 0).toFixed(2)}`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Unique Sessions
            </CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "..." : analytics?.uniqueSessions?.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Book Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <div>
                  <p className="text-sm text-primary/80">Total Book Sales</p>
                  <p className="font-semibold text-primary">All book purchases</p>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {analytics?.totalBookSales || 0}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-green-600">Book Revenue</p>
                  <p className="font-semibold text-green-800">From all book sales</p>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${(analytics?.bookRevenue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Course Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <div>
                  <p className="text-sm text-primary/80">Total Course Sales</p>
                  <p className="font-semibold text-primary">All course purchases</p>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {analytics?.totalCourseSales || 0}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-green-600">Course Revenue</p>
                  <p className="font-semibold text-green-800">From all course sales</p>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${(analytics?.courseRevenue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Top Viewed Content
          </CardTitle>
          <CardDescription>Most viewed books and courses on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !analytics?.topContent?.length ? (
            <p className="text-muted-foreground text-center py-4">No view data available yet</p>
          ) : (
            <div className="space-y-2">
              {analytics.topContent.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-8">#{idx + 1}</span>
                    <div>
                      <p className="font-medium">{item.path}</p>
                      <p className="text-xs text-muted-foreground">{item.contentType || "page"}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{item.views} views</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Commission</CardTitle>
          <CardDescription>
            Platform earns 25% commission on all sales. Total commission earned: ${(analytics?.totalCommission || 0).toFixed(2)}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function GrantAccessSection() {
  const { toast } = useToast();
  const [contentId, setContentId] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerToken, setBuyerToken] = useState("");
  const [paynowRef, setPaynowRef] = useState("");
  const [isGranting, setIsGranting] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  const lookupPendingPayments = async () => {
    if (!buyerEmail && !contentId) {
      toast({ title: "Enter a course/book ID or buyer email to search", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/pending-payments?email=${encodeURIComponent(buyerEmail)}&contentId=${encodeURIComponent(contentId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to lookup");
      const data = await res.json();
      setLookupResult(data);
    } catch {
      toast({ title: "Failed to lookup pending payments", variant: "destructive" });
    }
  };

  const grantAccess = async (cId?: string, bToken?: string, email?: string, ref?: string) => {
    const courseId = cId || contentId;
    const token = bToken || buyerToken;
    if (!courseId || !token) {
      toast({ title: "Course/Book ID and Buyer ID are required", variant: "destructive" });
      return;
    }
    setIsGranting(true);
    try {
      const res = await fetch("/api/admin/grant-course-access", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          courseId,
          buyerToken: token,
          email: email || buyerEmail || undefined,
          paynowReference: ref || paynowRef || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Access Granted", description: data.message });
        setContentId("");
        setBuyerToken("");
        setBuyerEmail("");
        setPaynowRef("");
        setLookupResult(null);
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to grant access", variant: "destructive" });
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Grant Course/Book Access
          </CardTitle>
          <CardDescription>
            Manually grant a customer access to a course or book when a payment was made but the system didn't process it correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">Lookup Pending Payments</p>
            <p className="text-xs text-amber-600 mt-1">Search for payments that were made but not processed. Enter a buyer email or content ID to find them.</p>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <div>
                <Label className="text-xs">Buyer Email</Label>
                <Input
                  data-testid="input-lookup-email"
                  placeholder="customer@email.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Course/Book ID (optional)</Label>
                <Input
                  data-testid="input-lookup-content-id"
                  placeholder="e.g. 03be7435-..."
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button data-testid="button-lookup-payments" onClick={lookupPendingPayments} variant="outline" className="w-full">
                  Search Pending Payments
                </Button>
              </div>
            </div>
          </div>

          {lookupResult && lookupResult.payments?.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Found {lookupResult.payments.length} pending payment(s):</p>
              {lookupResult.payments.map((p: any) => (
                <div key={p.id} className="p-4 border rounded-lg bg-muted/50 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{p.contentTitle || p.courseId || p.bookId}</p>
                    <p className="text-xs text-muted-foreground">Buyer: {p.email || p.buyerToken}</p>
                    <p className="text-xs text-muted-foreground">Amount: ${p.amount} | Status: {p.status}</p>
                    <p className="text-xs text-muted-foreground">Date: {new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <Button
                    data-testid={`button-grant-${p.id}`}
                    size="sm"
                    onClick={() => grantAccess(p.courseId || p.bookId, p.buyerToken, p.email, p.paynowReference)}
                    disabled={isGranting}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Grant Access
                  </Button>
                </div>
              ))}
            </div>
          )}

          {lookupResult && lookupResult.payments?.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending payments found matching your search.</p>
          )}

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Or manually enter details:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Course/Book ID</Label>
                <Input
                  data-testid="input-grant-content-id"
                  placeholder="Paste the course or book ID"
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                />
              </div>
              <div>
                <Label>Buyer ID (Google User ID)</Label>
                <Input
                  data-testid="input-grant-buyer-token"
                  placeholder="e.g. 116990875619337464953"
                  value={buyerToken}
                  onChange={(e) => setBuyerToken(e.target.value)}
                />
              </div>
              <div>
                <Label>Buyer Email (optional)</Label>
                <Input
                  data-testid="input-grant-email"
                  placeholder="customer@email.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Paynow Reference (optional)</Label>
                <Input
                  data-testid="input-grant-paynow-ref"
                  placeholder="e.g. 38511289"
                  value={paynowRef}
                  onChange={(e) => setPaynowRef(e.target.value)}
                />
              </div>
            </div>
            <Button
              data-testid="button-grant-access"
              className="mt-4"
              onClick={() => grantAccess()}
              disabled={isGranting || !contentId || !buyerToken}
            >
              {isGranting ? "Granting..." : "Grant Access"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
