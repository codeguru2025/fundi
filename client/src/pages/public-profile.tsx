import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { csrfHeaders } from "@/lib/csrf";
import { useState } from "react";
import {
  Star, MapPin, Globe, BookOpen, GraduationCap, MessageSquare,
  Calendar, Briefcase, Award, ExternalLink, Loader2, User,
  Twitter, Linkedin, Facebook, Instagram, Youtube,
} from "lucide-react";

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-${size === 16 ? 4 : 3} h-${size === 16 ? 4 : 3} ${
            i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

function InteractiveStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              i <= (hover || value) ? "text-amber-400 fill-amber-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const socialIcons: Record<string, React.ReactNode> = {
  twitter: <Twitter className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
};

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${userId}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const submitReview = async () => {
    if (!reviewComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          targetUserId: userId,
          targetType: profile?.courses?.length > 0 ? "instructor" : "author",
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }
      toast({ title: "Review submitted", description: "Thank you for your feedback!" });
      setReviewComment("");
      setReviewRating(5);
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-serif font-bold mb-2">Profile Not Found</h1>
          <p className="text-muted-foreground">This user profile does not exist.</p>
        </div>
      </Layout>
    );
  }

  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "User";
  const socialLinks = (profile.socialLinks || {}) as Record<string, string>;
  const memberSince = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 mb-8 border border-border/30">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
              <AvatarImage src={profile.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {fullName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-serif font-bold text-primary">{fullName}</h1>
                  {profile.headline && (
                    <p className="text-lg text-muted-foreground mt-1">{profile.headline}</p>
                  )}
                </div>
                {isAuthenticated && currentUser?.id === userId && (
                  <Link href="/edit-profile">
                    <Button variant="outline" size="sm">Edit Profile</Button>
                  </Link>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                {profile.averageRating > 0 && (
                  <div className="flex items-center gap-1">
                    <StarRating rating={profile.averageRating} />
                    <span className="font-medium">{profile.averageRating.toFixed(1)}</span>
                    <span>({profile.reviews?.length || 0} reviews)</span>
                  </div>
                )}
                {profile.specialization && (
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    <span>{profile.specialization}</span>
                  </div>
                )}
                {memberSince && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Member since {memberSince}</span>
                  </div>
                )}
              </div>

              {/* Social links */}
              {Object.keys(socialLinks).filter(k => socialLinks[k]).length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-background hover:bg-primary/10 transition-colors border"
                      title={platform}
                    >
                      {socialIcons[platform] || <ExternalLink className="w-4 h-4" />}
                    </a>
                  ))}
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-background hover:bg-primary/10 transition-colors border"
                      title="Website"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column: Bio & Experience */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio */}
            {profile.bio && (
              <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
                <h2 className="text-xl font-serif font-bold text-primary mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" /> About
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{profile.bio}</p>
              </div>
            )}

            {/* Experience */}
            {profile.experience && (
              <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
                <h2 className="text-xl font-serif font-bold text-primary mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5" /> Experience
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{profile.experience}</p>
              </div>
            )}

            {/* Courses */}
            {profile.courses?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
                <h2 className="text-xl font-serif font-bold text-primary mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" /> Courses ({profile.courses.length})
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {profile.courses.map((course: any) => (
                    <Link key={course.id} href={`/course/${course.id}`}>
                      <div className="group border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer">
                        {course.cover && (
                          <div className="aspect-video bg-gradient-to-br from-stone-100 to-stone-200">
                            <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{course.title}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <Badge variant="secondary" className="text-xs">{course.level}</Badge>
                            <span className="font-medium text-sm">${course.price?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Books */}
            {profile.books?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
                <h2 className="text-xl font-serif font-bold text-primary mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Books ({profile.books.length})
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {profile.books.map((book: any) => (
                    <Link key={book.id} href={`/book/${book.id}`}>
                      <div className="group flex gap-3 border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer">
                        <div className="w-16 h-20 flex-shrink-0 bg-gradient-to-br from-stone-100 to-stone-200 rounded overflow-hidden">
                          {book.cover && <img src={book.cover} alt={book.title} className="w-full h-full object-contain" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{book.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{book.category}</p>
                          <span className="font-medium text-sm mt-1 block">${book.price?.toFixed(2)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
              <h2 className="text-xl font-serif font-bold text-primary mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Reviews ({profile.reviews?.length || 0})
              </h2>

              {/* Write review */}
              {isAuthenticated && currentUser?.id !== userId && (
                <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
                  <h3 className="font-medium mb-2">Write a Review</h3>
                  <InteractiveStarRating value={reviewRating} onChange={setReviewRating} />
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience..."
                    className="mt-2 min-h-[80px]"
                  />
                  <Button
                    onClick={submitReview}
                    disabled={submitting || !reviewComment.trim()}
                    className="mt-2"
                    size="sm"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit Review
                  </Button>
                </div>
              )}

              {profile.reviews?.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No reviews yet. Be the first to leave one!</p>
              ) : (
                <div className="space-y-4">
                  {profile.reviews?.map((review: any) => (
                    <div key={review.id} className="flex gap-3 p-4 bg-muted/20 rounded-lg">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={review.reviewerImage || undefined} />
                        <AvatarFallback className="text-xs">{review.reviewerName?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{review.reviewerName}</span>
                          <StarRating rating={review.rating} size={12} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {review.contentTitle && (
                          <p className="text-xs text-muted-foreground mt-0.5">Re: {review.contentTitle}</p>
                        )}
                        <p className="text-sm mt-1 text-muted-foreground">{review.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Stats sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-border/30 shadow-sm">
              <h3 className="font-serif font-bold text-primary mb-4">At a Glance</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Courses</span>
                  <span className="font-bold">{profile.courses?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="w-4 h-4" /> Books</span>
                  <span className="font-bold">{profile.books?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><Star className="w-4 h-4" /> Rating</span>
                  <span className="font-bold">{profile.averageRating > 0 ? profile.averageRating.toFixed(1) : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Reviews</span>
                  <span className="font-bold">{profile.reviews?.length || 0}</span>
                </div>
              </div>
            </div>

            {!profile.bio && !profile.experience && currentUser?.id === userId && (
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                <h3 className="font-semibold text-amber-800 mb-2">Complete Your Profile</h3>
                <p className="text-sm text-amber-700 mb-3">Add a bio, experience, and specialization so buyers know who you are.</p>
                <Link href="/edit-profile">
                  <Button size="sm" variant="outline">Edit Profile</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
