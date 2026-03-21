import { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Star, ShoppingCart, Lock, BookOpen, Eye, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fetchBooks } from "@/lib/api";
import { PaymentDialog } from "@/components/payment-dialog";
import { useAuth } from "@/hooks/use-auth";

function getBuyerToken(): string {
  const key = "fundi_buyer_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = `buyer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

async function checkAccessFromServer(bookId: string): Promise<{ isAuthor: boolean; isPurchased: boolean; hasAccess: boolean }> {
  try {
    const buyerToken = getBuyerToken();
    const response = await fetch(`/api/books/${bookId}/access?buyerToken=${encodeURIComponent(buyerToken)}`, {
      credentials: "include",
    });
    const data = await response.json();
    return data;
  } catch {
    return { isAuthor: false, isPurchased: false, hasAccess: false };
  }
}

export default function Product() {
  const [match, params] = useRoute("/book/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const id = params?.id || "1";
  const [isPurchased, setIsPurchased] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [hasServerAccess, setHasServerAccess] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  useEffect(() => {
    async function checkAccess() {
      setCheckingPurchase(true);
      const access = await checkAccessFromServer(id);
      setIsPurchased(access.isPurchased);
      setIsAuthor(access.isAuthor);
      setHasServerAccess(access.hasAccess);
      setCheckingPurchase(false);
    }
    checkAccess();
  }, [id, user?.id]);
  
  const handlePaymentSuccess = async () => {
    setIsPurchased(true);
    setShowPaymentDialog(false);
    const access = await checkAccessFromServer(id);
    setIsPurchased(access.isPurchased || true);
    setIsAuthor(access.isAuthor);
    setHasServerAccess(access.hasAccess);
    queryClient.invalidateQueries({ queryKey: ["books"] });
  };
  
  const { data: allBooks = [], isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
  });
  
  const book = allBooks.find((b: any) => b.id === id);
  
  const hasAccess = isPurchased || isAuthor || hasServerAccess;

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-serif font-bold mb-2">Book Not Found</h1>
          <p className="text-muted-foreground mb-6">This book doesn't exist or has been removed.</p>
          <Button asChild>
            <Link href="/store">Browse Store</Link>
          </Button>
        </div>
      </Layout>
    );
  }
  
  const displayBook = {
    ...book,
    id: book.id,
    reviews: 0,
    pages: 150,
    language: "English",
    published: new Date(book.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    rating: book.rating ?? 0,
    price: book.price ?? 9.99,
    author: book.author || "Unknown",
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link href="/store" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Store
        </Link>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-center md:justify-end"
          >
            <div className="relative w-full max-w-md aspect-[2/3] rounded-lg shadow-2xl book-shadow overflow-hidden">
              <img 
                src={displayBook.cover || "https://images.unsplash.com/photo-1621944190610-a9607d46610c?q=80&w=2670&auto=format&fit=crop"} 
                alt={displayBook.title} 
                className="object-cover w-full h-full" 
              />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase tracking-wider">Ebook</Badge>
              {hasAccess && (
                <Badge className="text-xs uppercase tracking-wider bg-green-100 text-green-800 border-green-200">
                  {isAuthor ? "Your Book" : "Purchased"}
                </Badge>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">{displayBook.title}</h1>
            <p className="text-xl text-muted-foreground mb-6 font-serif italic">by {displayBook.author}</p>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center text-yellow-500">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-5 h-5 ${i <= Math.round(displayBook.rating) ? 'fill-current' : 'text-gray-300'}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{displayBook.rating} ({displayBook.reviews} reviews)</span>
            </div>

            <p className="text-lg leading-relaxed text-foreground/80 mb-8 border-l-4 border-primary/20 pl-4">
              {displayBook.description || "A captivating read."}
            </p>

            <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {isPurchased ? "You own this book" : "Total Price"}
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {isPurchased ? "Purchased" : `$${displayBook.price.toFixed(2)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Format: EPUB, MOBI</p>
                  <p className="text-xs text-muted-foreground">DRM-Free</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {hasAccess ? (
                  <Button 
                    size="lg" 
                    className="w-full text-lg h-14" 
                    onClick={() => setLocation(`/read/${id}`)}
                    data-testid="button-read-now"
                  >
                    <BookOpen className="w-5 h-5 mr-2" /> Read Now
                  </Button>
                ) : isAuthenticated ? (
                  <>
                    <Button 
                      size="lg" 
                      className="w-full text-lg h-14" 
                      onClick={() => setShowPaymentDialog(true)}
                      data-testid="button-buy-now"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" /> Buy Now - ${displayBook.price.toFixed(2)}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="w-full text-lg h-14" 
                      onClick={() => setLocation(`/read/${id}`)}
                      data-testid="button-preview"
                    >
                      <Eye className="w-5 h-5 mr-2" /> Read Sample
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      className="w-full text-lg h-14" 
                      asChild
                      data-testid="button-signin-to-buy"
                    >
                      <a href="/api/login">
                        <LogIn className="w-5 h-5 mr-2" /> Sign In to Purchase - ${displayBook.price.toFixed(2)}
                      </a>
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="w-full text-lg h-14" 
                      onClick={() => setLocation(`/read/${id}`)}
                      data-testid="button-preview"
                    >
                      <Eye className="w-5 h-5 mr-2" /> Read Sample
                    </Button>
                  </>
                )}
                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Secure payment via Paynow
                </p>
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Details</TabsTrigger>
                <TabsTrigger value="author" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Author</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="pt-4">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Length</dt>
                    <dd className="font-medium">{displayBook.pages} pages</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Language</dt>
                    <dd className="font-medium">{displayBook.language}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Published</dt>
                    <dd className="font-medium">{displayBook.published}</dd>
                  </div>
                </dl>
              </TabsContent>
              <TabsContent value="author" className="pt-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{displayBook.author[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{displayBook.author}</p>
                    <p className="text-xs text-muted-foreground">Verified Author</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>

      <PaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        book={{
          id: displayBook.id,
          title: displayBook.title,
          price: displayBook.price,
        }}
        onPaymentSuccess={handlePaymentSuccess}
        userId={user?.id}
      />
    </Layout>
  );
}
