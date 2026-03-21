import { useState, useEffect, useMemo } from "react";
import { formatRichText } from "@/lib/format-rich-text";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchCourse,
  checkCoursePurchase,
  fetchLessonProgress,
  markLessonComplete,
  fetchCourseQuizzes,
  fetchQuizQuestions,
  submitQuizAttempt,
  fetchCourseQuizAttempts,
  fetchCourseLabs,
  submitLabCompletion,
  fetchLabSubmission,
  generateCertificate,
  fetchCourseCertificate,
  initiateCertificatePayment,
  checkCertificatePaymentStatus,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Lock,
  ArrowLeft,
  Loader2,
  GraduationCap,
  Image,
  HelpCircle,
  Award,
  FlaskConical,
  XCircle,
  Home,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ExternalLink,
  Download,
  Presentation,
  BarChart3,
  DollarSign,
  CreditCard,
  Phone,
  Shield,
  BookOpen,
  Clock,
  ArrowRight,
  Volume2,
} from "lucide-react";

function getBuyerToken(): string {
  const key = "lumina_buyer_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = `buyer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

function getEmbedUrl(url: string): string {
  if (!url) return "";
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

function isDirectVideoFile(url: string): boolean {
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) return true;
  if (url.startsWith("/objects/")) return true;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg'].includes(ext || '');
}

function isEmbeddableUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/.test(url);
}

type SidebarItem = { type: "lesson"; data: any } | { type: "quiz"; data: any } | { type: "lab"; data: any } | { type: "certificate" };

export default function CoursePlayer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const courseId = id || "";

  const [isPurchased, setIsPurchased] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const [labText, setLabText] = useState("");
  const [labSubmission, setLabSubmission] = useState<any>(null);
  const [submittingLab, setSubmittingLab] = useState(false);

  const [certificate, setCertificate] = useState<any>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [honorCodeAccepted, setHonorCodeAccepted] = useState(false);
  const [honorCodeChecked, setHonorCodeChecked] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState<"like" | "dislike" | null>(null);
  const [certPaymentStep, setCertPaymentStep] = useState<"idle" | "form" | "processing" | "checking">("idle");
  const [certEmail, setCertEmail] = useState("");
  const [certPhone, setCertPhone] = useState("");
  const [certPaymentMethod, setCertPaymentMethod] = useState<string>("web");
  const [certPollUrl, setCertPollUrl] = useState("");
  const [certRedirectUrl, setCertRedirectUrl] = useState("");

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourse(courseId),
    enabled: !!courseId,
  });

  const { data: progressData } = useQuery({
    queryKey: ["courseProgress", courseId],
    queryFn: () => fetchLessonProgress(courseId),
    enabled: !!courseId,
  });

  const { data: quizzesData } = useQuery({
    queryKey: ["courseQuizzes", courseId],
    queryFn: () => fetchCourseQuizzes(courseId),
    enabled: !!courseId,
  });

  const { data: quizAttemptsData } = useQuery({
    queryKey: ["courseQuizAttempts", courseId],
    queryFn: () => fetchCourseQuizAttempts(courseId),
    enabled: !!courseId,
  });

  const { data: labsData } = useQuery({
    queryKey: ["courseLabs", courseId],
    queryFn: () => fetchCourseLabs(courseId),
    enabled: !!courseId,
  });

  const [isInstructorFromServer, setIsInstructorFromServer] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      setCheckingAccess(true);
      try {
        const buyerToken = getBuyerToken();
        const params = new URLSearchParams();
        if (buyerToken) params.set("buyerToken", buyerToken);
        const resp = await fetch(`/api/courses/${courseId}/access?${params.toString()}`, {
          credentials: "include",
        });
        if (resp.ok) {
          const data = await resp.json();
          setIsPurchased(data.isPurchased === true);
          setIsInstructorFromServer(data.isInstructor === true);
        } else {
          setIsPurchased(false);
        }
      } catch {
        setIsPurchased(false);
      }
      setCheckingAccess(false);
    }
    if (courseId) checkAccess();
  }, [courseId, user?.id]);

  useEffect(() => {
    async function loadCert() {
      try {
        const cert = await fetchCourseCertificate(courseId);
        if (cert) setCertificate(cert);
      } catch {}
    }
    if (courseId && user?.id) loadCert();
  }, [courseId, user?.id]);

  const isInstructor =
    isInstructorFromServer || (user?.id && course?.instructorId && user.id === String(course.instructorId));
  const isAdmin = user?.isAdmin === true;
  const hasAccess = isPurchased || isInstructor || isAdmin;

  const allLessons: any[] = useMemo(() => {
    if (!course?.modules) return [];
    return course.modules.flatMap((mod: any) => mod.lessons || []);
  }, [course]);

  const completedLessonIds = useMemo(() => {
    if (!progressData) return new Set<string>();
    return new Set(
      progressData.filter((p: any) => p.completed).map((p: any) => p.lessonId)
    );
  }, [progressData]);

  const passedQuizIds = useMemo(() => {
    if (!quizAttemptsData) return new Set<string>();
    const passed = new Set<string>();
    quizAttemptsData.forEach((a: any) => {
      if (a.passed) passed.add(a.quizId);
    });
    return passed;
  }, [quizAttemptsData]);

  const quizzesByModule = useMemo(() => {
    if (!quizzesData) return new Map<string, any[]>();
    const map = new Map<string, any[]>();
    quizzesData.forEach((q: any) => {
      if (!map.has(q.moduleId)) map.set(q.moduleId, []);
      map.get(q.moduleId)!.push(q);
    });
    return map;
  }, [quizzesData]);

  const lessonQuizMap = useMemo(() => {
    if (!quizzesData) return new Map<string, any>();
    const map = new Map<string, any>();
    quizzesData.forEach((q: any) => {
      if (q.lessonId) map.set(q.lessonId, q);
    });
    return map;
  }, [quizzesData]);

  const isLessonUnlocked = (lessonId: string): boolean => {
    const idx = allLessons.findIndex((l) => l.id === lessonId);
    if (idx <= 0) return true;
    const prevLesson = allLessons[idx - 1];
    const prevQuiz = lessonQuizMap.get(prevLesson.id);
    if (!prevQuiz) return true;
    return passedQuizIds.has(prevQuiz.id);
  };

  const completedCount = completedLessonIds.size;
  const totalLessons = allLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const allProgressTestsPassed = useMemo(() => {
    if (!quizzesData) return false;
    const progressTests = quizzesData.filter((q: any) => q.quizType === "progress_test");
    if (progressTests.length === 0) return completedCount === totalLessons && totalLessons > 0;
    return progressTests.every((t: any) => passedQuizIds.has(t.id));
  }, [quizzesData, passedQuizIds, completedCount, totalLessons]);

  const canGetCertificate = allProgressTestsPassed && completedCount === totalLessons;

  useEffect(() => {
    if (course?.modules && !selectedItem) {
      const modules = course.modules || [];
      if (modules.length > 0) {
        setExpandedModules(new Set(modules.map((m: any) => m.id)));
        const firstLesson = modules[0]?.lessons?.[0];
        if (firstLesson) setSelectedItem({ type: "lesson", data: firstLesson });
      }
    }
  }, [course, selectedItem]);

  useEffect(() => {
    setHonorCodeChecked(false);
  }, [selectedItem]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const selectLesson = (lesson: any) => {
    setSelectedItem({ type: "lesson", data: lesson });
    setQuizResult(null);
    setSidebarOpen(false);
  };

  const selectQuiz = async (quiz: any) => {
    setSelectedItem({ type: "quiz", data: quiz });
    setQuizResult(null);
    setQuizAnswers([]);
    setLoadingQuiz(true);
    setSidebarOpen(false);
    try {
      const questions = await fetchQuizQuestions(quiz.id);
      setQuizQuestions(questions);
      setQuizAnswers(new Array(questions.length).fill(-1));
    } catch {
      setQuizQuestions([]);
    }
    setLoadingQuiz(false);
  };

  const selectLab = async (lab: any) => {
    setSelectedItem({ type: "lab", data: lab });
    setLabText("");
    setLabSubmission(null);
    setSidebarOpen(false);
    try {
      const sub = await fetchLabSubmission(lab.id);
      if (sub) setLabSubmission(sub);
    } catch {}
  };

  const selectCertificate = () => {
    setSelectedItem({ type: "certificate" });
    setSidebarOpen(false);
  };

  const handleMarkComplete = async () => {
    if (!selectedItem || selectedItem.type !== "lesson" || markingComplete) return;
    setMarkingComplete(true);
    try {
      await markLessonComplete(courseId, selectedItem.data.id);
      queryClient.invalidateQueries({ queryKey: ["courseProgress", courseId] });
    } catch {}
    setMarkingComplete(false);
  };

  const handleSubmitQuiz = async () => {
    if (!selectedItem || selectedItem.type !== "quiz" || submittingQuiz) return;
    setSubmittingQuiz(true);
    try {
      const result = await submitQuizAttempt(selectedItem.data.id, quizAnswers, courseId);
      setQuizResult(result);
      queryClient.invalidateQueries({ queryKey: ["courseQuizAttempts", courseId] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmittingQuiz(false);
  };

  const handleSubmitLab = async () => {
    if (!selectedItem || selectedItem.type !== "lab" || submittingLab) return;
    setSubmittingLab(true);
    try {
      const sub = await submitLabCompletion(selectedItem.data.id, courseId, labText);
      setLabSubmission(sub);
      toast({ title: "Lab submitted!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmittingLab(false);
  };

  const handleGenerateCertificate = async () => {
    setGeneratingCert(true);
    try {
      const cert = await generateCertificate(courseId);
      setCertificate(cert);
      if (!cert.paid) {
        setCertPaymentStep("idle");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setGeneratingCert(false);
  };

  const handleCertPaymentInitiate = async () => {
    setCertPaymentStep("processing");
    try {
      const result = await initiateCertificatePayment(courseId, {
        email: certEmail || undefined,
        phone: certPhone || undefined,
        paymentMethod: certPaymentMethod,
      });
      if (result.alreadyPaid) {
        const cert = await fetchCourseCertificate(courseId);
        setCertificate(cert);
        setCertPaymentStep("idle");
        toast({ title: "Certificate already paid for!" });
        return;
      }
      if (result.success) {
        setCertPollUrl(result.pollUrl);
        setCertRedirectUrl(result.redirectUrl || "");
        if (result.redirectUrl && certPaymentMethod === "web") {
          window.open(result.redirectUrl, "_blank");
        }
        setCertPaymentStep("checking");
        toast({ title: "Payment initiated", description: "Complete the payment and click 'Verify Payment' below." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setCertPaymentStep("form");
    }
  };

  const handleCertPaymentCheck = async () => {
    try {
      const result = await checkCertificatePaymentStatus(certPollUrl, courseId);
      if (result.paid) {
        setCertificate(result.certificate);
        setCertPaymentStep("idle");
        toast({ title: "Payment confirmed!", description: "Your certificate is ready to download." });
      } else {
        toast({ title: "Payment pending", description: "Payment hasn't been confirmed yet. Please try again shortly." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificate) return;
    try {
      const response = await fetch(`/api/courses/${courseId}/certificate/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to download certificate");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Certificate-" + certificate.courseTitle.replace(/[^a-zA-Z0-9]/g, '_') + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download certificate PDF", variant: "destructive" });
    }
  };

  const handleNextLesson = () => {
    if (!selectedItem || selectedItem.type !== "lesson") return;
    const idx = allLessons.findIndex((l) => l.id === selectedItem.data.id);
    if (idx >= 0 && idx < allLessons.length - 1) {
      setSelectedItem({ type: "lesson", data: allLessons[idx + 1] });
    }
  };

  if (courseLoading || authLoading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-player">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4" data-testid="course-not-found">
        <GraduationCap className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Course Not Found</h1>
        <Button asChild data-testid="button-back-courses">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4" data-testid="access-denied">
        <Lock className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You need to purchase this course to access the content.
        </p>
        <Button asChild data-testid="button-view-course">
          <Link href={`/course/${courseId}`}>View Course Details</Link>
        </Button>
      </div>
    );
  }

  const modules = course.modules || [];
  const labs = labsData || [];

  const getLessonIcon = (lesson: any, isCompleted: boolean) => {
    if (isCompleted) return <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />;
    if (lesson.contentType === "video") return <PlayCircle className="w-4 h-4 shrink-0 text-blue-500" />;
    if (lesson.contentType === "presentation") return <Presentation className="w-4 h-4 shrink-0 text-indigo-500" />;
    if (lesson.contentType === "infographic") return <BarChart3 className="w-4 h-4 shrink-0 text-purple-500" />;
    if (lesson.contentType === "image") return <Image className="w-4 h-4 shrink-0 text-emerald-500" />;
    return <FileText className="w-4 h-4 shrink-0 text-amber-600" />;
  };

  const getLessonTypeLabel = (contentType: string) => {
    switch (contentType) {
      case "video": return "Video";
      case "text": return "Article";
      case "image": return "Image";
      case "presentation": return "Slides";
      case "infographic": return "Infographic";
      default: return "Article";
    }
  };

  const getTypeColor = (contentType: string) => {
    switch (contentType) {
      case "video": return "text-blue-600 bg-blue-50";
      case "text": return "text-amber-700 bg-amber-50";
      case "image": return "text-emerald-600 bg-emerald-50";
      case "presentation": return "text-indigo-600 bg-indigo-50";
      case "infographic": return "text-purple-600 bg-purple-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full" data-testid="sidebar-content">
      <div className="p-5 border-b border-border bg-gradient-to-b from-card to-transparent">
        <h2 className="font-serif font-bold text-base truncate leading-tight" data-testid="text-sidebar-title">
          {course.title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{course.instructorName || "Instructor"}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span data-testid="text-progress-label">{completedCount}/{totalLessons} lessons</span>
            <span className="font-semibold text-primary" data-testid="text-progress-percent">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" data-testid="progress-bar" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" data-testid="sidebar-modules">
        {modules.map((mod: any, modIndex: number) => {
          const moduleQuizzes = quizzesByModule.get(mod.id) || [];
          const modLessons = mod.lessons || [];
          const modCompletedCount = modLessons.filter((l: any) => completedLessonIds.has(l.id)).length;
          const isExpanded = expandedModules.has(mod.id);
          return (
            <div key={mod.id} className="border-b border-border/50" data-testid={`module-${mod.id}`}>
              <button
                className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors text-left ${isExpanded ? "bg-muted/30" : ""}`}
                onClick={() => toggleModule(mod.id)}
                data-testid={`button-toggle-module-${mod.id}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 ${
                    modCompletedCount === modLessons.length && modLessons.length > 0
                      ? "bg-green-100 text-green-700"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {modCompletedCount === modLessons.length && modLessons.length > 0
                      ? <CheckCircle className="w-4 h-4" />
                      : (modIndex + 1)
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block" data-testid={`text-module-title-${mod.id}`}>
                      {mod.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {modLessons.length} lesson{modLessons.length !== 1 ? "s" : ""}
                      {moduleQuizzes.length > 0 && ` · ${moduleQuizzes.length} quiz${moduleQuizzes.length !== 1 ? "zes" : ""}`}
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-2">
                      {modLessons.map((lesson: any) => {
                        const isSelected = selectedItem?.type === "lesson" && selectedItem.data.id === lesson.id;
                        const isCompleted = completedLessonIds.has(lesson.id);
                        const isUnlocked = isLessonUnlocked(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            className={`w-full flex items-center gap-3 px-5 pl-[52px] py-2.5 text-left transition-all text-sm group ${
                              !isUnlocked ? "opacity-60 cursor-not-allowed" :
                              isSelected
                                ? "bg-primary/8 text-primary border-l-[3px] border-primary pl-[49px]"
                                : "hover:bg-muted/40 border-l-[3px] border-transparent"
                            }`}
                            onClick={() => isUnlocked && selectLesson(lesson)}
                            data-testid={`button-lesson-${lesson.id}`}
                          >
                            {!isUnlocked ? <Lock className="w-4 h-4 shrink-0 text-muted-foreground" /> : getLessonIcon(lesson, isCompleted)}
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="truncate text-[13px] leading-tight" data-testid={`text-lesson-title-${lesson.id}`}>
                                {lesson.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getTypeColor(lesson.contentType)}`} data-testid={`text-lesson-type-${lesson.id}`}>
                                  {getLessonTypeLabel(lesson.contentType)}
                                </span>
                                {lesson.duration && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {lesson.duration}
                                  </span>
                                )}
                              </div>
                            </div>
                            {lesson.isFreePreview && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0 uppercase tracking-wide">
                                Free
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {moduleQuizzes.map((quiz: any) => {
                        const isSelected = selectedItem?.type === "quiz" && selectedItem.data.id === quiz.id;
                        const isPassed = passedQuizIds.has(quiz.id);
                        return (
                          <button
                            key={quiz.id}
                            className={`w-full flex items-center gap-3 px-5 pl-[52px] py-2.5 text-left transition-all text-sm ${
                              isSelected
                                ? "bg-primary/8 text-primary border-l-[3px] border-primary pl-[49px]"
                                : "hover:bg-muted/40 border-l-[3px] border-transparent"
                            }`}
                            onClick={() => selectQuiz(quiz)}
                            data-testid={`button-quiz-${quiz.id}`}
                          >
                            {isPassed ? (
                              <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
                            ) : (
                              <HelpCircle className="w-4 h-4 shrink-0 text-orange-500" />
                            )}
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="truncate text-[13px] leading-tight">{quiz.title}</span>
                              <span className={`text-[10px] font-medium mt-0.5 ${
                                quiz.quizType === "progress_test" ? "text-orange-600" : "text-blue-600"
                              }`}>
                                {quiz.quizType === "progress_test" ? "Required Test" : "Practice Quiz"}
                              </span>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isPassed
                                ? "bg-green-100 text-green-700"
                                : quiz.quizType === "progress_test"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-50 text-blue-600"
                            }`}>
                              {isPassed ? "Passed" : quiz.quizType === "progress_test" ? "Required" : "Quiz"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {labs.length > 0 && (
          <div className="border-b border-border/50">
            <div className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Hands-on Labs
            </div>
            {labs.map((lab: any) => {
              const isSelected = selectedItem?.type === "lab" && selectedItem.data.id === lab.id;
              return (
                <button
                  key={lab.id}
                  className={`w-full flex items-center gap-3 px-5 pl-[52px] py-2.5 text-left transition-all text-sm ${
                    isSelected ? "bg-primary/8 text-primary border-l-[3px] border-primary pl-[49px]" : "hover:bg-muted/40 border-l-[3px] border-transparent"
                  }`}
                  onClick={() => selectLab(lab)}
                  data-testid={`button-lab-${lab.id}`}
                >
                  <FlaskConical className="w-4 h-4 shrink-0 text-purple-500" />
                  <span className="truncate text-[13px] flex-1">{lab.title}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 shrink-0">Lab</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="border-b border-border/50">
          <button
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all text-sm ${
              selectedItem?.type === "certificate"
                ? "bg-primary/8 text-primary border-l-[3px] border-primary"
                : "hover:bg-muted/40 border-l-[3px] border-transparent"
            }`}
            onClick={selectCertificate}
            data-testid="button-certificate-section"
          >
            <Award className={`w-5 h-5 shrink-0 ${canGetCertificate || certificate ? "text-yellow-500" : "text-muted-foreground"}`} />
            <span className="font-medium text-[13px]">Certificate</span>
            {certificate && certificate.paid && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (!selectedItem) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground" data-testid="no-lesson-selected">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-bold text-foreground mb-2">Ready to Learn?</h3>
            <p className="text-sm text-muted-foreground">Select a lesson from the sidebar to begin your journey.</p>
          </div>
        </div>
      );
    }

    if (selectedItem.type === "lesson") {
      const lesson = selectedItem.data;
      const isCompleted = completedLessonIds.has(lesson.id);
      const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
      const hasNext = currentIndex >= 0 && currentIndex < allLessons.length - 1;

      return (
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-10">
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${getTypeColor(lesson.contentType)}`}>
                  {getLessonTypeLabel(lesson.contentType)}
                </span>
                {lesson.duration && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {lesson.duration}
                  </span>
                )}
                {isCompleted && (
                  <span className="text-xs text-green-600 flex items-center gap-1 ml-auto font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Completed
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground leading-tight" data-testid="text-current-lesson-title">
                {lesson.title}
              </h1>
            </div>

            {lesson.contentType === "video" ? (
              <div className="mb-8 rounded-xl overflow-hidden shadow-lg bg-black">
                {lesson.videoUrl ? (
                  isDirectVideoFile(lesson.videoUrl) ? (
                    <div className="aspect-video" data-testid="video-container">
                      <video
                        key={lesson.videoUrl}
                        src={lesson.videoUrl}
                        className="w-full h-full"
                        controls
                        preload="metadata"
                        playsInline
                        controlsList="nodownload"
                        data-testid="video-player"
                      >
                        Your browser does not support video playback.
                      </video>
                    </div>
                  ) : isEmbeddableUrl(lesson.videoUrl) ? (
                    <div className="aspect-video" data-testid="video-container">
                      <iframe
                        key={lesson.videoUrl}
                        src={getEmbedUrl(lesson.videoUrl)}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="eager"
                        title={lesson.title}
                        data-testid="video-iframe"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video" data-testid="video-container">
                      <video
                        key={lesson.videoUrl}
                        src={lesson.videoUrl}
                        className="w-full h-full"
                        controls
                        preload="metadata"
                        playsInline
                        controlsList="nodownload"
                        data-testid="video-player"
                      >
                        Your browser does not support video playback.
                      </video>
                    </div>
                  )
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center" data-testid="video-placeholder">
                    <div className="text-center text-white/60">
                      <PlayCircle className="w-16 h-16 mx-auto mb-3 opacity-50" />
                      <p className="text-lg font-medium">Video Coming Soon</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (lesson.contentType === "image" || lesson.contentType === "presentation" || lesson.contentType === "infographic") ? (
              <div className="mb-8 space-y-4">
                {lesson.imageUrl && (
                  <div className="rounded-xl overflow-hidden shadow-md border border-border/50" data-testid="image-container">
                    <img
                      src={lesson.imageUrl}
                      alt={lesson.title}
                      className="w-full max-h-[650px] object-contain bg-gradient-to-b from-gray-50 to-gray-100"
                      loading="eager"
                      data-testid="lesson-image"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {lesson.voiceoverUrl && (
              <div className="mb-8 rounded-xl border border-border/50 bg-card shadow-sm p-4" data-testid="voiceover-player">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Voiceover</p>
                    <audio
                      src={lesson.voiceoverUrl}
                      controls
                      preload="auto"
                      className="w-full h-8"
                      data-testid="voiceover-audio"
                    />
                  </div>
                </div>
              </div>
            )}

            {lesson.textContent && (
              <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden mb-8" data-testid="text-content">
                <div className="px-6 py-8 md:px-10 md:py-10">
                  {formatRichText(lesson.textContent)}
                </div>
              </div>
            )}

            {!lesson.textContent && lesson.contentType === "text" && (
              <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden mb-8" data-testid="text-content">
                <div className="px-6 py-8 md:px-10 md:py-10 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Content coming soon.</p>
                </div>
              </div>
            )}

            {!isCompleted && (
              <div className="flex items-start gap-3 mb-4 p-4 rounded-xl border border-border/50 bg-card shadow-sm">
                <Checkbox
                  id="honor-code-lesson"
                  checked={honorCodeChecked}
                  onCheckedChange={(checked) => setHonorCodeChecked(checked === true)}
                  data-testid="checkbox-honor-code-lesson"
                />
                <label htmlFor="honor-code-lesson" className="text-sm leading-relaxed cursor-pointer">
                  I declare that I have completed this lesson honestly and will not use other people's answers. I understand that any suspicious activity may result in disqualification.
                </label>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border/50">
              <div className="flex items-center gap-3">
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2.5 rounded-lg" data-testid="status-completed">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">Completed</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleMarkComplete}
                    disabled={markingComplete || !honorCodeChecked}
                    size="lg"
                    className="rounded-lg"
                    data-testid="button-mark-complete"
                  >
                    {markingComplete ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Mark as Complete
                  </Button>
                )}
              </div>
              {hasNext && (() => {
                const currentLessonQuiz = lessonQuizMap.get(lesson.id);
                const quizBlocking = currentLessonQuiz && !passedQuizIds.has(currentLessonQuiz.id);
                return quizBlocking ? null : (
                  <Button variant="outline" onClick={handleNextLesson} className="rounded-lg gap-2" data-testid="button-next-lesson">
                    Next Lesson <ArrowRight className="w-4 h-4" />
                  </Button>
                );
              })()}
            </div>
          </motion.div>
        </div>
      );
    }

    if (selectedItem.type === "quiz") {
      const quiz = selectedItem.data;
      return (
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-10">
          <motion.div
            key={quiz.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  quiz.quizType === "progress_test"
                    ? "bg-orange-100"
                    : "bg-blue-100"
                }`}>
                  <HelpCircle className={`w-5 h-5 ${
                    quiz.quizType === "progress_test" ? "text-orange-600" : "text-blue-600"
                  }`} />
                </div>
                <div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    quiz.quizType === "progress_test"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {quiz.quizType === "progress_test" ? "Progress Test" : "Revision Exercise"}
                  </span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold" data-testid="text-quiz-title">{quiz.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {quizQuestions.length} question{quizQuestions.length !== 1 ? "s" : ""} · Passing score: {quiz.passingScore}%
              </p>
            </div>

            {loadingQuiz ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : quizResult ? (
              <div className="space-y-6" data-testid="quiz-results">
                <div className={`p-8 rounded-2xl border-2 text-center ${
                  quizResult.passed
                    ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
                    : "bg-gradient-to-br from-red-50 to-rose-50 border-red-200"
                }`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    quizResult.passed ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {quizResult.passed ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-500" />
                    )}
                  </div>
                  <h3 className="text-2xl font-serif font-bold mb-1">
                    {quizResult.passed ? "Congratulations!" : "Not Quite There"}
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    Score: <span className="font-bold text-foreground">{quizResult.score}%</span>
                    <span className="text-sm ml-2">
                      ({quizResult.answerResults.filter((a: any) => a.isCorrect).length}/{quizResult.answerResults.length} correct)
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  {quizResult.answerResults.map((result: any, i: number) => (
                    <div key={i} className={`rounded-xl border overflow-hidden ${result.isCorrect ? "border-green-200" : "border-red-200"}`}>
                      <div className={`px-5 py-3 flex items-center gap-2 ${result.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
                        {result.isCorrect ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="font-medium text-sm">Question {i + 1}</span>
                      </div>
                      <div className="p-5 bg-card">
                        <p className="font-medium mb-3 text-[15px]">{quizQuestions[i]?.prompt}</p>
                        <div className="space-y-2">
                          {quizQuestions[i]?.options?.map((opt: string, oi: number) => (
                            <div key={oi} className={`flex items-center gap-2.5 p-3 rounded-lg text-sm ${
                              oi === result.correctIndex ? "bg-green-50 text-green-800 font-medium ring-1 ring-green-200" :
                              oi === result.userAnswer && !result.isCorrect ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-muted/30"
                            }`}>
                              {oi === result.correctIndex ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> :
                               oi === result.userAnswer && !result.isCorrect ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> :
                               <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />}
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                        {result.explanation && (
                          <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <p className="text-sm text-blue-800 italic">{result.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button size="lg" className="rounded-lg" onClick={() => { setQuizResult(null); setQuizAnswers(new Array(quizQuestions.length).fill(-1)); }} data-testid="button-retake-quiz">
                  Retake Quiz
                </Button>
              </div>
            ) : (
              <div className="space-y-5" data-testid="quiz-form">
                {quizQuestions.map((question, qi) => (
                  <div key={qi} className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden" data-testid={`quiz-question-${qi}`}>
                    <div className="px-5 py-3 bg-muted/30 border-b border-border/50">
                      <span className="text-xs font-semibold text-muted-foreground">Question {qi + 1} of {quizQuestions.length}</span>
                    </div>
                    <div className="p-5">
                      <p className="font-medium text-[15px] mb-4">{question.prompt}</p>
                      <div className="space-y-2.5">
                        {question.options?.map((opt: string, oi: number) => (
                          <label
                            key={oi}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                              quizAnswers[qi] === oi
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "hover:bg-muted/40 border-border/50 hover:border-border"
                            }`}
                            data-testid={`quiz-option-${qi}-${oi}`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              quizAnswers[qi] === oi ? "border-primary bg-primary" : "border-border"
                            }`}>
                              {quizAnswers[qi] === oi && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <input
                              type="radio"
                              name={`q-${qi}`}
                              checked={quizAnswers[qi] === oi}
                              onChange={() => {
                                const newAnswers = [...quizAnswers];
                                newAnswers[qi] = oi;
                                setQuizAnswers(newAnswers);
                              }}
                              className="sr-only"
                            />
                            <span className="text-[14px]">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-start gap-3 mb-4 p-4 rounded-xl border border-border/50 bg-card shadow-sm">
                  <Checkbox
                    id="honor-code-quiz"
                    checked={honorCodeChecked}
                    onCheckedChange={(checked) => setHonorCodeChecked(checked === true)}
                    data-testid="checkbox-honor-code-quiz"
                  />
                  <label htmlFor="honor-code-quiz" className="text-sm leading-relaxed cursor-pointer">
                    I declare that I have completed this lesson honestly and will not use other people's answers. I understand that any suspicious activity may result in disqualification.
                  </label>
                </div>

                <div className="pt-4">
                  <Button
                    size="lg"
                    className="rounded-lg w-full sm:w-auto"
                    onClick={handleSubmitQuiz}
                    disabled={submittingQuiz || quizAnswers.some(a => a === -1) || !honorCodeChecked}
                    data-testid="button-submit-quiz"
                  >
                    {submittingQuiz ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Submit Answers
                  </Button>
                  {quizAnswers.some(a => a === -1) && (
                    <p className="text-xs text-muted-foreground mt-2">Answer all questions to submit.</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    if (selectedItem.type === "lab") {
      const lab = selectedItem.data;
      return (
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-10">
          <motion.div
            key={lab.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                  Hands-on Lab
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold" data-testid="text-lab-title">{lab.title}</h1>
            </div>

            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden mb-6" data-testid="lab-instructions">
              <div className="px-5 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instructions</span>
              </div>
              <div className="px-6 py-6 md:px-8">
                {formatRichText(lab.instructions)}
              </div>
            </div>

            {lab.resources && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 overflow-hidden mb-6" data-testid="lab-resources">
                <div className="px-5 py-3 border-b border-blue-100 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Resources</span>
                </div>
                <div className="px-6 py-4">
                  {formatRichText(lab.resources)}
                </div>
              </div>
            )}

            {labSubmission ? (
              <div className="p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 text-center" data-testid="lab-completed">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-serif font-bold text-green-800">Lab Completed</h3>
                <p className="text-sm text-green-600 mt-1">
                  Submitted on {new Date(labSubmission.submittedAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden" data-testid="lab-submission-form">
                <div className="px-5 py-3 bg-muted/30 border-b border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Submission</span>
                </div>
                <div className="p-6 space-y-4">
                  <Textarea
                    placeholder="Describe your work, paste results, or add notes..."
                    value={labText}
                    onChange={(e) => setLabText(e.target.value)}
                    className="min-h-[140px] rounded-lg"
                    data-testid="input-lab-submission"
                  />
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
                    <Checkbox
                      id="honor-code-lab"
                      checked={honorCodeChecked}
                      onCheckedChange={(checked) => setHonorCodeChecked(checked === true)}
                      data-testid="checkbox-honor-code-lab"
                    />
                    <label htmlFor="honor-code-lab" className="text-sm leading-relaxed cursor-pointer">
                      I declare that I have completed this lesson honestly and will not use other people's answers. I understand that any suspicious activity may result in disqualification.
                    </label>
                  </div>
                  <Button
                    size="lg"
                    className="rounded-lg"
                    onClick={handleSubmitLab}
                    disabled={submittingLab || !honorCodeChecked}
                    data-testid="button-submit-lab"
                  >
                    {submittingLab ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Mark Lab as Complete
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    if (selectedItem.type === "certificate") {
      return (
        <div className="max-w-2xl mx-auto px-4 py-6 md:px-8 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-10">
              <div className={`w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center ${
                canGetCertificate || certificate ? "bg-yellow-100" : "bg-muted"
              }`}>
                <Award className={`w-10 h-10 ${canGetCertificate || certificate ? "text-yellow-600" : "text-muted-foreground"}`} />
              </div>
              <h1 className="text-3xl font-serif font-bold mb-2" data-testid="text-certificate-heading">
                Course Certificate
              </h1>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Complete all lessons and pass all progress tests to earn your verified certificate.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${completedCount === totalLessons ? "bg-green-50 border-green-200" : "border-border"}`}>
                {completedCount === totalLessons ? (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground shrink-0" />
                )}
                <span className="text-sm flex-1">Complete all lessons</span>
                <span className="text-xs font-semibold text-muted-foreground">{completedCount}/{totalLessons}</span>
              </div>

              {(quizzesData || []).filter((q: any) => q.quizType === "progress_test").map((test: any) => (
                <div
                  key={test.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${passedQuizIds.has(test.id) ? "bg-green-50 border-green-200" : "border-border"}`}
                >
                  {passedQuizIds.has(test.id) ? (
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm flex-1">Pass: {test.title}</span>
                  {passedQuizIds.has(test.id) && <span className="text-xs font-semibold text-green-600">Passed</span>}
                </div>
              ))}
            </div>

            {certificate && certificate.paid ? (
              <div className="space-y-6">
                <div className="relative bg-gradient-to-br from-[#faf5eb] via-[#f5eedf] to-[#faf5eb] border-2 border-amber-400 rounded-2xl overflow-hidden shadow-xl" data-testid="certificate-display">
                  <div className="absolute top-0 left-0 right-0 h-2 bg-[#1c2852]" />
                  <div className="absolute top-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#1c2852]" />
                  <div className="absolute bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
                  <div className="absolute inset-4 border border-amber-300/60 rounded-xl pointer-events-none" />
                  <div className="absolute inset-5 border border-dashed border-amber-200/40 rounded-xl pointer-events-none" />
                  <div className="relative px-6 sm:px-10 py-10 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-14 h-14 rounded-full bg-[#1c2852] flex items-center justify-center shadow-md border-2 border-amber-300">
                        <GraduationCap className="w-7 h-7 text-amber-400" />
                      </div>
                    </div>
                    <p className="text-xs font-bold tracking-[0.35em] uppercase text-[#1c2852] mb-0.5">Lumina Wealth Academy</p>
                    <p className="text-[10px] italic tracking-wider text-amber-600 mb-1">Excellence in Education</p>
                    <div className="w-48 h-px mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent mb-4" />
                    <p className="text-base font-serif font-bold tracking-[0.2em] uppercase text-[#1c2852] mb-5">
                      {(course as any)?.level ? (course as any).level.toUpperCase() : "CERTIFICATE OF COMPLETION"}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">This is to certify that</p>
                    <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1c2852] mb-2 pb-2 border-b-2 border-amber-400 inline-block max-w-full break-words" data-testid="text-cert-name">{certificate.userName}</h3>
                    <p className="text-sm text-gray-500 mt-4 mb-2">has successfully completed the course</p>
                    <h4 className="text-lg sm:text-xl font-serif font-semibold text-[#1c2852] mb-1 max-w-full break-words" data-testid="text-cert-course">{certificate.courseTitle}</h4>
                    <p className="text-sm text-gray-500 mb-8">Instructor: {certificate.instructorName}</p>
                    <div className="flex items-end justify-between gap-4 pt-4 border-t border-amber-300/60">
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-4">
                          <div className="text-left">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Date Issued</p>
                            <p className="text-xs text-gray-600 font-medium">{new Date(certificate.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Certificate ID</p>
                            <p className="text-[10px] font-mono font-bold text-gray-600 break-all">{certificate.verificationToken}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <img src="/signature-clean.png" alt="Signature" className="h-10 mx-auto mb-1 opacity-80" />
                          <p className="text-xs font-serif font-bold text-[#1c2852]">Augustus Siziba</p>
                          <p className="text-[9px] text-gray-400">Founder & Director of Education</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <QRCodeSVG
                          value={`${window.location.origin}/verify/${certificate.verificationToken}`}
                          size={80}
                          level="M"
                          bgColor="transparent"
                          fgColor="#1c2852"
                        />
                        <p className="text-[8px] text-gray-400 mt-1">Scan to Verify</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={handleDownloadCertificate}
                    className="bg-amber-600 hover:bg-amber-700 flex-1 rounded-lg"
                    data-testid="button-download-certificate"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Certificate
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="flex-1 rounded-lg"
                    data-testid="button-verify-certificate"
                  >
                    <a href={"/verify/" + certificate.verificationToken} target="_blank" rel="noopener noreferrer">
                      <Shield className="w-4 h-4 mr-2" />
                      Verify Online
                    </a>
                  </Button>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t">
                  <button
                    onClick={() => setCourseFeedback(courseFeedback === "like" ? null : "like")}
                    className={"flex items-center gap-1.5 text-sm transition-colors " + (courseFeedback === "like" ? "text-blue-600 font-medium" : "text-muted-foreground hover:text-foreground")}
                    data-testid="button-like"
                  >
                    <ThumbsUp className="w-4 h-4" /> Like
                  </button>
                  <button
                    onClick={() => setCourseFeedback(courseFeedback === "dislike" ? null : "dislike")}
                    className={"flex items-center gap-1.5 text-sm transition-colors " + (courseFeedback === "dislike" ? "text-red-500 font-medium" : "text-muted-foreground hover:text-foreground")}
                    data-testid="button-dislike"
                  >
                    <ThumbsDown className="w-4 h-4" /> Dislike
                  </button>
                  <button
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toast({ title: "Report submitted", description: "Thank you for your feedback." })}
                    data-testid="button-report"
                  >
                    <Flag className="w-4 h-4" /> Report an issue
                  </button>
                </div>
              </div>
            ) : certificate && !certificate.paid ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 text-center" data-testid="certificate-payment-required">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">Certificate Ready!</h3>
                  <p className="text-muted-foreground mb-6 text-sm">
                    You've earned your certificate. Pay <span className="font-bold text-foreground">${`$${course.certificateFee || 100}`} USD</span> to download your verified certificate.
                  </p>

                  {certPaymentStep === "idle" && (
                    <Button
                      size="lg"
                      onClick={() => setCertPaymentStep("form")}
                      className="bg-blue-600 hover:bg-blue-700 rounded-lg"
                      data-testid="button-start-cert-payment"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay ${`$${course.certificateFee || 100}`} to Download
                    </Button>
                  )}

                  {certPaymentStep === "form" && (
                    <div className="mt-4 space-y-4 text-left max-w-sm mx-auto">
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Payment Method</label>
                        <select
                          className="w-full border rounded-lg p-2.5 text-sm bg-background"
                          value={certPaymentMethod}
                          onChange={(e) => setCertPaymentMethod(e.target.value)}
                          data-testid="select-cert-payment-method"
                        >
                          <option value="web">Paynow (Web)</option>
                          <option value="ecocash">EcoCash</option>
                          <option value="onemoney">OneMoney</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Email</label>
                        <input
                          type="email"
                          className="w-full border rounded-lg p-2.5 text-sm bg-background"
                          placeholder="your@email.com"
                          value={certEmail}
                          onChange={(e) => setCertEmail(e.target.value)}
                          data-testid="input-cert-email"
                        />
                      </div>
                      {(certPaymentMethod === "ecocash" || certPaymentMethod === "onemoney") && (
                        <div>
                          <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                          <input
                            type="tel"
                            className="w-full border rounded-lg p-2.5 text-sm bg-background"
                            placeholder="0771234567"
                            value={certPhone}
                            onChange={(e) => setCertPhone(e.target.value)}
                            data-testid="input-cert-phone"
                          />
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg"
                          onClick={handleCertPaymentInitiate}
                          data-testid="button-confirm-cert-payment"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Pay ${`$${course.certificateFee || 100}`}
                        </Button>
                        <Button variant="outline" onClick={() => setCertPaymentStep("idle")} className="rounded-lg">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {certPaymentStep === "processing" && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Processing payment...</span>
                    </div>
                  )}

                  {certPaymentStep === "checking" && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Complete your payment, then click below to verify.</p>
                      {certRedirectUrl && certPaymentMethod === "web" && (
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => window.open(certRedirectUrl, "_blank")}>
                          Open Payment Page
                        </Button>
                      )}
                      <Button
                        className="bg-green-600 hover:bg-green-700 rounded-lg"
                        onClick={handleCertPaymentCheck}
                        data-testid="button-verify-cert-payment"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verify Payment
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : canGetCertificate ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6">
                  <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Lumina Wealth Honor Code
                    <a href="#" className="text-sm text-blue-600 font-normal inline-flex items-center gap-1 ml-auto">Learn more <ExternalLink className="w-3 h-3" /></a>
                  </h3>
                  <div className="flex items-start gap-3 mt-4">
                    <Checkbox
                      id="honor-code"
                      checked={honorCodeAccepted}
                      onCheckedChange={(checked) => setHonorCodeAccepted(checked === true)}
                      data-testid="checkbox-honor-code"
                    />
                    <label htmlFor="honor-code" className="text-sm leading-relaxed cursor-pointer">
                      I, <span className="font-semibold">{user?.firstName || user?.email || "Student"}</span>, understand that submitting work that isn't my own may result in permanent failure of this course or deactivation of my Lumina Wealth account.*
                    </label>
                  </div>
                  {!honorCodeAccepted && (
                    <p className="text-xs text-red-500 mt-2 ml-7">You must select the checkbox in order to submit the assignment</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    onClick={handleGenerateCertificate}
                    disabled={generatingCert || !honorCodeAccepted}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-lg"
                    data-testid="button-generate-certificate"
                  >
                    {generatingCert ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Award className="w-4 h-4 mr-2" />
                    )}
                    Submit
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  A fee of <span className="font-semibold">${`$${course.certificateFee || 100}`} USD</span> is required to download your verified certificate after submission.
                </p>

                <div className="flex items-center gap-6 pt-4 border-t">
                  <button
                    onClick={() => setCourseFeedback(courseFeedback === "like" ? null : "like")}
                    className={"flex items-center gap-1.5 text-sm transition-colors " + (courseFeedback === "like" ? "text-blue-600 font-medium" : "text-muted-foreground hover:text-foreground")}
                    data-testid="button-like"
                  >
                    <ThumbsUp className="w-4 h-4" /> Like
                  </button>
                  <button
                    onClick={() => setCourseFeedback(courseFeedback === "dislike" ? null : "dislike")}
                    className={"flex items-center gap-1.5 text-sm transition-colors " + (courseFeedback === "dislike" ? "text-red-500 font-medium" : "text-muted-foreground hover:text-foreground")}
                    data-testid="button-dislike"
                  >
                    <ThumbsDown className="w-4 h-4" /> Dislike
                  </button>
                  <button
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toast({ title: "Report submitted", description: "Thank you for your feedback." })}
                    data-testid="button-report"
                  >
                    <Flag className="w-4 h-4" /> Report an issue
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 rounded-2xl bg-muted/20 border border-border" data-testid="certificate-locked">
                <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1">Certificate Locked</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Complete all requirements above to unlock your certificate.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="course-player">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/80 backdrop-blur-sm z-30 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/course/${courseId}`)}
            className="gap-1.5"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Back to Course</span>
          </Button>
        </div>
        <h1 className="font-serif font-semibold text-sm truncate max-w-[200px] md:max-w-md" data-testid="text-header-title">
          {course.title}
        </h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Progress value={progressPercent} className="h-1.5 w-20" />
            <span className="text-xs font-medium text-muted-foreground" data-testid="text-header-progress">
              {progressPercent}%
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            className="h-8 w-8"
            data-testid="button-home"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="hidden md:flex w-80 border-r border-border flex-col bg-card overflow-hidden shrink-0" data-testid="sidebar-desktop">
          {sidebarContent}
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
                data-testid="sidebar-overlay"
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed top-14 left-0 bottom-0 w-80 bg-card border-r border-border z-50 md:hidden overflow-hidden shadow-xl"
                data-testid="sidebar-mobile"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-background to-muted/20" data-testid="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
