import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchBook } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Home, Settings,
  Type, Download, Lock, Maximize2, Minimize2,
  Clock, BookOpen, List, X, ChevronDown, ChevronUp,
  ZoomIn, ZoomOut, Search, RefreshCw, Loader2
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { EpubReader } from "@/components/epub-reader";

const STORAGE_KEY = "lumina_library";
const POSITION_KEY = "lumina_reading_positions";

function getBuyerToken(): string | null {
  return localStorage.getItem("lumina_buyer_token");
}

async function checkPurchaseFromServer(bookId: string, buyerToken: string): Promise<boolean> {
  try {
    const response = await fetch("/api/purchases/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, buyerToken }),
    });
    const data = await response.json();
    return data.purchased;
  } catch {
    return false;
  }
}

interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

const defaultSettings: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: "'Libre Baskerville', serif",
};

interface Chapter {
  title: string;
  startParagraph: number;
  level: number;
}

const CHAPTER_PATTERNS = [
  /^(chapter\s+\d+[.:)—\-\s]*.*)/i,
  /^(part\s+\d+[.:)—\-\s]*.*)/i,
  /^(section\s+\d+[.:)—\-\s]*.*)/i,
  /^(prologue|epilogue|introduction|preface|foreword|afterword|acknowledgments|appendix)/i,
  /^(chapter\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[.:)—\-\s]*.*)/i,
  /^([IVXLCDM]+\.\s+.+)/,
  /^(\d+\.\s+[A-Z].{2,})/,
  /^(#{1,3}\s+.+)/,
  /^(<h[1-3][^>]*>(.+?)<\/h[1-3]>)/i,
];

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function detectChapters(paragraphs: string[]): Chapter[] {
  const chapters: Chapter[] = [];

  paragraphs.forEach((p, idx) => {
    const trimmed = p.trim();
    if (trimmed.length < 2 || trimmed.length > 150) return;

    const htmlHeadingMatch = trimmed.match(/^<h([1-3])[^>]*>(.+?)<\/h[1-3]>/i);
    if (htmlHeadingMatch) {
      const level = parseInt(htmlHeadingMatch[1]) <= 1 ? 0 : 1;
      chapters.push({
        title: stripHtml(htmlHeadingMatch[2]),
        startParagraph: idx,
        level,
      });
      return;
    }

    const mdHeadingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (mdHeadingMatch) {
      const level = mdHeadingMatch[1].length <= 1 ? 0 : 1;
      chapters.push({
        title: mdHeadingMatch[2].trim(),
        startParagraph: idx,
        level,
      });
      return;
    }

    for (const pattern of CHAPTER_PATTERNS.slice(0, 7)) {
      const match = trimmed.match(pattern);
      if (match) {
        const level = /^(part\s)/i.test(trimmed) ? 0 : 1;
        chapters.push({
          title: match[1].trim(),
          startParagraph: idx,
          level,
        });
        break;
      }
    }
  });

  if (chapters.length === 0) {
    const targetSections = Math.min(12, Math.max(3, Math.ceil(paragraphs.length / 8)));
    const chunkSize = Math.max(3, Math.ceil(paragraphs.length / targetSections));
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const sectionNum = Math.floor(i / chunkSize) + 1;
      chapters.push({
        title: `Section ${sectionNum}`,
        startParagraph: i,
        level: 1,
      });
    }
  }

  return chapters;
}

function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export default function ReaderPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [currentPage, setCurrentPage] = useState(0);
  const [offlineBook, setOfflineBook] = useState<any>(null);
  const [isPurchased, setIsPurchased] = useState(false);
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);
  const inactivityTimeout = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuth();

  const { data: book, isLoading, error } = useQuery({
    queryKey: ["book", params.id],
    queryFn: () => fetchBook(params.id!),
    enabled: !!params.id,
  });

  const { data: conversionData, refetch: refetchConversion } = useQuery({
    queryKey: ["book-conversion", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/books/${params.id}/conversion-status`, { credentials: "include" });
      return res.json();
    },
    enabled: !!params.id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.conversionStatus === "processing" || data?.conversionStatus === "pending") {
        return 3000;
      }
      return false;
    },
  });

  const [isAuthorFromServer, setIsAuthorFromServer] = useState(false);
  const [hasServerAccess, setHasServerAccess] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem("lumina_reader_settings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    async function checkPurchaseStatus() {
      if (params.id) {
        try {
          const buyerToken = getBuyerToken();
          const urlParams = new URLSearchParams();
          if (buyerToken) urlParams.set("buyerToken", buyerToken);
          const resp = await fetch(`/api/books/${params.id}/access?${urlParams.toString()}`, {
            credentials: "include",
          });
          if (resp.ok) {
            const data = await resp.json();
            setIsPurchased(data.isPurchased === true);
            setIsAuthorFromServer(data.isAuthor === true);
            setHasServerAccess(data.hasAccess === true);
          }
        } catch {
          setIsPurchased(false);
        }

        const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (library[params.id]) {
          setOfflineBook(library[params.id]);
        }
      }
    }
    checkPurchaseStatus();
  }, [params.id, user?.id]);

  const isAuthor = isAuthorFromServer || (user?.id && book?.authorId && user.id === String(book.authorId));
  const hasAccess = isPurchased || isAuthor || hasServerAccess;

  useEffect(() => {
    if (hasAccess && book && !offlineBook) {
      const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!library[book.id]) {
        library[book.id] = {
          id: book.id,
          title: book.title,
          author: book.author,
          cover: book.cover,
          content: book.content,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
        setOfflineBook(library[book.id]);
      }
    }
  }, [hasAccess, book, offlineBook]);

  useEffect(() => {
    if (params.id && hasAccess) {
      const positions = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
      if (positions[params.id] !== undefined) {
        setCurrentPage(positions[params.id]);
      }
    }
  }, [params.id, hasAccess]);

  useEffect(() => {
    if (params.id && hasAccess) {
      const positions = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
      positions[params.id] = currentPage;
      localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
    }
  }, [currentPage, params.id, hasAccess]);

  useEffect(() => {
    localStorage.setItem("lumina_reader_settings", JSON.stringify(settings));
  }, [settings]);

  const saveForOffline = () => {
    if (!book || !hasAccess) return;
    const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    library[book.id] = {
      id: book.id,
      title: book.title,
      author: book.author,
      cover: book.cover,
      content: book.content,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    setOfflineBook(library[book.id]);
  };

  const activeBook = offlineBook || book;
  const fullContent = activeBook?.content || "";
  const sampleContent = activeBook?.sampleText || (fullContent.length > 500 ? fullContent.substring(0, 500) + "..." : fullContent.substring(0, Math.floor(fullContent.length * 0.1)));

  const displayContent = hasAccess ? fullContent : sampleContent;

  const paragraphs = useMemo(() => {
    let blocks = displayContent.split('\n\n').filter((p: string) => p.trim());
    if (blocks.length <= 3) {
      blocks = displayContent.split('\n').filter((p: string) => p.trim());
    }
    return blocks;
  }, [displayContent]);
  const PARAGRAPHS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE));

  const chapters = useMemo(() => detectChapters(paragraphs), [paragraphs]);

  const currentContent = paragraphs
    .slice(currentPage * PARAGRAPHS_PER_PAGE, (currentPage + 1) * PARAGRAPHS_PER_PAGE)
    .join('\n\n');

  const totalReadingTime = calculateReadingTime(fullContent);
  const readPages = currentPage + 1;
  const progressPercent = Math.round((readPages / totalPages) * 100);
  const remainingTime = Math.ceil(totalReadingTime * ((totalPages - readPages) / totalPages));

  const currentChapterIndex = useMemo(() => {
    const currentParagraphStart = currentPage * PARAGRAPHS_PER_PAGE;
    let chIdx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].startParagraph <= currentParagraphStart) {
        chIdx = i;
      } else {
        break;
      }
    }
    return chIdx;
  }, [currentPage, chapters]);

  const goToPrev = useCallback(() => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const goToNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setDirection(1);
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    const validPage = Math.max(0, Math.min(totalPages - 1, page - 1));
    setDirection(validPage > currentPage ? 1 : -1);
    setCurrentPage(validPage);
    setShowPageJump(false);
    setPageJumpInput("");
  };

  const goToChapter = (chapter: Chapter) => {
    const page = Math.floor(chapter.startParagraph / PARAGRAPHS_PER_PAGE);
    setDirection(page > currentPage ? 1 : -1);
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageJumpInput);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
    }
    setShowControls(true);
    inactivityTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchMoved.current = false;
    resetInactivityTimer();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    const moveX = Math.abs(touchEndX.current - touchStartX.current);
    const moveY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (moveX > 10 || moveY > 10) {
      touchMoved.current = true;
    }
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    } else if (!touchMoved.current) {
      const width = window.innerWidth;
      const x = touchStartX.current;
      if (x < width * 0.25) {
        goToPrev();
      } else if (x > width * 0.75) {
        goToNext();
      } else {
        setShowControls(prev => !prev);
      }
    }
  };

  const handleMouseMove = () => {
    resetInactivityTimer();
  };

  const handleCenterTap = () => {
    setShowControls(prev => !prev);
    resetInactivityTimer();
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimeout.current) {
        clearTimeout(inactivityTimeout.current);
      }
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetInactivityTimer();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "Escape") {
        if (sidebarOpen) setSidebarOpen(false);
        else if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, isFullscreen, resetInactivityTimer, sidebarOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const epubUrl = hasAccess ? (conversionData?.epubFileUrl || book?.epubFileUrl) : null;
  const conversionStatus = conversionData?.conversionStatus || book?.conversionStatus || "none";
  const isConverting = conversionStatus === "processing" || conversionStatus === "pending";
  const conversionFailed = conversionStatus === "failed";
  const hasEpub = !!epubUrl && conversionStatus === "completed";
  const hasLegacyFile = conversionData?.hasLegacyFile === true;

  const [autoConvertTriggered, setAutoConvertTriggered] = useState(false);
  useEffect(() => {
    if (hasAccess && !hasEpub && !isConverting && !conversionFailed && conversionStatus === "none" && hasLegacyFile && !autoConvertTriggered) {
      setAutoConvertTriggered(true);
      fetch(`/api/books/${params.id}/reconvert`, { method: "POST", credentials: "include" })
        .then(() => refetchConversion())
        .catch(console.error);
    }
  }, [hasAccess, hasEpub, isConverting, conversionFailed, conversionStatus, hasLegacyFile, params.id, autoConvertTriggered]);

  const isChapterHeading = (text: string): boolean => {
    const trimmed = text.trim();
    return CHAPTER_PATTERNS.some(pattern => pattern.test(trimmed));
  };

  if (isLoading && !offlineBook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
          />
          <p className="text-foreground font-serif">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error && !offlineBook) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BookOpen className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground font-serif">Failed to load book</p>
        <Button onClick={() => setLocation("/store")} data-testid="button-back-store">Back to Store</Button>
      </div>
    );
  }

  if (hasAccess && hasEpub) {
    return (
      <EpubReader
        url={epubUrl}
        bookTitle={book?.title}
        bookAuthor={book?.author}
        bookId={params.id}
        onBack={() => setLocation("/")}
      />
    );
  }

  if (hasAccess && (isConverting || (autoConvertTriggered && conversionStatus === "none"))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#f5f0e8]">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-6"
          >
            <Loader2 className="w-16 h-16 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-serif font-bold text-primary mb-3">
            Preparing Your Book
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Your book is being converted to an enhanced reading format. 
            This usually takes less than a minute.
          </p>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: ["0%", "70%", "90%", "70%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The page will update automatically when ready
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation(`/book/${params.id}`)}
          data-testid="button-back-while-converting"
        >
          Back to Book Details
        </Button>
      </div>
    );
  }

  if (hasAccess && conversionFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#f5f0e8]">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-primary mb-3">
            Conversion Issue
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            We had trouble converting this book to the enhanced reading format. 
            You can try again or read the text version below.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={async () => {
                await fetch(`/api/books/${params.id}/reconvert`, { method: "POST", credentials: "include" });
                refetchConversion();
              }}
              data-testid="button-retry-conversion"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!displayContent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BookOpen className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground font-serif">
          {hasAccess ? "No content available for this book" : "No sample available for this book"}
        </p>
        <Button onClick={() => setLocation(`/book/${params.id}`)} data-testid="button-back-store">
          {hasAccess ? "Back to Store" : "View Book Details"}
        </Button>
      </div>
    );
  }

  const pageVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  const chapterList = (
    <div className="flex-1 overflow-y-auto py-2">
      {chapters.map((chapter, idx) => {
        const isActive = idx === currentChapterIndex;
        const chapterPage = Math.floor(chapter.startParagraph / PARAGRAPHS_PER_PAGE) + 1;
        return (
          <button
            key={idx}
            onClick={() => goToChapter(chapter)}
            className={`w-full text-left px-4 py-3 transition-all duration-150 border-l-3 ${
              isActive
                ? "bg-primary/10 border-l-primary text-primary font-semibold"
                : "border-l-transparent hover:bg-muted hover:border-l-border text-foreground"
            } ${chapter.level === 0 ? "pl-4" : "pl-6"}`}
            data-testid={`button-chapter-${idx}`}
          >
            <span className={`block text-sm leading-snug ${chapter.level === 0 ? "font-serif font-bold uppercase text-xs tracking-wider" : ""}`}>
              {chapter.title}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              Page {chapterPage}
            </span>
          </button>
        );
      })}
    </div>
  );

  const sidebarFooter = (
    <div className="p-4 border-t border-border">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{progressPercent}% complete</span>
        <span>{remainingTime} min left</span>
      </div>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex bg-background text-foreground"
    >
      <aside
        className="hidden lg:flex w-[280px] flex-shrink-0 border-r border-border bg-card flex-col h-screen sticky top-0"
        data-testid="sidebar-chapters-desktop"
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-serif font-bold text-sm text-foreground">Table of Contents</h2>
        </div>
        {chapterList}
        {sidebarFooter}
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[300px] bg-card border-r border-border z-50 flex flex-col shadow-xl lg:hidden"
              data-testid="sidebar-chapters-mobile"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h2 className="font-serif font-bold text-sm text-foreground">Table of Contents</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  data-testid="button-close-sidebar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {chapterList}
              {sidebarFooter}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen">
        <div
          className="fixed top-0 left-0 right-0 h-0.5 z-50 transition-all duration-300"
          style={{ width: `${progressPercent}%`, background: "hsl(215 50% 23%)" }}
          data-testid="progress-bar"
        />

        <header
              className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm relative z-40"
            >
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="h-9 w-9 text-foreground lg:hidden"
                  data-testid="button-open-sidebar"
                  title="Table of Contents"
                >
                  <List className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/")}
                  className="h-9 w-9 text-foreground"
                  data-testid="button-home"
                >
                  <Home className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrev}
                  disabled={currentPage === 0}
                  className="h-8 gap-1 text-foreground"
                  data-testid="button-prev-header"
                >
                  <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
                </Button>

                {showPageJump ? (
                  <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageJumpInput}
                      onChange={(e) => setPageJumpInput(e.target.value)}
                      placeholder={String(currentPage + 1)}
                      className="w-12 h-8 text-center text-sm rounded-md border border-border bg-background text-foreground"
                      autoFocus
                      data-testid="input-page-jump"
                    />
                    <span className="text-xs text-muted-foreground">/ {totalPages}</span>
                    <Button type="submit" size="sm" variant="ghost" className="h-8 px-2" data-testid="button-go-page">Go</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-1" onClick={() => { setShowPageJump(false); setPageJumpInput(""); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowPageJump(true)}
                    className="text-sm text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1 rounded-md hover:bg-muted transition-colors whitespace-nowrap"
                    data-testid="text-page-number"
                    title="Click to jump to page"
                  >
                    Page {currentPage + 1} of {totalPages}
                  </button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNext}
                  disabled={currentPage >= totalPages - 1}
                  className="h-8 gap-1 text-foreground"
                  data-testid="button-next-header"
                >
                  <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(z => Math.max(50, z - 10))}
                  className="h-8 w-8 text-foreground"
                  data-testid="button-zoom-out"
                  title="Zoom out"
                >
                  <Search className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(z => Math.min(200, z + 10))}
                  className="h-8 w-8 text-foreground"
                  data-testid="button-zoom-in"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 text-foreground"
                  data-testid="button-fullscreen"
                  title="Toggle fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </header>

        <main className="flex-1 flex flex-col">
            <>
              <div
                ref={contentRef}
                className="flex-1 w-full overflow-y-auto bg-[#f5f0e8]"
                onMouseMove={handleMouseMove}
                onScroll={() => resetInactivityTimer()}
                onWheel={() => resetInactivityTimer()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="max-w-3xl mx-auto my-6 md:my-10 bg-[#faf7f0] shadow-lg border border-[#e8e0d0] rounded-sm min-h-[80vh]">
                <div
                  className="max-w-2xl mx-auto px-6 md:px-16 py-10 md:py-14"
                  style={{
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize * (zoom / 100)}px`,
                    lineHeight: settings.lineHeight,
                  }}
                >
                  {currentPage === 0 && (
                    <div className="mb-10 md:mb-14 text-center pb-8 border-b border-border/50">
                      <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-2">
                        {activeBook?.title}
                      </h1>
                      <p className="text-muted-foreground text-sm italic">by {activeBook?.author}</p>
                    </div>
                  )}

                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentPage}
                      custom={direction}
                      variants={pageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      {(() => {
                        const pageParagraphs = currentContent.split('\n\n').filter((p: string) => p.trim());
                        if (pageParagraphs.length <= 1 && currentContent.includes('\n')) {
                          const singleNewlines = currentContent.split('\n').filter((p: string) => p.trim());
                          if (singleNewlines.length > pageParagraphs.length) {
                            pageParagraphs.length = 0;
                            pageParagraphs.push(...singleNewlines);
                          }
                        }
                        let prevWasHeading = false;

                        return pageParagraphs.map((paragraph: string, idx: number) => {
                          const isHeading = isChapterHeading(paragraph.trim());

                          if (isHeading) {
                            prevWasHeading = true;
                            return (
                              <h2
                                key={idx}
                                className="font-serif text-xl md:text-2xl font-bold text-primary text-center my-8 md:my-12 tracking-wide"
                              >
                                {stripHtml(paragraph.trim())}
                              </h2>
                            );
                          }

                          const showDropCap = (idx === 0 && currentPage === 0) || prevWasHeading;
                          prevWasHeading = false;

                          return (
                            <p
                              key={idx}
                              className="mb-5 text-justify text-foreground leading-relaxed"
                              style={{
                                textIndent: showDropCap ? "0" : "1.5em",
                              }}
                            >
                              {showDropCap && paragraph.length > 0 ? (
                                <>
                                  <span className="text-4xl font-serif font-bold text-primary float-left mr-2 mt-1 leading-none">
                                    {paragraph.charAt(0)}
                                  </span>
                                  {paragraph.slice(1)}
                                </>
                              ) : (
                                paragraph
                              )}
                            </p>
                          );
                        });
                      })()}

                      {!hasAccess && currentPage >= totalPages - 1 && (
                        <div className="mt-10 p-8 bg-muted/50 rounded-xl text-center border border-border">
                          <Lock className="w-10 h-10 mx-auto mb-4 text-primary/40" />
                          <p className="font-serif text-lg font-bold text-foreground mb-2">End of Preview</p>
                          <p className="text-sm text-muted-foreground mb-5">Purchase this book to continue reading the full content</p>
                          <Button
                            onClick={() => setLocation(`/book/${params.id}`)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="button-purchase"
                          >
                            Purchase to Read More
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                </div>
              </div>

              {hasAccess && !showControls && (
                <div className="fixed inset-0 z-30 pointer-events-none hidden md:block">
                  <button
                    onClick={goToPrev}
                    className="absolute left-0 top-0 bottom-0 w-1/4 pointer-events-auto opacity-0 cursor-w-resize"
                    aria-label="Previous page"
                    data-testid="tap-zone-prev"
                  />
                  <button
                    onClick={handleCenterTap}
                    className="absolute left-1/4 top-0 bottom-0 w-1/2 pointer-events-auto opacity-0 cursor-default"
                    aria-label="Toggle controls"
                    data-testid="tap-zone-center"
                  />
                  <button
                    onClick={goToNext}
                    className="absolute right-0 top-0 bottom-0 w-1/4 pointer-events-auto opacity-0 cursor-e-resize"
                    aria-label="Next page"
                    data-testid="tap-zone-next"
                  />
                </div>
              )}

            </>
        </main>
      </div>
    </div>
  );
}
