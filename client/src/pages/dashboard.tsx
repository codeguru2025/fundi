import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  LogIn, BookOpen, GraduationCap, DollarSign, Eye, TrendingUp,
  BarChart3, ShoppingCart, Calendar, ExternalLink, Plus, Pen, Award, Pencil
} from "lucide-react";

interface DashboardBook {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  price: number;
  category: string;
  isActive: boolean;
  isApproved: boolean;
  adminComment: string | null;
  subscriptionActive: boolean;
  createdAt: string;
  views: number;
  salesCount: number;
  revenue: number;
}

interface DashboardCourse {
  id: string;
  title: string;
  cover: string | null;
  price: number;
  category: string;
  isActive: boolean;
  isApproved: boolean;
  adminComment: string | null;
  totalLessons: number;
  certificateFee: number;
  instructorName: string;
  createdAt: string;
  views: number;
  salesCount: number;
}

interface DashboardStats {
  totalBooks: number;
  totalCourses: number;
  totalSales: number;
  totalBookSales: number;
  totalCourseSales: number;
  totalBookRevenue: number;
  totalCommissionPaid: number;
  totalViews: number;
}

interface Settlement {
  id: string;
  amount: number;
  status: string;
  scheduledFor: string;
  paidAt: string | null;
}

interface RecentSale {
  id: string;
  bookId: string;
  amount: number;
  sellerEarnings: number;
  commission: number;
  createdAt: string;
  bookTitle: string;
}

interface DashboardData {
  books: DashboardBook[];
  courses: DashboardCourse[];
  stats: DashboardStats;
  viewsOverTime: { date: string; count: number }[];
  settlements: Settlement[];
  recentSales: RecentSale[];
}

function StatCard({ title, value, icon: Icon, subtitle, color }: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground" data-testid={`text-stat-label-${title.toLowerCase().replace(/\s/g, '-')}`}>{title}</p>
            <p className="text-3xl font-bold mt-1" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data, maxBars = 14 }: { data: { date: string; count: number }[]; maxBars?: number }) {
  const recent = data.slice(-maxBars);
  const max = Math.max(...recent.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-40" data-testid="chart-views-over-time">
      {recent.map((d, i) => {
        const height = (d.count / max) * 100;
        const dayLabel = new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{d.count}</span>
            <div
              className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary"
              style={{ height: `${Math.max(height, 4)}%` }}
              title={`${dayLabel}: ${d.count} views`}
            />
            <span className="text-[9px] text-muted-foreground rotate-[-45deg] origin-top-left whitespace-nowrap">
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: dashboard, isLoading: dashLoading, error: dashError } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard", { credentials: "include" });
      if (!r.ok) {
        const errText = await r.text().catch(() => "Unknown error");
        throw new Error(`Dashboard API error ${r.status}: ${errText}`);
      }
      return r.json();
    },
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  if (authLoading) {
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
              <BarChart3 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-4">Publisher Dashboard</h1>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Sign in to view your publications, track sales, and see how your content is performing.
            </p>
            <Button asChild size="lg" className="text-lg px-8" data-testid="button-signin-dashboard">
              <a href="/api/login">
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </a>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (dashLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  if (dashError && !dashboard) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-destructive mb-4">Failed to load dashboard data. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()} data-testid="button-retry-dashboard">
            Refresh Page
          </Button>
        </div>
      </Layout>
    );
  }

  const stats = dashboard?.stats;
  const books = dashboard?.books || [];
  const courses = dashboard?.courses || [];
  const settlements = dashboard?.settlements || [];
  const recentSales = dashboard?.recentSales || [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-serif font-bold text-primary" data-testid="text-dashboard-title">
                Publisher Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Track your content performance and earnings</p>
            </div>
            <Link href="/publish">
              <Button data-testid="button-create-new">
                <Plus className="w-4 h-4 mr-2" /> Create New
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Publications"
              value={(stats?.totalBooks || 0) + (stats?.totalCourses || 0)}
              icon={BookOpen}
              subtitle={`${stats?.totalBooks || 0} books, ${stats?.totalCourses || 0} courses`}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              title="Total Sales"
              value={stats?.totalSales || 0}
              icon={ShoppingCart}
              subtitle={`${stats?.totalBookSales || 0} books, ${stats?.totalCourseSales || 0} courses`}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              title="Revenue Earned"
              value={`$${(stats?.totalBookRevenue || 0).toFixed(2)}`}
              icon={DollarSign}
              subtitle={`$${(stats?.totalCommissionPaid || 0).toFixed(2)} commission paid`}
              color="bg-amber-100 text-amber-600"
            />
            <StatCard
              title="Content Views"
              value={stats?.totalViews || 0}
              icon={Eye}
              subtitle="Last 30 days"
              color="bg-purple-100 text-purple-600"
            />
          </div>

          {dashboard?.viewsOverTime && dashboard.viewsOverTime.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Your Content Views (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={dashboard.viewsOverTime} />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  My Books ({books.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {books.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No books published yet</p>
                    <Link href="/publish">
                      <Button variant="outline" className="mt-3" data-testid="button-publish-first-book">
                        <Pen className="w-4 h-4 mr-2" /> Publish Your First Book
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {books.map(book => (
                      <div key={book.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors" data-testid={`card-book-${book.id}`}>
                        <div className="w-10 h-14 rounded overflow-hidden shrink-0 bg-zinc-200">
                          {book.cover ? (
                            <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-[8px]">No cover</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.category} &middot; ${book.price}</p>
                          {book.adminComment && !book.isApproved && (
                            <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">Admin: {book.adminComment}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{book.salesCount} sales</p>
                          <p className="text-xs text-muted-foreground">{book.views} views</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${book.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {book.isApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-green-600">${book.revenue.toFixed(2)}</p>
                        </div>
                        <Link href={`/book/${book.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-book-${book.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  My Courses ({courses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No courses created yet</p>
                    <Link href="/publish">
                      <Button variant="outline" className="mt-3" data-testid="button-create-first-course">
                        <Plus className="w-4 h-4 mr-2" /> Create Your First Course
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {courses.map(course => (
                      <div key={course.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors" data-testid={`card-course-${course.id}`}>
                        <div className="w-14 h-10 rounded overflow-hidden shrink-0 bg-zinc-200">
                          {course.cover ? (
                            <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-[8px]">No cover</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{course.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{course.category}</span>
                            <span>&middot;</span>
                            <span>${course.price}</span>
                            <span>&middot;</span>
                            <span>{course.totalLessons} lessons</span>
                          </div>
                          {course.adminComment && !course.isApproved && (
                            <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">Admin: {course.adminComment}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{course.salesCount} sales</p>
                          <p className="text-xs text-muted-foreground">{course.views} views</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${course.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {course.isApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <Link href={`/edit-course/${course.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-course-${course.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/course/${course.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-course-${course.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {courses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-serif font-bold text-primary mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Sample Certificates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map(course => (
                  <div key={`cert-${course.id}`} className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm" data-testid={`sample-cert-${course.id}`}>
                    <div className="absolute inset-2 border border-amber-300/60 rounded-lg pointer-events-none" />
                    <div className="relative p-6 text-center">
                      <div className="flex justify-center mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <p className="text-[9px] font-medium tracking-[0.25em] uppercase text-amber-600 mb-0.5">Fundi</p>
                      <p className="text-[8px] font-medium tracking-[0.15em] uppercase text-amber-500 mb-3">Certificate of Completion</p>
                      <p className="text-[10px] text-gray-500">This certifies that</p>
                      <p className="text-lg font-serif font-bold text-gray-800 border-b border-amber-300 inline-block pb-1 mb-1">[Student Name]</p>
                      <p className="text-[10px] text-gray-500 mt-2">has successfully completed</p>
                      <p className="text-sm font-serif font-semibold text-primary mb-0.5">{course.title}</p>
                      <p className="text-[10px] text-gray-400">Instructor: {course.instructorName}</p>
                      <div className="flex justify-between items-end px-2 pt-3 mt-3 border-t border-amber-200 text-[9px] text-gray-400">
                        <span>Date: [Completion Date]</span>
                        <span>ID: [Verification Token]</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-amber-100">
                        <span className="text-[10px] font-medium text-amber-700">Certificate Fee: ${course.certificateFee?.toFixed(2) || '100.00'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Recent Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentSales.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No sales yet</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {recentSales.map(sale => (
                      <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`row-sale-${sale.id}`}>
                        <div>
                          <p className="font-medium text-sm">{sale.bookTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">+${sale.sellerEarnings.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">${sale.commission.toFixed(2)} commission</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Settlements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No settlements yet</p>
                    <p className="text-xs mt-2">Settlements are generated weekly when you reach $50 minimum</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {settlements.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`row-settlement-${s.id}`}>
                        <div>
                          <p className="font-medium text-sm">${s.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Scheduled: {new Date(s.scheduledFor).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          s.status === 'paid' ? 'bg-green-100 text-green-700' :
                          s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </motion.div>
      </div>
    </Layout>
  );
}
