import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, GraduationCap, Loader2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { fetchCourses } from "@/lib/api";

const categories = [
  "All", "Business", "Entrepreneurship", "Technology", "Marketing", "Finance",
  "Personal Development", "Leadership", "Education", "Design",
  "Health & Wellness", "Science", "Law", "Engineering", "Agriculture",
  "Real Estate", "Cryptocurrency", "Sales", "Communication", "Other"
];

export default function CourseStore() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data: allCourses = [], isLoading, isError } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses,
  });

  const filteredCourses = allCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          course.instructorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]" data-testid="loading-courses">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center" data-testid="error-courses">
          <p className="text-gray-600">Unable to load courses. Please try again later.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-2" data-testid="text-page-title">Course Marketplace</h1>
            <p className="text-muted-foreground">Expand your skills with expert-led courses.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses or instructors..."
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide" data-testid="category-filters">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full px-6"
              data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-center py-16" data-testid="empty-state">
            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-serif font-bold text-primary mb-2">No Courses Yet</h2>
            <p className="text-muted-foreground mb-6">Courses will be available soon. Check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="courses-grid">
            {filteredCourses.map((course, index) => (
              <Link key={course.id} href={`/course/${course.id}`} data-testid={`link-course-${course.id}`}>
                <motion.div
                  className="group cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  data-testid={`card-course-${course.id}`}
                >
                  <div className="relative aspect-video mb-4 rounded-md overflow-hidden shadow-sm transition-all group-hover:shadow-xl group-hover:shadow-primary/10">
                    {course.cover ? (
                      <img
                        src={course.cover}
                        alt={course.title}
                        className="object-contain w-full h-full bg-gray-50 transition-transform duration-500 group-hover:scale-105"
                        data-testid={`img-course-${course.id}`}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                        <GraduationCap className="w-12 h-12 text-primary/40" />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3 backdrop-blur-sm" data-testid={`badge-category-${course.id}`}>
                      {course.category}
                    </Badge>
                    {(course as any).level && (
                      <Badge variant="secondary" className="absolute top-3 right-3 backdrop-blur-sm bg-amber-100 text-amber-800 border-amber-300" data-testid={`badge-level-${course.id}`}>
                        {(course as any).level}
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-serif font-bold text-lg leading-tight group-hover:text-primary transition-colors" data-testid={`text-title-${course.id}`}>
                      {course.title}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`text-instructor-${course.id}`}>{course.instructorName}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-medium text-lg" data-testid={`text-price-${course.id}`}>${course.price?.toFixed(2) || "0.00"}</span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-lessons-${course.id}`}>
                        <BookOpen className="w-4 h-4" />
                        {course.totalLessons} {course.totalLessons === 1 ? "lesson" : "lessons"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
