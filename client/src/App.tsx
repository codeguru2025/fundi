import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "./lib/project-context";
import { SplashScreen } from "@/components/splash-screen";
import { InstallPrompt } from "@/components/install-prompt";
import { ErrorBoundary } from "@/components/error-boundary";
import { usePageTracking } from "@/hooks/use-analytics";

// Code-split: each page is loaded on demand
const Home = lazy(() => import("@/pages/home"));
const Editor = lazy(() => import("@/pages/editor"));
const Store = lazy(() => import("@/pages/store"));
const Product = lazy(() => import("@/pages/product"));
const Admin = lazy(() => import("@/pages/admin"));
const Reader = lazy(() => import("@/pages/reader"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Publish = lazy(() => import("@/pages/publish"));
const CreateCourse = lazy(() => import("@/pages/create-course"));
const CourseStore = lazy(() => import("@/pages/course-store"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const CoursePlayer = lazy(() => import("@/pages/course-player"));
const VerifyCertificate = lazy(() => import("@/pages/verify-certificate"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const PublicProfile = lazy(() => import("@/pages/public-profile"));
const EditProfile = lazy(() => import("@/pages/edit-profile"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
}

function Router() {
  usePageTracking();
  return (
    <Suspense fallback={<PageLoader />}>
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
      <Route path="/profile/:userId" component={PublicProfile} />
      <Route path="/edit-profile" component={EditProfile} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
