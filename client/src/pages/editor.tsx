import { useState, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf";
import { useProject } from "@/lib/project-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Upload, FileText, ChevronRight, Check, Book, Store, Image, LogIn, Pen, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBook, PaymentRequiredError } from "@/lib/api";

const BOOK_CATEGORIES = [
  "Fiction", "Non-Fiction", "Business", "Self-Help", "Biography",
  "Romance", "Sci-Fi", "Fantasy", "Mystery", "Thriller", "History",
  "Finance", "Health", "Technology", "Poetry", "Religion", "Design",
  "Lifestyle", "Other"
];
import { CoverEditor } from "@/components/cover-editor";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const STEPS = [
  { id: "upload", title: "Upload Typeset", icon: Upload },
  { id: "about", title: "About the Book", icon: FileText },
  { id: "metadata", title: "Cover & Details", icon: Book },
  { id: "publish", title: "Publish", icon: Store },
];

export default function Editor() {
  const { currentStep, setStep, manuscript, saveDraft, hasSavedDraft } = useProject();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [saveIndicator, setSaveIndicator] = useState(false);

  const handleSaveDraft = () => {
    saveDraft();
    setSaveIndicator(true);
    toast({ title: "Draft saved", description: "Your progress has been saved. You can continue later." });
    setTimeout(() => setSaveIndicator(false), 2000);
  };

  const stepCompleteness = [
    !!(manuscript.fileData && manuscript.fileType),
    !!manuscript.sampleText?.trim(),
    !!(manuscript.title?.trim() && manuscript.author?.trim()),
    true,
  ];

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
              <Pen className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-4">
              Publish Your Masterpiece
            </h1>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Sign in to upload your manuscript and publish it to the Fundi store. 
              Your first book is free, then just $25 per upload with a small monthly subscription.
            </p>
            <Button asChild size="lg" className="text-lg px-8" data-testid="button-signin-to-publish">
              <a href="/api/login">
                <LogIn className="w-5 h-5 mr-2" />
                Sign In to Publish
              </a>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 h-[calc(100vh-64px)] flex gap-8">
        <aside className="w-64 hidden md:flex flex-col gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = stepCompleteness[index] && index < currentStep;
            
            return (
              <button
                key={step.id}
                onClick={() => setStep(index)}
                disabled={index > currentStep && !stepCompleteness.slice(0, index).every(Boolean)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all text-left",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "hover:bg-accent text-muted-foreground",
                  isCompleted && "text-primary font-semibold",
                  index > currentStep && !stepCompleteness.slice(0, index).every(Boolean) && "opacity-50 cursor-not-allowed"
                )}
                data-testid={`step-${step.id}`}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors",
                  isActive ? "border-white bg-white/20" : "border-current",
                  isCompleted && !isActive && "bg-primary/10 border-primary"
                )}>
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
              data-testid="button-save-draft"
            >
              <Save className="w-4 h-4" />
              {saveIndicator ? "Saved!" : "Save Progress"}
            </Button>
            {hasSavedDraft && (
              <p className="text-xs text-muted-foreground text-center mt-2">Draft saved locally</p>
            )}
          </div>
        </aside>

        <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col relative">
          <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSaveDraft} data-testid="button-save-draft-mobile">
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {currentStep === 0 && <UploadStep />}
                {currentStep === 1 && <AboutStep />}
                {currentStep === 2 && <MetadataStep />}
                {currentStep === 3 && <PublishStep />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function UploadStep() {
  const { updateManuscript, setStep } = useProject();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setIsProcessing(true);
      const title = file.name.split('.')[0].replace(/_/g, ' ').replace(/-/g, ' ');
      const fileType = file.type || 'application/octet-stream';
      
      const dataUrlReader = new FileReader();
      dataUrlReader.onload = (e) => {
        const fileData = e.target?.result as string || "";
        const base64Data = fileData.split(',')[1] || fileData;
        
        if (file.type === 'text/plain') {
          const textReader = new FileReader();
          textReader.onload = (te) => {
            const textContent = te.target?.result as string || "";
            updateManuscript({ 
              file, 
              title,
              content: textContent,
              fileData: base64Data,
              fileType
            });
            setIsProcessing(false);
            setStep(1);
          };
          textReader.onerror = () => {
            updateManuscript({ 
              file, 
              title,
              content: `[Content from ${file.name}]`,
              fileData: base64Data,
              fileType
            });
            setIsProcessing(false);
            setStep(1);
          };
          textReader.readAsText(file);
        } else {
          updateManuscript({ 
            file, 
            title,
            content: `[PDF Document - ${file.name}]`,
            fileData: base64Data,
            fileType
          });
          setIsProcessing(false);
          setStep(1);
        }
      };
      dataUrlReader.onerror = () => {
        updateManuscript({ 
          file, 
          title,
          content: `[Unable to read file: ${file.name}]`,
          fileData: null,
          fileType: null
        });
        setIsProcessing(false);
        setStep(1);
      };
      dataUrlReader.readAsDataURL(file);
    }
  }, [updateManuscript, setStep]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 
      'text/plain': ['.txt'], 
      'application/pdf': ['.pdf'], 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/epub+zip': ['.epub'],
      'text/html': ['.html', '.htm'],
    } 
  });

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div 
        {...getRootProps()} 
        className={cn(
          "w-full max-w-xl h-96 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
        data-testid="dropzone-upload"
      >
        <input {...getInputProps()} data-testid="input-file" />
        <div className="bg-primary/10 p-6 rounded-full mb-6 text-primary">
          <Upload size={48} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
          {isProcessing ? "Processing..." : "Upload your typeset"}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Upload your professionally formatted book file. We accept PDF, EPUB, DOCX, TXT, or HTML formats.
        </p>
        <Button variant="outline" disabled={isProcessing} data-testid="button-select-file">
          Select File
        </Button>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Your typeset should be print-ready. We recommend PDF or EPUB for best quality.
      </p>
    </div>
  );
}

function AboutStep() {
  const { manuscript, updateManuscript, setStep } = useProject();
  const [sampleText, setSampleText] = useState(manuscript.sampleText || "");
  
  const handleContinue = () => {
    updateManuscript({ sampleText });
    setStep(2);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-primary mb-2">About the Book</h2>
          <p className="text-muted-foreground">
            Write a sample or excerpt that potential buyers can read before purchasing. 
            This helps readers decide if your book is right for them.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Tip:</strong> Include your book's opening chapter, a compelling excerpt, 
            or a summary that captures the essence of your work. This is what readers will 
            see when they click "Read Sample".
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <Label htmlFor="sample-text" className="text-lg font-medium">
            Sample Text / Excerpt
          </Label>
          <Textarea
            id="sample-text"
            placeholder="Paste your book's opening chapter, a compelling excerpt, or summary here...

Example:
CHAPTER ONE

The morning sun filtered through the dusty windows of the old library, casting long shadows across the worn wooden floors..."
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            className="min-h-[400px] font-serif text-base leading-relaxed"
            data-testid="textarea-sample"
          />
          <p className="text-sm text-muted-foreground">
            {sampleText.length} characters • Recommended: 500-2000 characters
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(0)} data-testid="button-back">
            Back
          </Button>
          <Button 
            size="lg" 
            onClick={handleContinue}
            disabled={!sampleText.trim()}
            data-testid="button-continue"
          >
            Continue <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetadataStep() {
  const { manuscript, updateManuscript, setStep } = useProject();
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const onCoverDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setRawImageUrl(dataUrl);
        setEditorOpen(true);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps: getCoverRootProps, getInputProps: getCoverInputProps } = useDropzone({
    onDrop: onCoverDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: false,
  });

  const handleEditorSave = (croppedDataUrl: string) => {
    updateManuscript({ cover: croppedDataUrl });
    setEditorOpen(false);
    setRawImageUrl(null);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-primary mb-2">Cover & Details</h2>
          <p className="text-muted-foreground">Add your book cover and author information.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Book Title</Label>
              <Input
                id="title"
                value={manuscript.title || ""}
                onChange={(e) => updateManuscript({ title: e.target.value })}
                placeholder="Enter book title"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author Name</Label>
              <Input
                id="author"
                value={manuscript.author || ""}
                onChange={(e) => updateManuscript({ author: e.target.value })}
                placeholder="Enter author name"
                data-testid="input-author"
              />
            </div>

            <div className="space-y-2">
              <Label>Book Cover</Label>
              <div
                {...getCoverRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  "hover:border-primary/50 hover:bg-accent/50"
                )}
                data-testid="dropzone-cover"
              >
                <input {...getCoverInputProps()} data-testid="input-cover" />
                <Image className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop cover image here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 1200x1800px (2:3 ratio)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <Label className="self-start mb-2">Store Preview</Label>
            <div className="relative">
              <div className="w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-xl book-shadow bg-zinc-200">
                {manuscript.cover ? (
                  <img
                    src={manuscript.cover}
                    alt="Store preview"
                    className="w-full h-full object-cover"
                    data-testid="img-cover-preview"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs text-center p-2">
                    Your cover here
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              This is how your book will appear in the marketplace
            </p>
          </div>
        </div>

        <div className="pt-8 flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back">
            Back
          </Button>
          <Button 
            size="lg" 
            onClick={() => setStep(3)} 
            disabled={!manuscript.title || !manuscript.author}
            data-testid="button-finalize"
          >
            Finalize <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {rawImageUrl && (
        <CoverEditor
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setRawImageUrl(null);
          }}
          imageSrc={rawImageUrl}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
}

function getOrCreateAuthorId(): string {
  let authorId = localStorage.getItem("fundi_author_id");
  if (!authorId) {
    // Check if there's an existing author claim from previous sessions
    authorId = "author_manual_owner_001";
    localStorage.setItem("fundi_author_id", authorId);
  }
  return authorId;
}

function PublishStep() {
  const { manuscript, clearDraft } = useProject();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("9.99");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [uploadFee, setUploadFee] = useState(25);
  
  const [isUploading, setIsUploading] = useState(false);

  const uploadFileToStorage = async (): Promise<{ originalFileUrl: string; originalFormat: string } | null> => {
    if (!manuscript.fileData || !manuscript.fileType) return null;

    try {
      const ext = manuscript.fileType.split("/")[1] || "bin";
      const res = await fetch("/api/upload/request-signed-url", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          filename: `manuscript-${Date.now()}.${ext}`,
          contentType: manuscript.fileType,
        }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const data = await res.json();
      const uploadUrl = data.uploadURL || data.uploadUrl;
      const objectPath = data.objectPath;

      const binaryString = atob(manuscript.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: manuscript.fileType });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": manuscript.fileType,
          "Content-Length": String(blob.size),
          "x-amz-acl": "public-read",
        },
      });
      if (!uploadRes.ok) throw new Error("File upload failed");

      return { originalFileUrl: objectPath, originalFormat: manuscript.fileType };
    } catch (err) {
      console.error("File upload error:", err);
      return null;
    }
  };

  const getBookData = (uploadResult?: { originalFileUrl: string; originalFormat: string } | null) => {
    const authorId = getOrCreateAuthorId();
    const bookData: any = {
      title: manuscript.title || "Untitled",
      author: manuscript.author || "Anonymous",
      cover: manuscript.cover,
      content: manuscript.content,
      sampleText: manuscript.sampleText || "",
      price: parseFloat(price) || 9.99,
      category: category,
      rating: 0,
      bestseller: false,
      description: description || `${manuscript.title} - A new release on Fundi.`,
      authorId: authorId,
      fileType: manuscript.fileType,
    };

    if (uploadResult) {
      bookData.originalFileUrl = uploadResult.originalFileUrl;
      bookData.originalFormat = uploadResult.originalFormat;
    } else {
      bookData.fileData = manuscript.fileData;
    }

    return bookData;
  };
  
  const hasFile = !!(manuscript.fileData && manuscript.fileType);
  const isReadyToPublish = !!(
    hasFile &&
    manuscript.sampleText?.trim() &&
    manuscript.title?.trim() &&
    manuscript.author?.trim() &&
    category
  );

  const publishMutation = useMutation({
    mutationFn: createBook,
    onSuccess: (data: any) => {
      setIsUploading(false);
      setPublishPhase("idle");
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["books"] });
      const isApproved = data?.isApproved === true;
      toast({
        title: isApproved ? "Published!" : "Submitted for Review!",
        description: isApproved
          ? "Your ebook is now live on the Fundi marketplace."
          : "Your ebook has been submitted and will appear in the store after admin approval.",
      });
      setLocation(isApproved ? "/store" : "/dashboard");
    },
    onError: (error) => {
      setIsUploading(false);
      setPublishPhase("idle");
      if (error instanceof PaymentRequiredError) {
        setUploadFee(error.uploadFee);
        setShowPaymentDialog(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to publish book. Please try again.",
          variant: "destructive",
        });
      }
    },
  });
  
  const [publishPhase, setPublishPhase] = useState<"idle" | "uploading" | "converting">("idle");

  const handlePublish = async () => {
    setIsUploading(true);
    setPublishPhase("uploading");
    try {
      const uploadResult = await uploadFileToStorage();
      setPublishPhase("converting");
      publishMutation.mutate(getBookData(uploadResult));
    } catch {
      setIsUploading(false);
      setPublishPhase("idle");
    }
  };
  
  const handlePaymentSuccess = async () => {
    setShowPaymentDialog(false);
    setIsUploading(true);
    setPublishPhase("uploading");
    try {
      const uploadResult = await uploadFileToStorage();
      setPublishPhase("converting");
      publishMutation.mutate({ ...getBookData(uploadResult), paymentConfirmed: true });
    } catch {
      setIsUploading(false);
      setPublishPhase("idle");
    }
  };
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="bg-green-100 text-green-700 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Check size={32} />
          </div>
          <h2 className="text-3xl font-serif font-bold text-primary mb-2">Ready to Publish!</h2>
          <p className="text-muted-foreground">
            "{manuscript.title || "Untitled"}" is ready for the marketplace.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left">
          <div className="flex gap-6">
            <div className="w-32 aspect-[2/3] rounded-lg overflow-hidden shadow-lg book-shadow shrink-0 bg-zinc-200">
              {manuscript.cover ? (
                <img src={manuscript.cover} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs p-2 text-center">
                  No cover
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-serif font-bold text-xl">{manuscript.title || "Untitled"}</h3>
                <p className="text-muted-foreground">by {manuscript.author || "Anonymous"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Selling Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0.99"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-32"
                  data-testid="input-price"
                />
                <p className="text-xs text-muted-foreground">You keep 75% of each sale</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="book-category" data-testid="select-book-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Book Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your book to attract readers..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>
            </div>
          </div>
        </div>

        {!isReadyToPublish && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-amber-800 font-medium mb-2">Complete the following before publishing:</p>
            <ul className="text-sm text-amber-700 space-y-1">
              {!hasFile && <li>- Upload a manuscript file</li>}
              {!manuscript.sampleText?.trim() && <li>- Add a sample text / excerpt</li>}
              {!manuscript.title?.trim() && <li>- Enter a book title</li>}
              {!manuscript.author?.trim() && <li>- Enter an author name</li>}
              {!category && <li>- Select a category</li>}
            </ul>
          </div>
        )}

        <Button 
          size="lg" 
          className="w-full h-14 text-lg"
          onClick={handlePublish}
          disabled={publishMutation.isPending || isUploading || !isReadyToPublish}
          data-testid="button-publish"
        >
          {publishPhase === "uploading" ? (
            <>Uploading your manuscript...</>
          ) : publishPhase === "converting" || publishMutation.isPending ? (
            <>Converting to ebook format...</>
          ) : !isReadyToPublish ? (
            <>Complete all steps to publish</>
          ) : (
            <>
              <Store className="mr-2 h-5 w-5" /> Publish to Fundi Marketplace
            </>
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          {isReadyToPublish 
            ? "Your ebook will be instantly available for purchase worldwide."
            : "Go back and fill in all required fields before publishing."}
        </p>
      </div>
      
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Fee Required</DialogTitle>
            <DialogDescription>
              Your first book was free! Additional books require a ${uploadFee} upload fee.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This one-time fee for "{manuscript.title || 'Untitled'}" covers hosting and marketplace listing.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Upload Fee</span>
                <span className="text-lg font-bold">${uploadFee}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePaymentSuccess}>
              Confirm & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
