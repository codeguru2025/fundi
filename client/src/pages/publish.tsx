import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Publish() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3" data-testid="text-publish-title">
            What would you like to publish?
          </h1>
          <p className="text-muted-foreground text-lg mb-12">
            Choose what you'd like to create and share with the world.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <motion.button
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLocation("/editor")}
              className="group bg-card border border-border rounded-xl p-8 text-left hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer"
              data-testid="button-choose-book"
            >
              <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-bold text-foreground mb-2">Publish a Book</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Upload your manuscript (PDF, DOCX, EPUB, or TXT), add a cover, set your price, and start selling.
              </p>
              <span className="inline-flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                Get started <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </motion.button>

            <motion.button
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLocation("/create-course")}
              className="group bg-card border border-border rounded-xl p-8 text-left hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer"
              data-testid="button-choose-course"
            >
              <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-bold text-foreground mb-2">Create a Course</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Build structured courses with video, text, and image lessons, quizzes, labs, and certificates.
              </p>
              <span className="inline-flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                Get started <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
