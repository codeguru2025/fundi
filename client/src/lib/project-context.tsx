import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Manuscript {
  file: File | null;
  content: string;
  fileData: string | null;
  fileType: string | null;
  sampleText: string;
  title: string;
  author: string;
  cover: string | null;
  chapters: Chapter[];
}

export interface PublishedBook extends Manuscript {
  id: string;
  price: number;
  category: string;
  rating: number;
  bestseller: boolean;
  description?: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface ProjectContextType {
  manuscript: Manuscript;
  updateManuscript: (updates: Partial<Manuscript>) => void;
  currentStep: number;
  setStep: (step: number) => void;
  resetProject: () => void;
  publishedBooks: PublishedBook[];
  publishBook: (book: PublishedBook) => void;
  saveDraft: () => void;
  hasSavedDraft: boolean;
  clearDraft: () => void;
}

const defaultManuscript: Manuscript = {
  file: null,
  content: "",
  fileData: null,
  fileType: null,
  sampleText: "",
  title: "",
  author: "",
  cover: null,
  chapters: [],
};

const DRAFT_KEY = "fundi_book_draft";

function loadDraft(): { manuscript: Manuscript; step: number } | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        manuscript: { ...defaultManuscript, ...parsed.manuscript, file: null },
        step: parsed.step || 0,
      };
    }
  } catch {}
  return null;
}

function saveDraftToStorage(manuscript: Manuscript, step: number) {
  try {
    const { file, ...rest } = manuscript;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ manuscript: rest, step }));
  } catch {}
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const draft = loadDraft();
  const [manuscript, setManuscript] = useState<Manuscript>(draft?.manuscript || defaultManuscript);
  const [currentStep, setCurrentStep] = useState(draft?.step || 0);
  const [publishedBooks, setPublishedBooks] = useState<PublishedBook[]>([]);
  const [hasSavedDraft, setHasSavedDraft] = useState(!!draft);

  const updateManuscript = (updates: Partial<Manuscript>) => {
    setManuscript((prev) => ({ ...prev, ...updates }));
  };

  const setStep = (step: number) => {
    setCurrentStep(step);
  };

  const saveDraft = () => {
    saveDraftToStorage(manuscript, currentStep);
    setHasSavedDraft(true);
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasSavedDraft(false);
  };

  const resetProject = () => {
    setManuscript(defaultManuscript);
    setCurrentStep(0);
    clearDraft();
  };

  const publishBook = (book: PublishedBook) => {
    setPublishedBooks(prev => [book, ...prev]);
  };

  return (
    <ProjectContext.Provider value={{ manuscript, updateManuscript, currentStep, setStep, resetProject, publishedBooks, publishBook, saveDraft, hasSavedDraft, clearDraft }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
