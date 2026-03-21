import { Link } from "wouter";
import { BookOpen, Settings, LogIn, LogOut, User, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col paper-texture bg-background text-foreground">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-md group-hover:bg-primary/90 transition-colors">
                <BookOpen size={20} />
              </div>
              <span className="font-serif font-bold text-xl tracking-tight text-primary">Lumina Wealth</span>
            </div>
          </Link>
          
          <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/store" className="hover:text-primary transition-colors">Books</Link>
            <Link href="/courses" className="hover:text-primary transition-colors">Courses</Link>
            <Link href="/publish" className="hover:text-primary transition-colors">Publish</Link>
            {isAuthenticated && (
              <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
                <BarChart3 size={14} /> Dashboard
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="hover:text-primary transition-colors flex items-center gap-1">
                <Settings size={14} /> Admin
              </Link>
            )}
            
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || <User size={14} />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:inline">{user?.firstName || user?.email?.split('@')[0]}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
                  <LogOut size={16} />
                </Button>
              </div>
            ) : (
              <Button asChild variant="default" size="sm" data-testid="button-login">
                <a href="/api/login">
                  <LogIn size={16} className="mr-2" />
                  Sign In
                </a>
              </Button>
            )}
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="font-medium">Created by Chibikhulu</span>
            <img src="/chibikhulu-logo.jpeg" alt="Chibikhulu" className="h-10 w-auto rounded" />
          </div>
          <p className="text-xs text-muted-foreground/70">© 2026 Lumina Wealth. Make money while you sleep.</p>
        </div>
      </footer>
    </div>
  );
}
