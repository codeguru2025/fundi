import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  fetchCourse,
  checkCoursePurchase,
  initiateCoursePayment,
  checkCoursePaymentStatus,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  PlayCircle,
  FileText,
  Clock,
  Lock,
  GraduationCap,
  Loader2,
  CheckCircle,
  Star,
  ArrowLeft,
  LogIn,
  CreditCard,
  Smartphone,
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

type PaymentMethod = "web" | "ecocash" | "onemoney";
type PaymentStep = "method" | "processing" | "instructions" | "success" | "error";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const courseId = id || "";

  const [isPurchased, setIsPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const [paymentStep, setPaymentStep] = useState<PaymentStep>("method");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("web");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [pollUrl, setPollUrl] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourse(courseId),
    enabled: !!courseId,
  });

  const [isInstructorFromServer, setIsInstructorFromServer] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      setCheckingPurchase(true);
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
      setCheckingPurchase(false);
    }
    if (courseId) {
      checkAccess();
    }
  }, [courseId, user?.id]);

  const isInstructor = isInstructorFromServer || (user?.id && course?.instructorId && user.id === String(course.instructorId));
  const isAdmin = user?.isAdmin === true;
  const hasAccess = isPurchased || isInstructor || isAdmin;

  const resetPaymentState = () => {
    setPaymentStep("method");
    setPaymentMethod("web");
    setPhone("");
    setEmail("");
    setPaymentError("");
    setPollUrl("");
    setIsPolling(false);
  };

  const handleClosePayment = () => {
    resetPaymentState();
    setShowPaymentDialog(false);
  };

  const initiatePayment = async () => {
    setPaymentStep("processing");
    setPaymentError("");

    try {
      const buyerToken = user?.id || getBuyerToken();
      const data = await initiateCoursePayment({
        courseId,
        buyerToken,
        email,
        phone: paymentMethod !== "web" ? phone : undefined,
        paymentMethod,
      });

      if (data.success) {
        setPollUrl(data.pollUrl);
        if (paymentMethod === "web" && data.redirectUrl) {
          window.open(data.redirectUrl, "_blank");
          setPaymentStep("instructions");
        } else if (data.instructions) {
          setPaymentStep("instructions");
        } else {
          setPaymentStep("instructions");
        }
      } else {
        throw new Error(data.error || "Payment failed");
      }
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed. Please try again.");
      setPaymentStep("error");
    }
  };

  const checkPaymentStatus = async () => {
    if (!pollUrl) return;
    setIsPolling(true);

    try {
      const buyerToken = user?.id || getBuyerToken();
      const data = await checkCoursePaymentStatus({
        pollUrl,
        courseId,
        buyerToken,
        email,
      });

      if (data.paid) {
        setPaymentStep("success");
        setIsPurchased(true);
        queryClient.invalidateQueries({ queryKey: ["course", courseId] });
        toast({ title: "Payment successful!", description: "You now have full access to this course." });
        setTimeout(() => {
          handleClosePayment();
        }, 2000);
      } else {
        toast({
          title: "Payment pending",
          description: `Status: ${data.status}. Please complete your payment and try again.`,
          variant: "destructive",
        });
      }
    } catch {
      setPaymentError("Failed to check payment status");
    } finally {
      setIsPolling(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center" data-testid="loading-course">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center" data-testid="course-not-found">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-serif font-bold mb-2">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">This course doesn't exist or has been removed.</p>
          <Button asChild>
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const modules = course.modules || [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link href="/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors" data-testid="link-back-courses">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses
        </Link>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-center md:justify-end"
          >
            <div className="relative w-full max-w-md aspect-video rounded-lg shadow-2xl overflow-hidden" data-testid="img-course-cover">
              {course.cover ? (
                <img
                  src={course.cover}
                  alt={course.title}
                  className="object-contain w-full h-full bg-gray-50"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center">
                  <GraduationCap className="w-20 h-20 text-white/80" />
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs uppercase tracking-wider" data-testid="badge-category">
                {course.category || "Course"}
              </Badge>
              {(course as any).level && (
                <Badge variant="secondary" className="text-xs uppercase tracking-wider bg-amber-100 text-amber-800 border-amber-300" data-testid="badge-level">
                  {(course as any).level}
                </Badge>
              )}
              {hasAccess && (
                <Badge className="text-xs uppercase tracking-wider bg-green-100 text-green-800 border-green-200" data-testid="badge-access">
                  {isInstructor ? "Your Course" : "Purchased"}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4" data-testid="text-course-title">
              {course.title}
            </h1>
            {!course.isApproved && (
              <Badge variant="outline" className="mb-3 border-amber-500 text-amber-600 bg-amber-50" data-testid="badge-pending-approval">
                Pending Admin Approval
              </Badge>
            )}
            <p className="text-xl text-muted-foreground mb-4 font-serif italic" data-testid="text-instructor">
              by {course.instructorName || "Unknown Instructor"}
            </p>

            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              {course.totalLessons > 0 && (
                <span className="flex items-center gap-1" data-testid="text-total-lessons">
                  <PlayCircle className="w-4 h-4" /> {course.totalLessons} lessons
                </span>
              )}
              {course.totalDuration && (
                <span className="flex items-center gap-1" data-testid="text-total-duration">
                  <Clock className="w-4 h-4" /> {course.totalDuration}
                </span>
              )}
            </div>

            {course.description && (
              <p className="text-lg leading-relaxed text-foreground/80 mb-8 border-l-4 border-primary/20 pl-4" data-testid="text-description">
                {course.description}
              </p>
            )}

            <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {hasAccess ? "You have access" : "Total Price"}
                  </p>
                  <p className="text-3xl font-bold text-primary" data-testid="text-price">
                    {hasAccess ? (isInstructor ? "Instructor" : "Purchased") : `$${(course.price ?? 29.99).toFixed(2)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Format: Online</p>
                  <p className="text-xs text-muted-foreground">Lifetime Access</p>
                </div>
              </div>

              <div className="space-y-3">
                {hasAccess ? (
                  <Button
                    size="lg"
                    className="w-full text-lg h-14"
                    onClick={() => setLocation(`/course/${courseId}/learn`)}
                    data-testid="button-start-learning"
                  >
                    <GraduationCap className="w-5 h-5 mr-2" /> Start Learning
                  </Button>
                ) : isAuthenticated ? (
                  <Button
                    size="lg"
                    className="w-full text-lg h-14"
                    onClick={() => setShowPaymentDialog(true)}
                    data-testid="button-buy-course"
                  >
                    <GraduationCap className="w-5 h-5 mr-2" /> Buy Now - ${(course.price ?? 29.99).toFixed(2)}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full text-lg h-14"
                    asChild
                    data-testid="button-signin-to-buy"
                  >
                    <a href="/api/login">
                      <LogIn className="w-5 h-5 mr-2" /> Sign In to Purchase - ${(course.price ?? 29.99).toFixed(2)}
                    </a>
                  </Button>
                )}
                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Secure payment via Paynow
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {modules.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-serif font-bold mb-6" data-testid="text-curriculum-heading">
              Course Curriculum
            </h2>
            <div className="space-y-4" data-testid="list-modules">
              {modules.map((mod: any, modIndex: number) => (
                <div
                  key={mod.id}
                  className="border border-border rounded-xl overflow-hidden"
                  data-testid={`module-${mod.id}`}
                >
                  <div className="bg-muted/50 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-semibold" data-testid={`text-module-title-${mod.id}`}>
                      Module {modIndex + 1}: {mod.title}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {(mod.lessons || []).length} lessons
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {(mod.lessons || []).map((lesson: any) => (
                      <div
                        key={lesson.id}
                        className="px-6 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        data-testid={`lesson-${lesson.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {lesson.contentType === "video" ? (
                            <PlayCircle className="w-4 h-4 text-primary" />
                          ) : (
                            <FileText className="w-4 h-4 text-primary" />
                          )}
                          <span className="text-sm" data-testid={`text-lesson-title-${lesson.id}`}>
                            {lesson.title}
                          </span>
                          {lesson.isFreePreview && (
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-free-preview-${lesson.id}`}>
                              Free Preview
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {lesson.duration && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-lesson-duration-${lesson.id}`}>
                              <Clock className="w-3 h-3" /> {lesson.duration}
                            </span>
                          )}
                          {!hasAccess && !lesson.isFreePreview && (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={handleClosePayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase "{course.title}"</DialogTitle>
            <DialogDescription>
              Total: ${(course.price ?? 29.99).toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          {paymentStep === "method" && (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <Label>Select Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="web" id="course-web" />
                    <Label htmlFor="course-web" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Pay Online</p>
                        <p className="text-xs text-muted-foreground">Card, Ecocash, or OneMoney via Paynow</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="ecocash" id="course-ecocash" />
                    <Label htmlFor="course-ecocash" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">Ecocash Express</p>
                        <p className="text-xs text-muted-foreground">Pay directly from your phone</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="onemoney" id="course-onemoney" />
                    <Label htmlFor="course-onemoney" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="font-medium">OneMoney Express</p>
                        <p className="text-xs text-muted-foreground">Pay directly from your phone</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {(paymentMethod === "ecocash" || paymentMethod === "onemoney") && (
                <div className="space-y-2">
                  <Label htmlFor="course-phone">Phone Number</Label>
                  <Input
                    id="course-phone"
                    placeholder="0771234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-testid="input-phone"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="course-email">Email (optional, for receipt)</Label>
                <Input
                  id="course-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>

              <Button
                className="w-full"
                onClick={initiatePayment}
                disabled={paymentMethod !== "web" && !phone}
                data-testid="button-proceed-payment"
              >
                Proceed to Pay ${(course.price ?? 29.99).toFixed(2)}
              </Button>
            </div>
          )}

          {paymentStep === "processing" && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-lg font-medium">Processing Payment...</p>
              <p className="text-sm text-muted-foreground">Please wait while we connect to Paynow</p>
            </div>
          )}

          {paymentStep === "instructions" && (
            <div className="py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">Payment initiated. Click below to check if your payment was successful.</p>
              </div>
              <Button
                className="w-full"
                onClick={checkPaymentStatus}
                disabled={isPolling}
                data-testid="button-check-status"
              >
                {isPolling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Payment Status"
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClosePayment}>
                Cancel
              </Button>
            </div>
          )}

          {paymentStep === "success" && (
            <div className="py-8 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="text-xl font-bold text-green-700">Payment Successful!</p>
              <p className="text-muted-foreground mt-2">You now have full access to this course.</p>
            </div>
          )}

          {paymentStep === "error" && (
            <div className="py-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{paymentError}</p>
              </div>
              <Button className="w-full" onClick={() => setPaymentStep("method")} data-testid="button-try-again">
                Try Again
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClosePayment}>
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
