import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { logger } from "../index";

const updateProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  headline: z.string().max(200).optional(),
  experience: z.string().max(3000).optional(),
  specialization: z.string().max(500).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
  socialLinks: z.object({
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
  }).optional(),
});

const createReviewSchema = z.object({
  targetUserId: z.string().min(1),
  targetType: z.enum(["instructor", "author"]),
  contentId: z.string().optional(),
  contentTitle: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

export function registerProfileRoutes(app: Express, _httpServer: Server): void {
  // Get public profile
  app.get("/api/profiles/:userId", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getPublicProfile(req.params.userId as string);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (error) {
      logger.error({ err: error }, "Error fetching profile");
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update own profile
  app.put("/api/profiles/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten().fieldErrors });
      }
      const updated = await storage.updateUser(userId, parsed.data);
      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, "Error updating profile");
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Get reviews for a user
  app.get("/api/profiles/:userId/reviews", async (req: Request, res: Response) => {
    try {
      const reviews = await storage.getReviewsByUser(req.params.userId as string);
      res.json(reviews);
    } catch (error) {
      logger.error({ err: error }, "Error fetching reviews");
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Get reviews for specific content (book or course)
  app.get("/api/reviews/content/:contentId", async (req: Request, res: Response) => {
    try {
      const reviews = await storage.getReviewsByContent(req.params.contentId as string);
      res.json(reviews);
    } catch (error) {
      logger.error({ err: error }, "Error fetching content reviews");
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Create a review (authenticated)
  app.post("/api/reviews", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const parsed = createReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid review data", details: parsed.error.flatten().fieldErrors });
      }

      // Can't review yourself
      if (parsed.data.targetUserId === userId) {
        return res.status(400).json({ error: "You cannot review yourself" });
      }

      const review = await storage.createReview({
        ...parsed.data,
        reviewerId: userId,
        reviewerName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Anonymous",
        reviewerImage: user.profileImageUrl || null,
      });

      res.status(201).json(review);
    } catch (error) {
      logger.error({ err: error }, "Error creating review");
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Delete own review
  app.delete("/api/reviews/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteReview(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Error deleting review");
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Admin: delete all courses and books
  app.delete("/api/admin/cleanup/all-content", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      logger.warn("Admin: Deleting ALL courses and books");
      await storage.deleteAllCourses();
      await storage.deleteAllBooks();
      res.json({ success: true, message: "All courses and books deleted" });
    } catch (error) {
      logger.error({ err: error }, "Error cleaning up content");
      res.status(500).json({ error: "Failed to delete content" });
    }
  });
}
