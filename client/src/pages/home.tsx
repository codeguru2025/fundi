import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookType, GraduationCap, DollarSign, Star, Phone, MessageCircle, ChevronRight, Sparkles, ShieldCheck, Clock, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

const FEATURED_DEFAULTS = [
  {
    title: "Reflections of a Relentless Hustler",
    description: "A powerful journey through the mindset, struggles, and triumphs of an unstoppable entrepreneur. This book will challenge you to push past every limit and build the life you deserve.",
    cover: "/images/book-relentless-hustler.png",
    price: null as number | null,
    id: null as string | null,
  },
  {
    title: "Making Money While Sleeping",
    description: "Discover the strategies, systems, and secrets behind building passive income streams that work around the clock. Learn how to make your money work for you even while you rest.",
    cover: "/images/book-making-money.png",
    price: null as number | null,
    id: null as string | null,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.12 } },
};

export default function Home() {
  const { data: featuredBooksFromDB } = useQuery({
    queryKey: ["featured-books"],
    queryFn: async () => {
      const res = await fetch("/api/books/featured");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const featuredBooks = FEATURED_DEFAULTS.map((defaultBook) => {
    const dbBook = (featuredBooksFromDB || []).find((b: any) =>
      b.title.toLowerCase().trim() === defaultBook.title.toLowerCase().trim()
    );
    if (dbBook) {
      return {
        title: dbBook.title,
        description: dbBook.description || defaultBook.description,
        cover: dbBook.cover || defaultBook.cover,
        price: dbBook.price,
        id: dbBook.id,
      };
    }
    return defaultBook;
  });

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/images/hero-business.jpg"
            alt="Business professional"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        </div>
        <div className="relative z-10 py-24 md:py-36 lg:py-44 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium mb-8 border border-white/10" data-testid="badge-platform">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Your Knowledge. Your Income. Your Legacy.
              </div>
              <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                Make Money <br />
                <span className="italic font-normal text-amber-300">While You Sleep</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl leading-relaxed">
                Publish ebooks and create courses that generate passive income 24/7.
                Join a platform built for ambitious creators and relentless hustlers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/publish">
                  <span className="inline-block">
                    <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-lg hover:shadow-xl transition-all bg-amber-500 hover:bg-amber-600 text-black font-semibold" data-testid="button-publish">
                      Start Publishing <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </span>
                </Link>
                <Link href="/store">
                  <span className="inline-block">
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-white/30 text-white hover:bg-white/10 hover:text-white" data-testid="button-browse-marketplace">
                      Browse Marketplace
                    </Button>
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 bg-gradient-to-b from-stone-50 to-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4">Must Read</span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary mb-3">Featured Books</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">Handpicked reads that will change the way you think about wealth</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
            {featuredBooks.map((book, idx) => (
              <FeaturedBookCard
                key={book.title}
                title={book.title}
                description={book.description}
                coverImage={book.cover}
                price={book.price}
                bookId={book.id}
                delay={idx * 0.15}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-center mt-10"
          >
            <Link href="/store">
              <span className="inline-block">
                <Button variant="ghost" className="text-primary font-medium group" data-testid="button-view-all-books">
                  View All Books <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            <motion.div variants={fadeUp} className="text-center mb-14">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">Why Choose Us</span>
              <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary mb-3">Everything You Need</h2>
              <p className="text-muted-foreground text-lg max-w-lg mx-auto">A complete platform to monetize your knowledge and expertise</p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div variants={fadeUp}>
                <FeatureCard icon={<BookType className="h-6 w-6" />} title="Sell Ebooks" desc="Upload manuscripts in DOCX, PDF, TXT or EPUB. Set your price and start earning instantly." />
              </motion.div>
              <motion.div variants={fadeUp}>
                <FeatureCard icon={<GraduationCap className="h-6 w-6" />} title="Create Courses" desc="Build rich courses with video lessons, quizzes, labs, and certificates of completion." />
              </motion.div>
              <motion.div variants={fadeUp}>
                <FeatureCard icon={<DollarSign className="h-6 w-6" />} title="Passive Income" desc="Your content sells 24/7. Weekly payouts with just 25% commission. First book free." />
              </motion.div>
              <motion.div variants={fadeUp}>
                <FeatureCard icon={<ShieldCheck className="h-6 w-6" />} title="Secure Payments" desc="Integrated Paynow with Ecocash, OneMoney, and bank transfer support." />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 bg-stone-50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img src="/images/books-section.jpg" alt="Books and learning" className="w-full h-72 md:h-96 object-cover" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4">For Authors</span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">Publish Your Book Today</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Upload your manuscript, customize the cover, set your price, and publish to our marketplace. Your first book is completely free to publish. Reach readers across Zimbabwe and beyond.
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-green-100 text-green-600"><Award className="h-4 w-4" /></div>
                  <span className="text-foreground">First book published for free</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-green-100 text-green-600"><Clock className="h-4 w-4" /></div>
                  <span className="text-foreground">Weekly settlements with $50 minimum</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-green-100 text-green-600"><DollarSign className="h-4 w-4" /></div>
                  <span className="text-foreground">Keep 75% of every sale</span>
                </div>
              </div>
              <Link href="/editor">
                <span className="inline-block">
                  <Button size="lg" className="rounded-full" data-testid="button-publish-book">
                    Publish a Book <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">For Instructors</span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">Create Online Courses</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Build professional courses with video lessons, text content, quizzes, hands-on labs, and verifiable certificates. Share your expertise and earn while you teach.
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-blue-100 text-blue-600"><GraduationCap className="h-4 w-4" /></div>
                  <span className="text-foreground">Video, text, and image lessons</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-blue-100 text-blue-600"><Award className="h-4 w-4" /></div>
                  <span className="text-foreground">Quizzes, labs, and certificates</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-blue-100 text-blue-600"><DollarSign className="h-4 w-4" /></div>
                  <span className="text-foreground">Set your own pricing</span>
                </div>
              </div>
              <Link href="/create-course">
                <span className="inline-block">
                  <Button size="lg" className="rounded-full" data-testid="button-create-course">
                    Create a Course <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </span>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2"
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img src="/images/courses-section.jpg" alt="Online learning" className="w-full h-72 md:h-96 object-cover" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-stone-50">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-3xl p-8 md:p-14 text-center text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Explore the Marketplace</h2>
                <p className="text-white/80 mb-8 text-lg max-w-xl mx-auto">
                  Discover books and courses from creators building real wealth. Find your next great read or master a new skill.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/store">
                    <Button size="lg" variant="secondary" className="h-13 px-8 text-base rounded-full shadow-lg" data-testid="button-browse-books">
                      <BookType className="mr-2 h-5 w-5" /> Browse Books
                    </Button>
                  </Link>
                  <Link href="/courses">
                    <Button size="lg" variant="outline" className="h-13 px-8 text-base rounded-full border-white/30 text-white hover:bg-white/10 hover:text-white shadow-lg" data-testid="button-browse-courses">
                      <GraduationCap className="mr-2 h-5 w-5" /> Browse Courses
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-wider mb-4">Contact</span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">Get In Touch</h2>
            <p className="text-muted-foreground text-lg">Have questions? We'd love to hear from you.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto"
          >
            <a
              href="tel:0773665350"
              className="flex items-center gap-4 p-6 rounded-2xl border border-border/50 bg-white hover:shadow-lg hover:border-primary/20 transition-all group"
              data-testid="link-call"
            >
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Call Us</p>
                <p className="text-lg font-semibold text-foreground">0773 665 350</p>
              </div>
            </a>

            <a
              href="https://wa.me/263712171267"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-6 rounded-2xl border border-border/50 bg-white hover:shadow-lg hover:border-green-300 transition-all group"
              data-testid="link-whatsapp"
            >
              <div className="p-3 rounded-xl bg-green-100 text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">WhatsApp</p>
                <p className="text-lg font-semibold text-foreground">0712 171 267</p>
              </div>
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-b from-white to-amber-50/30">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-8 md:p-12">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary mb-4">Ready to Start Earning?</h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Your first book is free to publish. No upfront costs. Start building your passive income today.
              </p>
              <Link href="/publish">
                <span className="inline-block">
                  <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-lg" data-testid="button-start-earning">
                    Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}

function FeaturedBookCard({ title, description, coverImage, price, bookId, delay }: { title: string; description: string; coverImage: string; price?: number | null; bookId?: string | null; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6 }}
    >
      <div className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-border/30">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-48 md:w-56 flex-shrink-0 bg-gradient-to-br from-stone-100 to-stone-200 p-6 flex items-center justify-center">
            <img
              src={coverImage}
              alt={title}
              className="w-36 sm:w-full h-auto max-h-64 object-contain rounded-lg shadow-xl group-hover:scale-105 transition-transform duration-300"
              data-testid={`img-featured-${title.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </div>
          <div className="p-6 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
                <span className="text-xs text-muted-foreground ml-1.5 font-medium">Featured</span>
              </div>
              <h3 className="font-serif text-xl md:text-2xl font-bold text-primary mb-3 leading-tight" data-testid={`text-featured-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                {title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                {description}
              </p>
              {price != null && (
                <p className="mt-2 text-lg font-bold text-primary" data-testid={`text-price-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                  ${price.toFixed(2)}
                </p>
              )}
            </div>
            <div className="mt-5">
              <Link href={bookId ? `/book/${bookId}` : "/store"}>
                <span className="inline-block">
                  <Button className="rounded-full group-hover:bg-primary/90 transition-all" data-testid={`button-read-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {bookId ? "View Book" : "Find in Store"} <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col p-6 rounded-2xl bg-stone-50 border border-border/30 hover:shadow-lg hover:border-primary/20 transition-all duration-300 h-full">
      <div className="mb-4 p-3 bg-primary/10 rounded-xl text-primary w-fit">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-bold mb-2 text-primary">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
