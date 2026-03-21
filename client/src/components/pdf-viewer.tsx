import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  fileData: string;
  className?: string;
  theme?: "light" | "sepia" | "dark";
}

const themeColors = {
  light: { bg: "#ffffff", text: "#1a1a1a", border: "#e5e5e5", headerBg: "rgba(255,255,255,0.9)" },
  sepia: { bg: "#f4ecd8", text: "#5b4636", border: "#d4c5b5", headerBg: "rgba(244,236,216,0.9)" },
  dark: { bg: "#1a1a1a", text: "#e0e0e0", border: "#333333", headerBg: "rgba(26,26,26,0.9)" },
};

export function PDFViewer({ fileData, className = "", theme = "sepia" }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("");
  
  const colors = themeColors[theme];

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(numPages, page));
    setPageNumber(validPage);
    setShowPageJump(false);
    setPageJumpInput("");
  };
  
  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageJumpInput);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  const pdfData = fileData.startsWith("data:") 
    ? fileData 
    : `data:application/pdf;base64,${fileData}`;

  return (
    <div 
      className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50" : ""} ${className}`}
      style={{ backgroundColor: colors.bg }}
    >
      <div 
        className="flex items-center justify-between p-4 backdrop-blur border-b"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            style={{ borderColor: colors.border, color: colors.text }}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {showPageJump ? (
            <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                placeholder={String(pageNumber)}
                className="w-16 h-8 text-center text-sm rounded border bg-transparent"
                style={{ borderColor: colors.border, color: colors.text }}
                autoFocus
                data-testid="input-pdf-page-jump"
              />
              <span className="text-sm px-1" style={{ color: colors.text }}>of {numPages}</span>
              <Button type="submit" size="sm" variant="ghost" style={{ color: colors.text }}>
                Go
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="ghost" 
                onClick={() => { setShowPageJump(false); setPageJumpInput(""); }}
                style={{ color: colors.text }}
              >
                ×
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setShowPageJump(true)}
              className="text-sm px-3 cursor-pointer hover:underline"
              style={{ color: colors.text }}
              data-testid="text-page-info"
              title="Click to jump to page"
            >
              Page {pageNumber} of {numPages}
            </button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{ borderColor: colors.border, color: colors.text }}
            data-testid="button-next-page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            style={{ borderColor: colors.border, color: colors.text }}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center" style={{ color: colors.text }} data-testid="text-zoom-level">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 3.0}
            style={{ borderColor: colors.border, color: colors.text }}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            style={{ borderColor: colors.border, color: colors.text }}
            data-testid="button-fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex justify-center p-4" style={{ backgroundColor: colors.bg }}>
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3d5a80]"></div>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-96 text-red-600">
              Failed to load PDF. Please try again.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {isFullscreen && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 border-[#d4c5b5] bg-white"
          data-testid="button-exit-fullscreen"
        >
          Exit Fullscreen
        </Button>
      )}
    </div>
  );
}
