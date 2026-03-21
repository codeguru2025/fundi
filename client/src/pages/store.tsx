import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, ShoppingBag, Star, TrendingUp, Loader2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { fetchBooks } from "@/lib/api";

export default function Store() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const { data: allBooks = [], isLoading, isError } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
  });

  const categories = [
    "All", "Fiction", "Non-Fiction", "Business", "Self-Help", "Biography",
    "Romance", "Sci-Fi", "Fantasy", "Mystery", "Thriller", "History",
    "Finance", "Health", "Technology", "Poetry", "Religion", "Design",
    "Lifestyle", "Other"
  ];

  const filteredBooks = allBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center" data-testid="error-store">
          <p className="text-gray-600">Unable to load books. Please try again later.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-2">Marketplace</h1>
            <p className="text-muted-foreground">Discover the next generation of independent literature.</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search titles or authors..." 
                className="pl-9 bg-background" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide">
          {categories.map(cat => (
            <Button 
              key={cat} 
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full px-6"
            >
              {cat}
            </Button>
          ))}
        </div>

        {filteredBooks.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-serif font-bold text-primary mb-2">No Books Yet</h2>
            <p className="text-muted-foreground mb-6">Be the first to publish your masterpiece on Lumina.</p>
            <Button asChild>
              <Link href="/editor">Publish Your Book</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredBooks.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <motion.div 
                  className="group cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <div className="relative aspect-[2/3] mb-4 rounded-md overflow-hidden shadow-sm transition-all group-hover:shadow-xl group-hover:shadow-primary/10">
                    <img 
                      src={book.cover || "https://images.unsplash.com/photo-1621944190610-a9607d46610c?q=80&w=2670&auto=format&fit=crop"} 
                      alt={book.title} 
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    />
                    {book.bestseller && (
                      <Badge className="absolute top-3 left-3 bg-yellow-500/90 hover:bg-yellow-500 text-white border-0 backdrop-blur-sm">
                        <TrendingUp className="w-3 h-3 mr-1" /> Bestseller
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-serif font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                        {book.title}
                      </h3>
                      <div className="flex items-center text-yellow-500 text-xs font-bold">
                        <Star className="w-3 h-3 fill-current mr-0.5" />
                        {book.rating || 0}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-medium text-lg">${book.price?.toFixed(2) || "0.00"}</span>
                      <Button size="sm" variant="secondary" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <ShoppingBag className="w-4 h-4 mr-2" /> Buy
                      </Button>
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
