import { useState, useEffect, useRef, useCallback } from "react";
import ePub, { Book, Rendition, NavItem } from "epubjs";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, List, Type, Sun, Moon,
  Maximize2, Minimize2, BookOpen, Search, X, Bookmark,
  ChevronDown, Home
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";

interface EpubReaderProps {
  url: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookId?: string;
  onBack?: () => void;
}

type ThemeMode = "light" | "sepia" | "dark";

const THEMES: Record<ThemeMode, { bg: string; text: string; name: string }> = {
  light: { bg: "#ffffff", text: "#1a1a1a", name: "Light" },
  sepia: { bg: "#f4ecd8", text: "#5b4636", name: "Sepia" },
  dark: { bg: "#1a1a1a", text: "#e0e0e0", name: "Dark" },
};

const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28];
const FONT_FAMILIES = [
  { name: "Serif", value: "'Libre Baskerville', Georgia, serif" },
  { name: "Sans", value: "'Inter', system-ui, sans-serif" },
  { name: "Mono", value: "'Courier New', monospace" },
];

export function EpubReader({ url, bookTitle, bookAuthor, bookId, onBack }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentChapter, setCurrentChapter] = useState("");

  const [theme, setTheme] = useState<ThemeMode>("sepia");
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [isCurrentBookmarked, setIsCurrentBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const loadedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (bookId) {
      const saved = localStorage.getItem(`fundi_epub_settings`);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.theme) setTheme(s.theme);
        if (s.fontSize) setFontSize(s.fontSize);
        if (s.fontFamily) setFontFamily(s.fontFamily);
      }
      const savedBookmarks = localStorage.getItem(`fundi_bookmarks_${bookId}`);
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    }
  }, [bookId]);

  useEffect(() => {
    localStorage.setItem(`fundi_epub_settings`, JSON.stringify({ theme, fontSize, fontFamily }));
  }, [theme, fontSize, fontFamily]);

  useEffect(() => {
    if (bookId) {
      localStorage.setItem(`fundi_bookmarks_${bookId}`, JSON.stringify(bookmarks));
    }
  }, [bookmarks, bookId]);

  useEffect(() => {
    if (!viewerRef.current || !url) return;

    setIsLoading(true);
    setLoadError(null);
    loadedRef.current = false;

    let destroyed = false;
    const book = ePub(url);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "paginated",
    });

    renditionRef.current = rendition;

    book.loaded.navigation.then((nav) => {
      if (!destroyed) setToc(nav.toc);
    }).catch((err: any) => {
      console.error("EPUB navigation load error:", err);
    });

    const savedLocation = bookId ? localStorage.getItem(`fundi_epub_location_${bookId}`) : null;
    const displayPromise = savedLocation
      ? rendition.display(savedLocation)
      : rendition.display();

    displayPromise.catch((err: any) => {
      console.error("EPUB display error:", err);
      if (!destroyed) {
        loadedRef.current = true;
        setLoadError("Could not display this book. The file may be damaged or in an unsupported format.");
        setIsLoading(false);
      }
    });

    rendition.on("relocated", (location: any) => {
      if (destroyed) return;
      loadedRef.current = true;
      setIsLoading(false);
      setLoadError(null);
      const cfi = location.start?.cfi;
      if (cfi) {
        setCurrentLocation(cfi);
        if (bookId) {
          localStorage.setItem(`fundi_epub_location_${bookId}`, cfi);
        }
        setIsCurrentBookmarked(bookmarks.includes(cfi));
      }
      if (location.start?.percentage !== undefined) {
        setProgress(Math.round(location.start.percentage * 100));
      }
      if (cfi && book.locations?.length()) {
        try {
          const loc = book.locations.locationFromCfi(cfi);
          setCurrentPage(typeof loc === "number" ? loc : 0);
          setTotalPages(book.locations.length());
        } catch (_) {}
      }
    });

    rendition.on("displayed", (section: any) => {
      if (destroyed) return;
      const navItem = book.navigation?.toc?.find((item: NavItem) => {
        return section.href?.includes(item.href);
      });
      if (navItem) {
        setCurrentChapter(navItem.label?.trim() || "");
      }
    });

    book.ready.then(() => {
      return book.locations.generate(1024);
    }).then(() => {
      if (!destroyed && book.locations?.length()) {
        setTotalPages(book.locations.length());
      }
    }).catch((err: any) => {
      console.error("EPUB locations generation error:", err);
    });

    const loadTimeout = setTimeout(() => {
      if (!destroyed && !loadedRef.current) {
        setLoadError("The book is taking too long to load. Please try again or go back.");
        setIsLoading(false);
      }
    }, 30000);

    return () => {
      destroyed = true;
      clearTimeout(loadTimeout);
      rendition.destroy();
      book.destroy();
      bookRef.current = null;
      renditionRef.current = null;
    };
  }, [url, retryKey]);

  const applyTheme = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const t = THEMES[theme];
    rendition.themes.default({
      body: {
        "background-color": `${t.bg} !important`,
        color: `${t.text} !important`,
        "font-family": `${fontFamily} !important`,
        "font-size": `${fontSize}px !important`,
        "line-height": "1.8 !important",
        "padding": "0 10px !important",
      },
      "p, div, span, li, td, th, h1, h2, h3, h4, h5, h6": {
        color: `${t.text} !important`,
        "font-family": `${fontFamily} !important`,
      },
      "a": {
        color: `${theme === "dark" ? "#6eb5ff" : "#3d5a80"} !important`,
      },
      "img": {
        "max-width": "100% !important",
        height: "auto !important",
      },
    });
  }, [theme, fontSize, fontFamily]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();

  const goToChapter = (href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
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

  const toggleBookmark = () => {
    if (!currentLocation) return;
    if (isCurrentBookmarked) {
      setBookmarks(prev => prev.filter(b => b !== currentLocation));
      setIsCurrentBookmarked(false);
    } else {
      setBookmarks(prev => [...prev, currentLocation]);
      setIsCurrentBookmarked(true);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !bookRef.current) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const book = bookRef.current;
      const results: any[] = [];
      const spine = book.spine as any;

      for (let i = 0; i < (spine.items?.length || spine.length || 0); i++) {
        const item = spine.items?.[i] || spine.get(i);
        if (!item) continue;
        try {
          const doc = await item.load(book.load.bind(book));
          const text = doc?.body?.textContent || doc?.textContent || "";
          const query = searchQuery.toLowerCase();
          let idx = text.toLowerCase().indexOf(query);
          while (idx !== -1 && results.length < 50) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + query.length + 40);
            const excerpt = text.slice(start, end);
            results.push({
              cfi: item.cfiFromElement?.(doc?.body) || item.href,
              href: item.href,
              excerpt: (start > 0 ? "..." : "") + excerpt + (end < text.length ? "..." : ""),
            });
            idx = text.toLowerCase().indexOf(query, idx + 1);
          }
          item.unload?.();
        } catch (_) {}
      }

      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchNavigate = (result: any) => {
    if (result.cfi && typeof result.cfi === "string" && result.cfi.startsWith("epubcfi")) {
      renditionRef.current?.display(result.cfi);
    } else if (result.href) {
      renditionRef.current?.display(result.href);
    }
    setShowSearch(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearch && e.key !== "Escape") return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "Escape") {
        setShowSettings(false);
        setShowToc(false);
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const themeColors = THEMES[theme];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-screen ${isFullscreen ? "fixed inset-0 z-50" : ""}`}
      style={{ backgroundColor: themeColors.bg }}
      data-testid="epub-reader-container"
    >
      <div
        className="h-0.5 transition-all duration-300"
        style={{ width: `${progress}%`, background: "#3d5a80" }}
        data-testid="epub-progress-bar"
      />

      <header
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: theme === "dark" ? "#333" : "#e5e5e5", backgroundColor: themeColors.bg }}
      >
        <div className="flex items-center gap-1">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
              style={{ color: themeColors.text }}
              data-testid="button-epub-back"
            >
              <Home className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToc(!showToc)}
            className="h-8 w-8"
            style={{ color: themeColors.text }}
            data-testid="button-epub-toc"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 text-center px-2 overflow-hidden">
          <p className="text-xs truncate" style={{ color: themeColors.text, opacity: 0.6 }}>
            {currentChapter || bookTitle || ""}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 w-8"
            style={{ color: themeColors.text }}
            data-testid="button-epub-search"
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleBookmark}
            className="h-8 w-8"
            style={{ color: isCurrentBookmarked ? "#e63946" : themeColors.text }}
            data-testid="button-epub-bookmark"
          >
            <Bookmark className={`w-4 h-4 ${isCurrentBookmarked ? "fill-current" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8"
            style={{ color: themeColors.text }}
            data-testid="button-epub-settings"
          >
            <Type className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
            style={{ color: themeColors.text }}
            data-testid="button-epub-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-12 right-2 z-50 w-72 rounded-lg shadow-xl border p-4"
          style={{
            backgroundColor: themeColors.bg,
            borderColor: theme === "dark" ? "#444" : "#ddd",
            color: themeColors.text,
          }}
          data-testid="epub-settings-panel"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium mb-2 opacity-70">Theme</p>
              <div className="flex gap-2">
                {(Object.keys(THEMES) as ThemeMode[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      theme === t ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{
                      backgroundColor: THEMES[t].bg,
                      color: THEMES[t].text,
                      borderColor: theme === "dark" ? "#555" : "#ccc",
                    }}
                    data-testid={`button-theme-${t}`}
                  >
                    {THEMES[t].name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2 opacity-70">Font Size: {fontSize}px</p>
              <div className="flex items-center gap-3">
                <span className="text-xs">A</span>
                <Slider
                  value={[fontSize]}
                  min={14}
                  max={28}
                  step={2}
                  onValueChange={([v]) => setFontSize(v)}
                  className="flex-1"
                  data-testid="slider-font-size"
                />
                <span className="text-lg font-bold">A</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2 opacity-70">Font</p>
              <div className="flex gap-2">
                {FONT_FAMILIES.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setFontFamily(f.value)}
                    className={`flex-1 py-1.5 rounded-md text-xs border transition-all ${
                      fontFamily === f.value ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{
                      fontFamily: f.value,
                      borderColor: theme === "dark" ? "#555" : "#ccc",
                      color: themeColors.text,
                    }}
                    data-testid={`button-font-${f.name.toLowerCase()}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showSearch && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-12 left-2 right-2 z-50 rounded-lg shadow-xl border p-4 max-h-[60vh] overflow-y-auto"
          style={{
            backgroundColor: themeColors.bg,
            borderColor: theme === "dark" ? "#444" : "#ddd",
            color: themeColors.text,
          }}
          data-testid="epub-search-panel"
        >
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search in book..."
              className="flex-1 px-3 py-2 text-sm rounded-md border bg-transparent"
              style={{ borderColor: theme === "dark" ? "#555" : "#ccc", color: themeColors.text }}
              autoFocus
              data-testid="input-epub-search"
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={isSearching}
              data-testid="button-epub-search-go"
            >
              {isSearching ? "..." : "Search"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(false)}
              className="h-9 w-9"
              style={{ color: themeColors.text }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs opacity-60">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSearchNavigate(r)}
                  className="w-full text-left p-2 rounded hover:bg-black/5 text-sm"
                  style={{ color: themeColors.text }}
                  data-testid={`search-result-${i}`}
                >
                  <span
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        r.excerpt.replace(
                          new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
                          "<mark style='background:#ffd166;padding:0 2px;border-radius:2px'>$1</mark>"
                        ),
                        { ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: ["style"] }
                      ),
                    }}
                  />
                </button>
              ))}
            </div>
          )}
          {!isSearching && searchResults.length === 0 && searchQuery && (
            <p className="text-xs opacity-60 text-center py-4">No results found</p>
          )}
        </motion.div>
      )}

      {showToc && (
        <motion.div
          initial={{ x: -300 }}
          animate={{ x: 0 }}
          exit={{ x: -300 }}
          className="fixed left-0 top-0 bottom-0 w-[300px] z-50 border-r shadow-xl overflow-y-auto"
          style={{
            backgroundColor: themeColors.bg,
            borderColor: theme === "dark" ? "#444" : "#ddd",
            color: themeColors.text,
          }}
          data-testid="epub-toc-panel"
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme === "dark" ? "#444" : "#ddd" }}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <h3 className="font-medium text-sm">Table of Contents</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowToc(false)}
              className="h-8 w-8"
              style={{ color: themeColors.text }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="py-2">
            {toc.map((item, idx) => (
              <button
                key={idx}
                onClick={() => goToChapter(item.href)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-black/5 transition-colors border-l-2"
                style={{
                  color: themeColors.text,
                  borderLeftColor: currentChapter === item.label?.trim() ? "#3d5a80" : "transparent",
                }}
                data-testid={`toc-item-${idx}`}
              >
                {item.label?.trim()}
              </button>
            ))}
            {bookmarks.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium opacity-60 border-t mt-2 pt-3"
                  style={{ borderColor: theme === "dark" ? "#444" : "#ddd" }}
                >
                  Bookmarks ({bookmarks.length})
                </div>
                {bookmarks.map((cfi, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      renditionRef.current?.display(cfi);
                      setShowToc(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 flex items-center gap-2"
                    style={{ color: themeColors.text }}
                    data-testid={`bookmark-item-${idx}`}
                  >
                    <Bookmark className="w-3 h-3 text-red-500 fill-current flex-shrink-0" />
                    <span className="truncate">Bookmark {idx + 1}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </motion.div>
      )}

      {showToc && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setShowToc(false)}
        />
      )}

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {(isLoading || loadError) && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: themeColors.bg }}>
            <div className="flex flex-col items-center gap-4 max-w-sm px-4 text-center">
              {loadError ? (
                <>
                  <X className="w-8 h-8 text-red-500" />
                  <p className="text-sm" style={{ color: themeColors.text }}>{loadError}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRetryKey(k => k + 1)}
                    >
                      Try Again
                    </Button>
                    {onBack && (
                      <Button size="sm" onClick={onBack}>
                        Go Back
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-[#3d5a80] border-t-transparent rounded-full"
                  />
                  <p className="text-sm" style={{ color: themeColors.text, opacity: 0.6 }}>Loading book...</p>
                </>
              )}
            </div>
          </div>
        )}

        <button
          onClick={goPrev}
          className="absolute left-0 top-0 bottom-12 w-12 z-10 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ color: themeColors.text }}
          aria-label="Previous page"
          data-testid="tap-zone-prev"
        >
          <ChevronLeft className="w-6 h-6 opacity-30" />
        </button>

        <div ref={viewerRef} className="w-full h-full" data-testid="epub-viewer" />

        <button
          onClick={goNext}
          className="absolute right-0 top-0 bottom-12 w-12 z-10 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ color: themeColors.text }}
          aria-label="Next page"
          data-testid="tap-zone-next"
        >
          <ChevronRight className="w-6 h-6 opacity-30" />
        </button>
      </div>

      <footer
        className="flex items-center justify-between px-4 py-2 border-t text-xs"
        style={{
          borderColor: theme === "dark" ? "#333" : "#e5e5e5",
          backgroundColor: themeColors.bg,
          color: themeColors.text,
          opacity: 0.6,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          className="h-7 px-2 text-xs"
          style={{ color: themeColors.text }}
          data-testid="button-epub-prev"
        >
          <ChevronLeft className="w-3 h-3 mr-1" /> Previous
        </Button>

        <span data-testid="text-epub-progress">
          {progress}% • {totalPages > 0 ? `${currentPage} / ${totalPages}` : ""}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          className="h-7 px-2 text-xs"
          style={{ color: themeColors.text }}
          data-testid="button-epub-next"
        >
          Next <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </footer>
    </div>
  );
}
