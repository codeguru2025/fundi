import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { createCourse } from "@/lib/api";
import { formatRichText } from "@/lib/format-rich-text";
import { useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogIn, GraduationCap, ChevronRight, ChevronLeft, Plus, Trash2, Check,
  FileText, Video, Image, BookOpen, Eye, HelpCircle, FlaskConical, Award, Save, Upload,
  Mic, MicOff, Square, Settings, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoRecorder } from "@/components/video-recorder";

const CATEGORIES = [
  "Business", "Entrepreneurship", "Technology", "Marketing", "Finance",
  "Personal Development", "Leadership", "Education", "Design",
  "Health & Wellness", "Science", "Law", "Engineering", "Agriculture",
  "Real Estate", "Cryptocurrency", "Sales", "Communication", "Other"
];

const COURSE_LEVELS = [
  "Certificate",
  "Advanced Certificate",
  "Diploma",
  "Advanced Diploma",
  "Professional Certificate",
  "Executive Programme",
];

const STEPS = [
  { id: "info", title: "Course Info", icon: FileText },
  { id: "modules", title: "Modules & Content", icon: BookOpen },
  { id: "quizzes", title: "Quizzes & Tests", icon: HelpCircle },
  { id: "labs", title: "Labs (Optional)", icon: FlaskConical },
  { id: "cover", title: "Cover Image", icon: Image },
  { id: "review", title: "Review & Publish", icon: Eye },
];

interface QuestionData {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizData {
  title: string;
  quizType: "revision" | "progress_test";
  passingScore: number;
  questions: QuestionData[];
}

interface LessonData {
  title: string;
  contentType: "video" | "text" | "image" | "presentation" | "infographic";
  videoUrl: string;
  textContent: string;
  imageUrl: string;
  voiceoverUrl: string;
  duration: string;
  isFreePreview: boolean;
}

interface ModuleData {
  title: string;
  lessons: LessonData[];
  quizzes: QuizData[];
}

interface LabData {
  title: string;
  instructions: string;
  resources: string;
}

function createEmptyQuestion(): QuestionData {
  return { prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" };
}

function createEmptyQuiz(type: "revision" | "progress_test" = "revision"): QuizData {
  return {
    title: type === "progress_test" ? "Module Progress Test" : "Revision Exercise",
    quizType: type,
    passingScore: 70,
    questions: [createEmptyQuestion()],
  };
}

function createEmptyLesson(): LessonData {
  return {
    title: "",
    contentType: "video",
    videoUrl: "",
    textContent: "",
    imageUrl: "",
    voiceoverUrl: "",
    duration: "",
    isFreePreview: false,
  };
}

function createEmptyModule(): ModuleData {
  return {
    title: "",
    lessons: [createEmptyLesson()],
    quizzes: [],
  };
}

function createEmptyLab(): LabData {
  return { title: "", instructions: "", resources: "" };
}

function VoiceoverRecorder({ voiceoverUrl, onRecorded, onRemove, testIdPrefix }: {
  voiceoverUrl: string;
  onRecorded: (url: string) => void;
  onRemove: () => void;
  testIdPrefix: string;
}) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [showDevices, setShowDevices] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useState<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(d => d.kind === "audioinput");
      setAudioDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    }).catch(() => {});
  }, []);

  const startRecording = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioInputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
      setAudioDevices(audioInputs);

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", blob, `voiceover-${Date.now()}.webm`);
          const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
          const data = await res.json();
          if (data.url) onRecorded(data.url);
        } catch {
          toast({ title: "Upload failed", variant: "destructive" });
        }
        setUploading(false);
        setRecordingTime(0);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setRecordingTime(0);
      const interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
      timerRef[1](interval);
    } catch (err) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voiceovers.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setRecording(false);
      if (timerRef[0]) clearInterval(timerRef[0]);
      timerRef[1](null);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-muted/20" data-testid={`${testIdPrefix}-section`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Mic className="w-4 h-4" /> Voiceover
        </Label>
        <button
          type="button"
          onClick={() => setShowDevices(!showDevices)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          data-testid={`${testIdPrefix}-device-toggle`}
        >
          <Settings className="w-3 h-3" /> Audio Input
        </button>
      </div>

      {showDevices && audioDevices.length > 0 && (
        <select
          className="w-full border rounded-md p-2 text-xs bg-background"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          data-testid={`${testIdPrefix}-device-select`}
        >
          {audioDevices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        {recording ? (
          <>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-1.5"
              data-testid={`${testIdPrefix}-stop`}
            >
              <Square className="w-3 h-3" /> Stop
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-red-600">{formatTime(recordingTime)}</span>
            </div>
          </>
        ) : uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading voiceover...
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
            className="gap-1.5"
            data-testid={`${testIdPrefix}-start`}
          >
            <Mic className="w-3.5 h-3.5 text-red-500" /> Record Voiceover
          </Button>
        )}

        {voiceoverUrl && !recording && !uploading && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs">
            <Upload className="w-3 h-3" /> Replace file
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const formData = new FormData();
                formData.append("file", file);
                try {
                  const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                  const data = await res.json();
                  if (data.url) onRecorded(data.url);
                } catch {}
                setUploading(false);
              }}
              data-testid={`${testIdPrefix}-upload`}
            />
          </label>
        )}

        {!voiceoverUrl && !recording && !uploading && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs">
            <Upload className="w-3 h-3" /> Upload file
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const formData = new FormData();
                formData.append("file", file);
                try {
                  const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                  const data = await res.json();
                  if (data.url) onRecorded(data.url);
                } catch {}
                setUploading(false);
              }}
              data-testid={`${testIdPrefix}-upload-new`}
            />
          </label>
        )}
      </div>

      {voiceoverUrl && (
        <div className="flex items-center gap-2 mt-1">
          <audio src={voiceoverUrl} controls className="h-8 flex-1" data-testid={`${testIdPrefix}-preview`} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 h-8 px-2"
            data-testid={`${testIdPrefix}-remove`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

const COURSE_DRAFT_KEY = "lumina_course_draft";

function loadCourseDraft(): any | null {
  try {
    const saved = localStorage.getItem(COURSE_DRAFT_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export default function CreateCourse() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [, params] = useRoute("/edit-course/:id");
  const editCourseId = params?.id || null;
  const isEditMode = !!editCourseId;

  const draft = editCourseId ? null : loadCourseDraft();

  const [currentStep, setCurrentStep] = useState(draft?.step || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const [title, setTitle] = useState(draft?.title || "");
  const [description, setDescription] = useState(draft?.description || "");
  const [category, setCategory] = useState(draft?.category || "Business");
  const [level, setLevel] = useState(draft?.level || "Certificate");
  const [price, setPrice] = useState(draft?.price || "29.99");
  const [certificateFee, setCertificateFee] = useState(draft?.certificateFee || "100");

  const [modules, setModules] = useState<ModuleData[]>(draft?.modules || [createEmptyModule()]);
  const [labs, setLabs] = useState<LabData[]>(draft?.labs || []);

  const [coverUrl, setCoverUrl] = useState(draft?.coverUrl || "");
  const [uploadingLessons, setUploadingLessons] = useState<Record<string, number>>({});
  const [showRecorder, setShowRecorder] = useState<string | null>(null);
  const [editLoaded, setEditLoaded] = useState(false);

  const { data: existingCourse, isLoading: loadingExisting } = useQuery({
    queryKey: ["edit-course", editCourseId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/courses/${editCourseId}/full`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load course");
      return res.json();
    },
    enabled: !!editCourseId,
  });

  useEffect(() => {
    if (existingCourse && !editLoaded) {
      setEditLoaded(true);
      setTitle(existingCourse.title || "");
      setDescription(existingCourse.description || "");
      setCategory(existingCourse.category || "Business");
      setLevel(existingCourse.level || "Certificate");
      setPrice(String(existingCourse.price || "29.99"));
      setCertificateFee(String(existingCourse.certificateFee || "100"));
      setCoverUrl(existingCourse.cover || "");

      if (existingCourse.modules && existingCourse.modules.length > 0) {
        const loadedModules: ModuleData[] = existingCourse.modules.map((mod: any) => ({
          title: mod.title || "",
          lessons: (mod.lessons || []).map((l: any) => ({
            title: l.title || "",
            contentType: l.contentType || "video",
            videoUrl: l.videoUrl || "",
            textContent: l.textContent || "",
            imageUrl: l.imageUrl || "",
            voiceoverUrl: l.voiceoverUrl || "",
            duration: l.duration || "",
            isFreePreview: l.isFreePreview || false,
          })),
          quizzes: (mod.quizzes || []).map((q: any) => ({
            title: q.title || "",
            quizType: q.quizType || "revision",
            passingScore: q.passingScore || 70,
            questions: (q.questions || []).map((qu: any) => ({
              prompt: qu.prompt || "",
              options: qu.options || ["", "", "", ""],
              correctIndex: qu.correctIndex ?? 0,
              explanation: qu.explanation || "",
            })),
          })),
        }));
        setModules(loadedModules);
      }

      if (existingCourse.labs && existingCourse.labs.length > 0) {
        setLabs(existingCourse.labs.map((l: any) => ({
          title: l.title || "",
          instructions: l.instructions || "",
          resources: l.resources || "",
        })));
      }
    }
  }, [existingCourse, editLoaded]);

  const saveDraft = useCallback(() => {
    if (isEditMode) return;
    try {
      localStorage.setItem(COURSE_DRAFT_KEY, JSON.stringify({
        title, description, category, level, price, certificateFee, modules, labs, coverUrl, step: currentStep,
      }));
    } catch {}
  }, [title, description, category, level, price, certificateFee, modules, labs, coverUrl, currentStep, isEditMode]);

  const clearDraft = () => {
    localStorage.removeItem(COURSE_DRAFT_KEY);
  };

  const handleSaveDraft = () => {
    saveDraft();
    setSaveIndicator(true);
    toast({ title: "Draft saved", description: "Your course progress has been saved. You can continue later." });
    setTimeout(() => setSaveIndicator(false), 2000);
  };

  const isReadyToPublish = !!(
    title.trim() &&
    description.trim() &&
    category &&
    parseFloat(price) >= 0 &&
    modules.length > 0 &&
    modules.every(m => m.title.trim() && m.lessons.length > 0 && m.lessons.every(l => l.title.trim()))
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-4" data-testid="text-signin-heading">
              Admin Access Required
            </h1>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed" data-testid="text-signin-description">
              Course creation is only available to administrators.
            </p>
            {!isAuthenticated && (
              <Button asChild size="lg" className="text-lg px-8" data-testid="button-signin-to-create">
                <a href="/api/login">
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In
                </a>
              </Button>
            )}
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (isEditMode && loadingExisting) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading course for editing...</div>
        </div>
      </Layout>
    );
  }

  const updateModule = (moduleIndex: number, updates: Partial<ModuleData>) => {
    setModules((prev) =>
      prev.map((m, i) => (i === moduleIndex ? { ...m, ...updates } : m))
    );
  };

  const updateLesson = (moduleIndex: number, lessonIndex: number, updates: Partial<LessonData>) => {
    setModules((prev) =>
      prev.map((m, mi) =>
        mi === moduleIndex
          ? {
              ...m,
              lessons: m.lessons.map((l, li) =>
                li === lessonIndex ? { ...l, ...updates } : l
              ),
            }
          : m
      )
    );
  };

  const addModule = () => {
    setModules((prev) => [...prev, createEmptyModule()]);
  };

  const removeModule = (index: number) => {
    if (modules.length <= 1) return;
    setModules((prev) => prev.filter((_, i) => i !== index));
  };

  const addLesson = (moduleIndex: number) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIndex ? { ...m, lessons: [...m.lessons, createEmptyLesson()] } : m
      )
    );
  };

  const removeLesson = (moduleIndex: number, lessonIndex: number) => {
    setModules((prev) =>
      prev.map((m, mi) =>
        mi === moduleIndex && m.lessons.length > 1
          ? { ...m, lessons: m.lessons.filter((_, li) => li !== lessonIndex) }
          : m
      )
    );
  };

  const addQuiz = (moduleIndex: number, type: "revision" | "progress_test") => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIndex ? { ...m, quizzes: [...m.quizzes, createEmptyQuiz(type)] } : m
      )
    );
  };

  const removeQuiz = (moduleIndex: number, quizIndex: number) => {
    setModules((prev) =>
      prev.map((m, mi) =>
        mi === moduleIndex
          ? { ...m, quizzes: m.quizzes.filter((_, qi) => qi !== quizIndex) }
          : m
      )
    );
  };

  const updateQuiz = (moduleIndex: number, quizIndex: number, updates: Partial<QuizData>) => {
    setModules((prev) =>
      prev.map((m, mi) =>
        mi === moduleIndex
          ? { ...m, quizzes: m.quizzes.map((q, qi) => qi === quizIndex ? { ...q, ...updates } : q) }
          : m
      )
    );
  };

  const addQuestion = (moduleIndex: number, quizIndex: number) => {
    const quiz = modules[moduleIndex].quizzes[quizIndex];
    updateQuiz(moduleIndex, quizIndex, { questions: [...quiz.questions, createEmptyQuestion()] });
  };

  const removeQuestion = (moduleIndex: number, quizIndex: number, questionIndex: number) => {
    const quiz = modules[moduleIndex].quizzes[quizIndex];
    if (quiz.questions.length <= 1) return;
    updateQuiz(moduleIndex, quizIndex, { questions: quiz.questions.filter((_, i) => i !== questionIndex) });
  };

  const updateQuestion = (moduleIndex: number, quizIndex: number, questionIndex: number, updates: Partial<QuestionData>) => {
    const quiz = modules[moduleIndex].quizzes[quizIndex];
    updateQuiz(moduleIndex, quizIndex, {
      questions: quiz.questions.map((q, i) => i === questionIndex ? { ...q, ...updates } : q),
    });
  };

  const updateOption = (moduleIndex: number, quizIndex: number, questionIndex: number, optionIndex: number, value: string) => {
    const question = modules[moduleIndex].quizzes[quizIndex].questions[questionIndex];
    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    updateQuestion(moduleIndex, quizIndex, questionIndex, { options: newOptions });
  };

  const addOption = (moduleIndex: number, quizIndex: number, questionIndex: number) => {
    const question = modules[moduleIndex].quizzes[quizIndex].questions[questionIndex];
    updateQuestion(moduleIndex, quizIndex, questionIndex, { options: [...question.options, ""] });
  };

  const removeOption = (moduleIndex: number, quizIndex: number, questionIndex: number, optionIndex: number) => {
    const question = modules[moduleIndex].quizzes[quizIndex].questions[questionIndex];
    if (question.options.length <= 2) return;
    const newOptions = question.options.filter((_, i) => i !== optionIndex);
    const newCorrectIndex = question.correctIndex >= newOptions.length ? 0 : question.correctIndex;
    updateQuestion(moduleIndex, quizIndex, questionIndex, { options: newOptions, correctIndex: newCorrectIndex });
  };

  const canProceedStep0 = title.trim() && description.trim() && category && parseFloat(price) >= 0;
  const canProceedStep1 = modules.every(
    (m) => m.title.trim() && m.lessons.every((l) => l.title.trim())
  );

  const quizValidationErrors: string[] = [];
  modules.forEach((mod, mi) => {
    mod.quizzes.forEach((quiz, qi) => {
      if (!quiz.title.trim()) {
        quizValidationErrors.push(`Module ${mi + 1}, Quiz ${qi + 1}: Missing quiz title`);
      }
      if (quiz.questions.length === 0) {
        quizValidationErrors.push(`Module ${mi + 1}, Quiz ${qi + 1}: Must have at least 1 question`);
      }
      quiz.questions.forEach((q, qii) => {
        if (!q.prompt.trim()) {
          quizValidationErrors.push(`Module ${mi + 1}, Quiz ${qi + 1}, Q${qii + 1}: Missing question text`);
        }
        const filledOptions = q.options.filter(o => o.trim());
        if (filledOptions.length < 2) {
          quizValidationErrors.push(`Module ${mi + 1}, Quiz ${qi + 1}, Q${qii + 1}: Need at least 2 filled options`);
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length || !q.options[q.correctIndex]?.trim()) {
          quizValidationErrors.push(`Module ${mi + 1}, Quiz ${qi + 1}, Q${qii + 1}: Must select a valid correct answer`);
        }
      });
    });
  });
  const canProceedStep2 = quizValidationErrors.length === 0;

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalQuizzes = modules.reduce((sum, m) => sum + m.quizzes.length, 0);

  const handlePublish = async () => {
    if (!canProceedStep2) {
      toast({ title: "Quiz errors", description: "Please fix all quiz validation errors before publishing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const courseData = {
        title,
        description,
        category,
        level,
        price: parseFloat(price),
        certificateFee: parseFloat(certificateFee) || 100,
        cover: coverUrl || null,
        instructorId: user!.id,
        instructorName: `${user!.firstName || ""} ${user!.lastName || ""}`.trim() || user!.email || "Instructor",
        isActive: true,
        subscriptionActive: true,
        uploadFeePaid: false,
        totalLessons,
        totalDuration: null,
        modules: modules.map((m, mi) => ({
          title: m.title,
          position: mi,
          lessons: m.lessons.map((l, li) => ({
            title: l.title,
            contentType: l.contentType,
            videoUrl: l.videoUrl || null,
            textContent: l.textContent || null,
            imageUrl: l.imageUrl || null,
            voiceoverUrl: l.voiceoverUrl || null,
            duration: l.duration || null,
            position: li,
            isFreePreview: l.isFreePreview,
          })),
          quizzes: m.quizzes.map((q, qi) => ({
            title: q.title,
            quizType: q.quizType,
            passingScore: q.passingScore,
            position: qi,
            questions: q.questions.map((qu, qui) => {
              const originalCorrectOption = qu.options[qu.correctIndex];
              const filteredOptions = qu.options.filter(o => o.trim());
              const newCorrectIndex = filteredOptions.indexOf(originalCorrectOption);
              return {
                prompt: qu.prompt,
                options: filteredOptions,
                correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
                explanation: qu.explanation || null,
                position: qui,
              };
            }),
          })),
        })),
        labs: labs.filter(l => l.title.trim() && l.instructions.trim()).map((l, i) => ({
          title: l.title,
          instructions: l.instructions,
          resources: l.resources || null,
          position: i,
        })),
      };

      if (isEditMode && editCourseId) {
        const res = await fetch(`/api/admin/courses/${editCourseId}/full`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(courseData),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to update course" }));
          throw new Error(err.error || "Failed to update course");
        }
        toast({
          title: "Course Updated!",
          description: "Your course changes have been saved.",
        });
        setLocation(`/course/${editCourseId}`);
      } else {
        const result = await createCourse(courseData);
        clearDraft();
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        const isApproved = result?.isApproved === true;
        toast({
          title: isApproved ? "Course Published!" : "Course Submitted!",
          description: isApproved
            ? "Your course is now live in the marketplace."
            : "Your course has been submitted for admin approval.",
        });
        setLocation(isApproved ? "/courses" : "/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save course",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-64px)] flex gap-8">
        <aside className="w-64 hidden md:flex flex-col gap-2 pt-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={step.id}
                onClick={() => (isEditMode || index <= currentStep) && setCurrentStep(index)}
                disabled={!isEditMode && index > currentStep}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-accent text-muted-foreground",
                  isCompleted && "text-primary font-semibold",
                  !isEditMode && index > currentStep && "opacity-50 cursor-not-allowed"
                )}
                data-testid={`step-${step.id}`}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors",
                    isActive ? "border-white bg-white/20" : "border-current"
                  )}
                >
                  {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                </div>
                {step.title}
              </button>
            );
          })}
          <div className="mt-auto pt-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleSaveDraft}
              data-testid="button-save-course-draft"
            >
              <Save className="w-4 h-4" />
              {saveIndicator ? "Saved!" : "Save Progress"}
            </Button>
          </div>
        </aside>

        <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="p-8"
              >
                {/* Step 0: Course Info */}
                {currentStep === 0 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        Course Information
                      </h2>
                      <p className="text-muted-foreground">
                        Provide the basic details about your course.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="course-title">Course Title</Label>
                        <Input
                          id="course-title"
                          placeholder="e.g. Mastering Personal Finance"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          data-testid="input-course-title"
                        />
                      </div>

                      <div>
                        <Label htmlFor="course-description">Description</Label>
                        <Textarea
                          id="course-description"
                          placeholder="Describe what students will learn..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="min-h-[120px]"
                          data-testid="input-course-description"
                        />
                      </div>

                      <div>
                        <Label htmlFor="course-category">Category</Label>
                        <select
                          id="course-category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          data-testid="select-course-category"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="course-level">Qualification Level</Label>
                        <select
                          id="course-level"
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          data-testid="select-course-level"
                        >
                          {COURSE_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="course-price">Price ($)</Label>
                        <Input
                          id="course-price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          data-testid="input-course-price"
                        />
                      </div>

                      <div>
                        <Label htmlFor="certificate-fee">Certificate Fee ($)</Label>
                        <Input
                          id="certificate-fee"
                          type="number"
                          min="0"
                          step="0.01"
                          value={certificateFee}
                          onChange={(e) => setCertificateFee(e.target.value)}
                          data-testid="input-certificate-fee"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Fee learners pay to download their completion certificate
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        size="lg"
                        onClick={() => setCurrentStep(1)}
                        disabled={!canProceedStep0}
                        data-testid="button-next-step"
                      >
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 1: Modules & Lessons */}
                {currentStep === 1 && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        Modules & Lessons
                      </h2>
                      <p className="text-muted-foreground">
                        Organize your course into modules. Each module contains lessons (video, text, or image content).
                      </p>
                    </div>

                    <div className="space-y-6">
                      {modules.map((mod, mi) => (
                        <Card key={mi} data-testid={`card-module-${mi}`}>
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">Module {mi + 1}</CardTitle>
                              {modules.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeModule(mi)}
                                  data-testid={`button-remove-module-${mi}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                            <Input
                              placeholder="Module title"
                              value={mod.title}
                              onChange={(e) => updateModule(mi, { title: e.target.value })}
                              data-testid={`input-module-title-${mi}`}
                            />
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {mod.lessons.map((lesson, li) => (
                              <div
                                key={li}
                                className="border rounded-lg p-4 space-y-3 bg-muted/30"
                                data-testid={`card-lesson-${mi}-${li}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    Lesson {li + 1}
                                  </span>
                                  {mod.lessons.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeLesson(mi, li)}
                                      data-testid={`button-remove-lesson-${mi}-${li}`}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>

                                <div>
                                  <Label>Lesson Title</Label>
                                  <Input
                                    placeholder="Lesson title"
                                    value={lesson.title}
                                    onChange={(e) =>
                                      updateLesson(mi, li, { title: e.target.value })
                                    }
                                    data-testid={`input-lesson-title-${mi}-${li}`}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Content Type</Label>
                                    <select
                                      value={lesson.contentType}
                                      onChange={(e) =>
                                        updateLesson(mi, li, {
                                          contentType: e.target.value as LessonData["contentType"],
                                        })
                                      }
                                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                      data-testid={`select-content-type-${mi}-${li}`}
                                    >
                                      <option value="video">Video</option>
                                      <option value="text">Text / Article</option>
                                      <option value="image">Image</option>
                                      <option value="presentation">Presentation</option>
                                      <option value="infographic">Infographic</option>
                                    </select>
                                  </div>
                                  <div>
                                    <Label>Duration</Label>
                                    <Input
                                      placeholder="e.g. 15 min"
                                      value={lesson.duration}
                                      onChange={(e) =>
                                        updateLesson(mi, li, { duration: e.target.value })
                                      }
                                      data-testid={`input-lesson-duration-${mi}-${li}`}
                                    />
                                  </div>
                                </div>

                                {lesson.contentType === "video" && (
                                  <div className="space-y-3">
                                    {showRecorder === `${mi}-${li}` ? (
                                      <VideoRecorder
                                        onVideoUploaded={(url) => {
                                          updateLesson(mi, li, { videoUrl: url });
                                          setShowRecorder(null);
                                          toast({ title: "Video recorded & uploaded", description: "Your recording has been saved." });
                                        }}
                                        onClose={() => setShowRecorder(null)}
                                      />
                                    ) : (
                                      <>
                                        <div>
                                          <Label className="text-sm font-medium">Upload Video</Label>
                                          <div className="mt-1">
                                            {(() => {
                                              const lessonKey = `${mi}-${li}`;
                                              const isUploading = lessonKey in uploadingLessons;
                                              const progress = uploadingLessons[lessonKey] ?? 0;
                                              return (
                                                <>
                                                  <label className={cn(
                                                    "flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors",
                                                    isUploading ? "border-primary bg-primary/5 cursor-wait" : "cursor-pointer hover:border-primary hover:bg-primary/5"
                                                  )}>
                                                    {isUploading ? (
                                                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                                    ) : (
                                                      <Upload className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                    <span className="text-sm text-muted-foreground flex-1">
                                                      {isUploading
                                                        ? `Uploading... ${progress}%`
                                                        : lesson.videoUrl && !lesson.videoUrl.startsWith("http")
                                                          ? "Video uploaded (click to replace)"
                                                          : "Choose video file (MP4, WebM, MOV)"}
                                                    </span>
                                                    <input
                                                      type="file"
                                                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                                                      className="hidden"
                                                      disabled={isUploading}
                                                      onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        e.target.value = "";
                                                        setUploadingLessons(prev => ({ ...prev, [lessonKey]: 0 }));

                                                        try {
                                                          const signedRes = await fetch("/api/upload/request-signed-url", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            credentials: "include",
                                                          });
                                                          if (!signedRes.ok) throw new Error("Failed to get upload URL");
                                                          const { uploadURL, objectPath } = await signedRes.json();

                                                          await new Promise<void>((resolve, reject) => {
                                                            const xhr = new XMLHttpRequest();
                                                            xhr.upload.addEventListener("progress", (ev) => {
                                                              if (ev.lengthComputable) {
                                                                setUploadingLessons(prev => ({ ...prev, [lessonKey]: Math.round((ev.loaded / ev.total) * 100) }));
                                                              }
                                                            });
                                                            xhr.onload = () => {
                                                              if (xhr.status >= 200 && xhr.status < 300) resolve();
                                                              else reject(new Error(`Upload failed (${xhr.status})`));
                                                            };
                                                            xhr.onerror = () => reject(new Error("Network error"));
                                                            xhr.open("PUT", uploadURL);
                                                            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                                                            xhr.send(file);
                                                          });

                                                          updateLesson(mi, li, { videoUrl: objectPath });
                                                          toast({ title: "Video uploaded", description: `${file.name} uploaded successfully.` });
                                                        } catch (err: any) {
                                                          toast({ title: "Upload failed", description: err.message || "Please try again.", variant: "destructive" });
                                                        } finally {
                                                          setUploadingLessons(prev => { const n = { ...prev }; delete n[lessonKey]; return n; });
                                                        }
                                                      }}
                                                      data-testid={`input-video-upload-${mi}-${li}`}
                                                    />
                                                  </label>
                                                  {isUploading && (
                                                    <div className="mt-2">
                                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                                      </div>
                                                    </div>
                                                  )}
                                                  {lesson.videoUrl && !lesson.videoUrl.startsWith("http") && !isUploading && (
                                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                      <Check className="w-3 h-3" /> Video uploaded successfully
                                                    </p>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>

                                        <div className="relative">
                                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/30 px-2 text-muted-foreground">or record video</span></div>
                                        </div>

                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="w-full gap-2"
                                          onClick={() => setShowRecorder(`${mi}-${li}`)}
                                          data-testid={`button-record-video-${mi}-${li}`}
                                        >
                                          <Video className="w-4 h-4" /> Record from Camera / Screen / OBS
                                        </Button>

                                        <div className="relative">
                                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/30 px-2 text-muted-foreground">or paste URL</span></div>
                                        </div>

                                        <div>
                                          <Input
                                            placeholder="https://youtube.com/... or https://vimeo.com/..."
                                            value={lesson.videoUrl?.startsWith("http") ? lesson.videoUrl : ""}
                                            onChange={(e) => updateLesson(mi, li, { videoUrl: e.target.value })}
                                            data-testid={`input-video-url-${mi}-${li}`}
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                {lesson.contentType === "text" && (
                                  <div className="space-y-3">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <Label>Text Content</Label>
                                        <span className="text-[10px] text-muted-foreground">
                                          Supports: # Heading, ## Subheading, - bullets, 1. numbered, **bold**, *italic*, &gt; quotes
                                        </span>
                                      </div>
                                      <Textarea
                                        placeholder={"Paste or type your lesson content here...\n\nFormatting tips:\n# Main Heading\n## Sub Heading\n- Bullet point\n1. Numbered item\n**bold text**\n*italic text*\n> Blockquote"}
                                        value={lesson.textContent}
                                        onChange={(e) =>
                                          updateLesson(mi, li, { textContent: e.target.value })
                                        }
                                        className="min-h-[180px] font-mono text-sm"
                                        data-testid={`input-text-content-${mi}-${li}`}
                                      />
                                    </div>
                                    {lesson.textContent && (
                                      <div>
                                        <Label className="text-xs text-muted-foreground mb-1 block">Preview</Label>
                                        <div className="border rounded-lg p-4 bg-card max-h-[300px] overflow-y-auto text-sm" data-testid={`preview-text-content-${mi}-${li}`}>
                                          {formatRichText(lesson.textContent)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(lesson.contentType === "presentation" || lesson.contentType === "infographic") && (
                                  <div className="space-y-3">
                                    <div>
                                      <Label className="text-sm font-medium">
                                        Upload {lesson.contentType === "presentation" ? "Presentation Slides" : "Infographic"}
                                      </Label>
                                      <div className="mt-1">
                                        {(() => {
                                          const lessonKey = `img-${mi}-${li}`;
                                          const isUploading = lessonKey in uploadingLessons;
                                          const progress = uploadingLessons[lessonKey] ?? 0;
                                          return (
                                            <>
                                              <label className={cn(
                                                "flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors",
                                                isUploading ? "border-primary bg-primary/5 cursor-wait" : "cursor-pointer hover:border-primary hover:bg-primary/5"
                                              )}>
                                                {isUploading ? (
                                                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                                ) : (
                                                  <Upload className="w-5 h-5 text-muted-foreground" />
                                                )}
                                                <span className="text-sm text-muted-foreground flex-1">
                                                  {isUploading
                                                    ? `Uploading... ${progress}%`
                                                    : lesson.imageUrl && !lesson.imageUrl.startsWith("http")
                                                      ? "File uploaded (click to replace)"
                                                      : `Choose ${lesson.contentType === "presentation" ? "slide image (JPG, PNG, PDF)" : "infographic image (JPG, PNG, WebP)"}`}
                                                </span>
                                                <input
                                                  type="file"
                                                  accept="image/*,.pdf"
                                                  className="hidden"
                                                  disabled={isUploading}
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    e.target.value = "";
                                                    setUploadingLessons(prev => ({ ...prev, [lessonKey]: 0 }));
                                                    const formData = new FormData();
                                                    formData.append("file", file);
                                                    try {
                                                      await new Promise<void>((resolve, reject) => {
                                                        const xhr = new XMLHttpRequest();
                                                        xhr.upload.addEventListener("progress", (ev) => {
                                                          if (ev.lengthComputable) {
                                                            setUploadingLessons(prev => ({ ...prev, [lessonKey]: Math.round((ev.loaded / ev.total) * 100) }));
                                                          }
                                                        });
                                                        xhr.onload = () => {
                                                          if (xhr.status >= 200 && xhr.status < 300) {
                                                            try {
                                                              const data = JSON.parse(xhr.responseText);
                                                              if (data.url) updateLesson(mi, li, { imageUrl: data.url });
                                                              resolve();
                                                            } catch { reject(new Error("Invalid response")); }
                                                          } else { reject(new Error(`Upload failed (${xhr.status})`)); }
                                                        };
                                                        xhr.onerror = () => reject(new Error("Network error"));
                                                        xhr.open("POST", "/api/upload");
                                                        xhr.withCredentials = true;
                                                        xhr.send(formData);
                                                      });
                                                    } catch {
                                                      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
                                                    } finally {
                                                      setUploadingLessons(prev => { const n = { ...prev }; delete n[lessonKey]; return n; });
                                                    }
                                                  }}
                                                  data-testid={`input-${lesson.contentType}-upload-${mi}-${li}`}
                                                />
                                              </label>
                                              {isUploading && (
                                                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                        {lesson.imageUrl && (
                                          <div className="mt-2">
                                            <img src={lesson.imageUrl} alt="Preview" className="max-h-32 rounded border" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/30 px-2 text-muted-foreground">or paste URL</span></div>
                                    </div>
                                    <div>
                                      <Input
                                        placeholder="https://example.com/file.png"
                                        value={lesson.imageUrl?.startsWith("http") ? lesson.imageUrl : ""}
                                        onChange={(e) => updateLesson(mi, li, { imageUrl: e.target.value })}
                                        data-testid={`input-${lesson.contentType}-url-${mi}-${li}`}
                                      />
                                    </div>
                                    <div>
                                      <Label>Description / Notes</Label>
                                      <Textarea
                                        placeholder={lesson.contentType === "presentation" ? "Describe what this slide covers..." : "Describe this infographic..."}
                                        value={lesson.textContent}
                                        onChange={(e) => updateLesson(mi, li, { textContent: e.target.value })}
                                        className="min-h-[60px]"
                                        data-testid={`input-${lesson.contentType}-description-${mi}-${li}`}
                                      />
                                    </div>
                                  </div>
                                )}

                                {lesson.contentType === "image" && (
                                  <div className="space-y-3">
                                    <div>
                                      <Label className="text-sm font-medium">Upload Image</Label>
                                      <div className="mt-1">
                                        {(() => {
                                          const lessonKey = `img-${mi}-${li}`;
                                          const isUploading = lessonKey in uploadingLessons;
                                          const progress = uploadingLessons[lessonKey] ?? 0;
                                          return (
                                            <>
                                              <label className={cn(
                                                "flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors",
                                                isUploading ? "border-primary bg-primary/5 cursor-wait" : "cursor-pointer hover:border-primary hover:bg-primary/5"
                                              )}>
                                                {isUploading ? (
                                                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                                ) : (
                                                  <Upload className="w-5 h-5 text-muted-foreground" />
                                                )}
                                                <span className="text-sm text-muted-foreground flex-1">
                                                  {isUploading
                                                    ? `Uploading... ${progress}%`
                                                    : lesson.imageUrl && !lesson.imageUrl.startsWith("http")
                                                      ? "Image uploaded (click to replace)"
                                                      : "Choose image (JPG, PNG, WebP)"}
                                                </span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  disabled={isUploading}
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    e.target.value = "";
                                                    setUploadingLessons(prev => ({ ...prev, [lessonKey]: 0 }));
                                                    const formData = new FormData();
                                                    formData.append("file", file);
                                                    try {
                                                      await new Promise<void>((resolve, reject) => {
                                                        const xhr = new XMLHttpRequest();
                                                        xhr.upload.addEventListener("progress", (ev) => {
                                                          if (ev.lengthComputable) {
                                                            setUploadingLessons(prev => ({ ...prev, [lessonKey]: Math.round((ev.loaded / ev.total) * 100) }));
                                                          }
                                                        });
                                                        xhr.onload = () => {
                                                          if (xhr.status >= 200 && xhr.status < 300) {
                                                            try {
                                                              const data = JSON.parse(xhr.responseText);
                                                              if (data.url) updateLesson(mi, li, { imageUrl: data.url });
                                                              resolve();
                                                            } catch { reject(new Error("Invalid response")); }
                                                          } else { reject(new Error(`Upload failed (${xhr.status})`)); }
                                                        };
                                                        xhr.onerror = () => reject(new Error("Network error"));
                                                        xhr.open("POST", "/api/upload");
                                                        xhr.withCredentials = true;
                                                        xhr.send(formData);
                                                      });
                                                    } catch {
                                                      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
                                                    } finally {
                                                      setUploadingLessons(prev => { const n = { ...prev }; delete n[lessonKey]; return n; });
                                                    }
                                                  }}
                                                  data-testid={`input-image-upload-${mi}-${li}`}
                                                />
                                              </label>
                                              {isUploading && (
                                                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                        {lesson.imageUrl && (
                                          <div className="mt-2">
                                            <img src={lesson.imageUrl} alt="Preview" className="max-h-32 rounded border" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-muted/30 px-2 text-muted-foreground">or paste URL</span></div>
                                    </div>
                                    <div>
                                      <Input
                                        placeholder="https://example.com/image.png"
                                        value={lesson.imageUrl?.startsWith("http") ? lesson.imageUrl : ""}
                                        onChange={(e) => updateLesson(mi, li, { imageUrl: e.target.value })}
                                        data-testid={`input-image-url-${mi}-${li}`}
                                      />
                                    </div>
                                    <div>
                                      <Label>Description (optional)</Label>
                                      <Textarea
                                        placeholder="Describe the image content..."
                                        value={lesson.textContent}
                                        onChange={(e) => updateLesson(mi, li, { textContent: e.target.value })}
                                        className="min-h-[60px]"
                                        data-testid={`input-image-description-${mi}-${li}`}
                                      />
                                    </div>
                                  </div>
                                )}

                                {(lesson.contentType === "video" || lesson.contentType === "image" || lesson.contentType === "presentation" || lesson.contentType === "infographic") && (
                                  <VoiceoverRecorder
                                    voiceoverUrl={lesson.voiceoverUrl}
                                    onRecorded={(url) => updateLesson(mi, li, { voiceoverUrl: url })}
                                    onRemove={() => updateLesson(mi, li, { voiceoverUrl: "" })}
                                    testIdPrefix={`voiceover-${mi}-${li}`}
                                  />
                                )}

                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`free-preview-${mi}-${li}`}
                                    checked={lesson.isFreePreview}
                                    onCheckedChange={(checked) =>
                                      updateLesson(mi, li, {
                                        isFreePreview: checked === true,
                                      })
                                    }
                                    data-testid={`checkbox-free-preview-${mi}-${li}`}
                                  />
                                  <Label
                                    htmlFor={`free-preview-${mi}-${li}`}
                                    className="text-sm cursor-pointer"
                                  >
                                    Free Preview
                                  </Label>
                                </div>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addLesson(mi)}
                              data-testid={`button-add-lesson-${mi}`}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Lesson
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      onClick={addModule}
                      data-testid="button-add-module"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Module
                    </Button>

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(0)}
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => setCurrentStep(2)}
                        disabled={!canProceedStep1}
                        data-testid="button-next-step"
                      >
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Quizzes & Tests */}
                {currentStep === 2 && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        Quizzes & Tests
                      </h2>
                      <p className="text-muted-foreground">
                        Add revision exercises and progress tests to each module. Students must pass progress tests (70%+) to earn a certificate.
                      </p>
                    </div>

                    {modules.map((mod, mi) => (
                      <Card key={mi} data-testid={`card-quiz-module-${mi}`}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen size={18} />
                            {mod.title || `Module ${mi + 1}`}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {mod.quizzes.map((quiz, qi) => (
                            <div key={qi} className="border rounded-lg p-4 space-y-4 bg-muted/20" data-testid={`card-quiz-${mi}-${qi}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {quiz.quizType === "progress_test" ? (
                                    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
                                      Progress Test
                                    </span>
                                  ) : (
                                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                                      Revision
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuiz(mi, qi)}
                                  data-testid={`button-remove-quiz-${mi}-${qi}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Quiz Title</Label>
                                  <Input
                                    value={quiz.title}
                                    onChange={(e) => updateQuiz(mi, qi, { title: e.target.value })}
                                    data-testid={`input-quiz-title-${mi}-${qi}`}
                                  />
                                </div>
                                <div>
                                  <Label>Passing Score (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={quiz.passingScore}
                                    onChange={(e) => updateQuiz(mi, qi, { passingScore: parseInt(e.target.value) || 70 })}
                                    data-testid={`input-quiz-passing-${mi}-${qi}`}
                                  />
                                </div>
                              </div>

                              <div className="space-y-4">
                                {quiz.questions.map((question, qii) => (
                                  <div key={qii} className="border rounded-md p-3 bg-background space-y-3" data-testid={`card-question-${mi}-${qi}-${qii}`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Question {qii + 1}</span>
                                      {quiz.questions.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeQuestion(mi, qi, qii)}
                                          data-testid={`button-remove-question-${mi}-${qi}-${qii}`}
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      )}
                                    </div>

                                    <div>
                                      <Label>Question</Label>
                                      <Input
                                        placeholder="What is...?"
                                        value={question.prompt}
                                        onChange={(e) => updateQuestion(mi, qi, qii, { prompt: e.target.value })}
                                        data-testid={`input-question-prompt-${mi}-${qi}-${qii}`}
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="flex items-center gap-2">Options <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Select the correct answer below</span></Label>
                                      {question.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                          <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${question.correctIndex === oi ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                                            <input
                                              type="radio"
                                              name={`correct-${mi}-${qi}-${qii}`}
                                              checked={question.correctIndex === oi}
                                              onChange={() => updateQuestion(mi, qi, qii, { correctIndex: oi })}
                                              className="sr-only"
                                              data-testid={`radio-correct-${mi}-${qi}-${qii}-${oi}`}
                                            />
                                            {question.correctIndex === oi && <Check className="w-3 h-3 text-white" />}
                                          </div>
                                          <Input
                                            placeholder={`Option ${oi + 1}`}
                                            value={opt}
                                            onChange={(e) => updateOption(mi, qi, qii, oi, e.target.value)}
                                            className="flex-1"
                                            data-testid={`input-option-${mi}-${qi}-${qii}-${oi}`}
                                          />
                                          {question.options.length > 2 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeOption(mi, qi, qii, oi)}
                                              data-testid={`button-remove-option-${mi}-${qi}-${qii}-${oi}`}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => addOption(mi, qi, qii)}
                                        data-testid={`button-add-option-${mi}-${qi}-${qii}`}
                                      >
                                        <Plus className="h-3 w-3 mr-1" /> Add Option
                                      </Button>
                                    </div>

                                    <div>
                                      <Label>Explanation (shown after answering)</Label>
                                      <Input
                                        placeholder="Optional explanation..."
                                        value={question.explanation}
                                        onChange={(e) => updateQuestion(mi, qi, qii, { explanation: e.target.value })}
                                        data-testid={`input-explanation-${mi}-${qi}-${qii}`}
                                      />
                                    </div>
                                  </div>
                                ))}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addQuestion(mi, qi)}
                                  data-testid={`button-add-question-${mi}-${qi}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add Question
                                </Button>
                              </div>
                            </div>
                          ))}

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addQuiz(mi, "revision")}
                              data-testid={`button-add-revision-${mi}`}
                            >
                              <HelpCircle className="h-4 w-4 mr-1" /> Add Revision Exercise
                            </Button>
                            {!mod.quizzes.some(q => q.quizType === "progress_test") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addQuiz(mi, "progress_test")}
                                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                                data-testid={`button-add-test-${mi}`}
                              >
                                <Award className="h-4 w-4 mr-1" /> Add Progress Test
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => setCurrentStep(3)}
                        disabled={!canProceedStep2}
                        data-testid="button-next-step"
                      >
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    {quizValidationErrors.length > 0 && (
                      <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50" data-testid="quiz-validation-errors">
                        <p className="text-sm font-medium text-red-800 mb-2">Please fix the following before continuing:</p>
                        <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                          {quizValidationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Labs */}
                {currentStep === 3 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        Labs (Optional)
                      </h2>
                      <p className="text-muted-foreground">
                        Add optional hands-on lab exercises. Students complete these as a final practical exercise after finishing all modules.
                      </p>
                    </div>

                    {labs.map((lab, li) => (
                      <Card key={li} data-testid={`card-lab-${li}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FlaskConical size={18} /> Lab {li + 1}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLabs(prev => prev.filter((_, i) => i !== li))}
                              data-testid={`button-remove-lab-${li}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label>Lab Title</Label>
                            <Input
                              placeholder="e.g. Build a Personal Budget Spreadsheet"
                              value={lab.title}
                              onChange={(e) => setLabs(prev => prev.map((l, i) => i === li ? { ...l, title: e.target.value } : l))}
                              data-testid={`input-lab-title-${li}`}
                            />
                          </div>
                          <div>
                            <Label>Instructions</Label>
                            <Textarea
                              placeholder="Detailed instructions for students to follow..."
                              value={lab.instructions}
                              onChange={(e) => setLabs(prev => prev.map((l, i) => i === li ? { ...l, instructions: e.target.value } : l))}
                              className="min-h-[120px]"
                              data-testid={`input-lab-instructions-${li}`}
                            />
                          </div>
                          <div>
                            <Label>Resources (optional)</Label>
                            <Textarea
                              placeholder="Links or resources students might need..."
                              value={lab.resources}
                              onChange={(e) => setLabs(prev => prev.map((l, i) => i === li ? { ...l, resources: e.target.value } : l))}
                              className="min-h-[60px]"
                              data-testid={`input-lab-resources-${li}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <Button
                      variant="outline"
                      onClick={() => setLabs(prev => [...prev, createEmptyLab()])}
                      data-testid="button-add-lab"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Lab Exercise
                    </Button>

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(2)}
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => setCurrentStep(4)}
                        data-testid="button-next-step"
                      >
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Cover Image */}
                {currentStep === 4 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        Cover Image
                      </h2>
                      <p className="text-muted-foreground">
                        Upload a cover image for your course.
                      </p>
                    </div>

                    <div>
                      <Label>Upload Cover Image</Label>
                      <label className="mt-2 flex flex-col items-center gap-3 px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" data-testid="label-cover-upload">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground text-center">
                          {coverUrl && !coverUrl.startsWith("http")
                            ? "Cover image uploaded - click to change"
                            : "Click to choose an image (JPG, PNG, WebP)"}
                        </span>
                        <span className="text-xs text-muted-foreground">Recommended: 1280 x 720 pixels</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            try {
                              const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                              const data = await res.json();
                              if (data.url) setCoverUrl(data.url);
                            } catch {
                              toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
                            }
                          }}
                          data-testid="input-cover-upload"
                        />
                      </label>
                    </div>

                    {coverUrl && (
                      <div className="border rounded-lg overflow-hidden relative group">
                        <img
                          src={coverUrl}
                          alt="Course cover preview"
                          className="w-full max-h-64 object-cover"
                          data-testid="img-cover-preview"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setCoverUrl("")}
                          data-testid="button-remove-cover"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    )}

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(3)}
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => setCurrentStep(5)}
                        data-testid="button-next-step"
                      >
                        Next <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 5: Review & Publish */}
                {currentStep === 5 && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-step-title">
                        {isEditMode ? "Review & Update" : "Review & Publish"}
                      </h2>
                      <p className="text-muted-foreground">
                        {isEditMode ? "Review your changes before updating the course." : "Review your course details before submitting for approval."}
                      </p>
                    </div>

                    <Card>
                      <CardContent className="p-6 space-y-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Title</span>
                          <p className="font-semibold text-lg" data-testid="text-review-title">{title}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Description</span>
                          <p className="text-sm" data-testid="text-review-description">{description}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Category</span>
                            <p className="font-medium" data-testid="text-review-category">{category}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Level</span>
                            <p className="font-medium" data-testid="text-review-level">{level}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Price</span>
                            <p className="font-medium" data-testid="text-review-price">${parseFloat(price).toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Certificate Fee</span>
                            <p className="font-medium" data-testid="text-review-cert-fee">${parseFloat(certificateFee).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Modules</span>
                            <p className="font-medium">{modules.length}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Lessons</span>
                            <p className="font-medium">{totalLessons}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Quizzes</span>
                            <p className="font-medium">{totalQuizzes}</p>
                          </div>
                        </div>
                        {labs.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">Labs</span>
                            <p className="font-medium">{labs.length} lab exercise{labs.length !== 1 ? "s" : ""}</p>
                          </div>
                        )}
                        {coverUrl && (
                          <div>
                            <span className="text-sm text-muted-foreground">Cover</span>
                            <img
                              src={coverUrl}
                              alt="Cover"
                              className="mt-1 w-32 h-20 object-cover rounded-md border"
                              data-testid="img-review-cover"
                            />
                          </div>
                        )}

                        <div className="pt-2">
                          <span className="text-sm text-muted-foreground">Content Structure</span>
                          <div className="space-y-2 mt-1">
                            {modules.map((mod, mi) => (
                              <div key={mi} className="text-sm" data-testid={`text-review-module-${mi}`}>
                                <p className="font-medium">{mod.title}</p>
                                <ul className="ml-4 text-muted-foreground list-disc">
                                  {mod.lessons.map((l, li) => (
                                    <li key={li} data-testid={`text-review-lesson-${mi}-${li}`}>
                                      {l.title}
                                      {" ("}
                                      {l.contentType === "video" ? "Video" : l.contentType === "image" ? "Image" : l.contentType === "presentation" ? "Presentation" : l.contentType === "infographic" ? "Infographic" : "Text"}
                                      {")"}
                                      {l.isFreePreview && " · Free Preview"}
                                      {l.duration && ` · ${l.duration}`}
                                    </li>
                                  ))}
                                  {mod.quizzes.map((q, qi) => (
                                    <li key={`q-${qi}`} className="text-blue-600">
                                      {q.title} ({q.questions.length} questions, {q.passingScore}% to pass)
                                      {q.quizType === "progress_test" && " - Required"}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            {labs.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium text-sm">Labs</p>
                                <ul className="ml-4 text-muted-foreground text-sm list-disc">
                                  {labs.map((l, li) => (
                                    <li key={li}>{l.title}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {!isReadyToPublish && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-amber-800 font-medium mb-2">Complete the following before publishing:</p>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {!title.trim() && <li>- Add a course title</li>}
                          {!description.trim() && <li>- Add a course description</li>}
                          {modules.some(m => !m.title.trim()) && <li>- Name all modules</li>}
                          {modules.some(m => m.lessons.length === 0) && <li>- Add at least one lesson to each module</li>}
                          {modules.some(m => m.lessons.some(l => !l.title.trim())) && <li>- Name all lessons</li>}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(4)}
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={handlePublish}
                        disabled={isSubmitting || !isReadyToPublish}
                        data-testid="button-publish-course"
                      >
                        {isSubmitting ? "Submitting..." : !isReadyToPublish ? "Complete all steps first" : isEditMode ? "Update Course" : "Submit for Approval"}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}
