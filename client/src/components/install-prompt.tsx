import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
    
    const standalone = window.matchMedia("(display-mode: standalone)").matches || 
                       (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    
    if (standalone) return;
    
    const dismissed = localStorage.getItem("fundi_install_dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    if (isIOSDevice && !standalone) {
      const handleInteraction = () => {
        setTimeout(() => setShowPrompt(true), 2000);
        window.removeEventListener("scroll", handleInteraction);
        window.removeEventListener("click", handleInteraction);
      };
      window.addEventListener("scroll", handleInteraction, { once: true });
      window.addEventListener("click", handleInteraction, { once: true });
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("fundi_install_dismissed", Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
        data-testid="install-prompt"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10" />
          
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="button-dismiss-install"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
          
          <div className="relative flex items-start gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-8 h-8 text-white"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
            
            <div className="flex-1 pr-6">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Install Fundi
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {isIOS 
                  ? "Add to home screen for the best reading experience"
                  : "Install for quick access and offline reading"
                }
              </p>
              
              {isIOS ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <span>Tap</span>
                  <Share className="w-4 h-4" />
                  <span>then</span>
                  <span className="flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add to Home Screen
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="mt-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  data-testid="button-install-app"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install App
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
