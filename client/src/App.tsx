import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "./lib/project-context";
import { SplashScreen } from "@/components/splash-screen";
import { InstallPrompt } from "@/components/install-prompt";
import { ErrorBoundary } from "@/components/error-boundary";
import Home from "@/pages/home";
import Editor from "@/pages/editor";
import Store from "@/pages/store";
import Product from "@/pages/product";
import Admin from "@/pages/admin";
import Reader from "@/pages/reader";
import NotFound from "@/pages/not-found";
import Publish from "@/pages/publish";
import CreateCourse from "@/pages/create-course";
import CourseStore from "@/pages/course-store";
import CourseDetail from "@/pages/course-detail";
import CoursePlayer from "@/pages/course-player";
import VerifyCertificate from "@/pages/verify-certificate";
import Dashboard from "@/pages/dashboard";
import { usePageTracking } from "@/hooks/use-analytics";

function Router() {
  usePageTracking();
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/publish" component={Publish} />
      <Route path="/editor" component={Editor} />
      <Route path="/store" component={Store} />
      <Route path="/book/:id" component={Product} />
      <Route path="/read/:id" component={Reader} />
      <Route path="/admin" component={Admin} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/courses" component={CourseStore} />
      <Route path="/verify/:token" component={VerifyCertificate} />
      <Route path="/course/:id/learn" component={CoursePlayer} />
      <Route path="/course/:id" component={CourseDetail} />
      <Route path="/edit-course/:id" component={CreateCourse} />
      <Route path="/create-course" component={CreateCourse} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const lastSplash = sessionStorage.getItem("fundi_splash_shown");
    return !lastSplash;
  });

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem("fundi_splash_shown", "true");
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ProjectProvider>
          <TooltipProvider>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <Toaster />
            <Router />
            <InstallPrompt />
          </TooltipProvider>
        </ProjectProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
