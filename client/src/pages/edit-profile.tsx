import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { csrfHeaders } from "@/lib/csrf";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

export default function EditProfile() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bio: "",
    headline: "",
    experience: "",
    specialization: "",
    website: "",
    twitter: "",
    linkedin: "",
    facebook: "",
    instagram: "",
    youtube: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user) {
      const social = (user as any).socialLinks as Record<string, string> | null;
      setForm({
        bio: (user as any).bio || "",
        headline: (user as any).headline || "",
        experience: (user as any).experience || "",
        specialization: (user as any).specialization || "",
        website: (user as any).website || "",
        twitter: social?.twitter || "",
        linkedin: social?.linkedin || "",
        facebook: social?.facebook || "",
        instagram: social?.instagram || "",
        youtube: social?.youtube || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        bio: form.bio || undefined,
        headline: form.headline || undefined,
        experience: form.experience || undefined,
        specialization: form.specialization || undefined,
        website: form.website || undefined,
        socialLinks: {
          twitter: form.twitter || undefined,
          linkedin: form.linkedin || undefined,
          facebook: form.facebook || undefined,
          instagram: form.instagram || undefined,
          youtube: form.youtube || undefined,
        },
      };

      const res = await fetch("/api/profiles/me", {
        method: "PUT",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      toast({ title: "Profile updated", description: "Your profile has been saved." });
      navigate(`/profile/${user!.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href={user ? `/profile/${user.id}` : "/"} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
        </Link>

        <h1 className="text-3xl font-serif font-bold text-primary mb-2">Edit Profile</h1>
        <p className="text-muted-foreground mb-8">Help buyers and students know more about you.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="e.g. Senior Software Engineer & Educator"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground mt-1">A short line that describes who you are.</p>
          </div>

          <div>
            <Label htmlFor="specialization">Specialization</Label>
            <Input
              id="specialization"
              placeholder="e.g. Web Development, Data Science, Creative Writing"
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell people about yourself, your background, what drives you..."
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="min-h-[120px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">{form.bio.length}/2000</p>
          </div>

          <div>
            <Label htmlFor="experience">Experience</Label>
            <Textarea
              id="experience"
              placeholder="Your professional experience, achievements, qualifications..."
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              className="min-h-[120px]"
              maxLength={3000}
            />
            <p className="text-xs text-muted-foreground mt-1">{form.experience.length}/3000</p>
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourwebsite.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <Label>Social Links</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                placeholder="Twitter URL"
                value={form.twitter}
                onChange={(e) => setForm({ ...form, twitter: e.target.value })}
              />
              <Input
                placeholder="LinkedIn URL"
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              />
              <Input
                placeholder="Facebook URL"
                value={form.facebook}
                onChange={(e) => setForm({ ...form, facebook: e.target.value })}
              />
              <Input
                placeholder="Instagram URL"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              />
              <Input
                placeholder="YouTube URL"
                value={form.youtube}
                onChange={(e) => setForm({ ...form, youtube: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving} className="min-w-[120px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(user ? `/profile/${user.id}` : "/")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
