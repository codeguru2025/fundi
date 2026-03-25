import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";
import { logger } from "../index";

const createLabSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  resources: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

const submitLabSchema = z.object({
  courseId: z.string().min(1),
  submissionText: z.string().optional(),
});

export function registerLabRoutes(app: Express, _httpServer: Server): void {
  // Get labs for a course
  app.get("/api/courses/:courseId/labs", async (req: Request, res: Response) => {
    try { res.json(await storage.getLabsByCourse(String(req.params.courseId))); }
    catch (error) { logger.error({ err: error }, "Error fetching labs"); res.status(500).json({ error: "Failed to fetch labs" }); }
  });

  // Create lab (admin only)
  app.post("/api/courses/:courseId/labs", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createLabSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid lab data", details: parsed.error.flatten().fieldErrors });
      res.json(await storage.createLab({ ...parsed.data, courseId: String(req.params.courseId) }));
    }
    catch (error) { logger.error({ err: error }, "Error creating lab"); res.status(500).json({ error: "Failed to create lab" }); }
  });

  // Delete lab (admin only)
  app.delete("/api/labs/:labId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteLab(String(req.params.labId)); res.json({ success: true }); }
    catch (error) { logger.error({ err: error }, "Error deleting lab"); res.status(500).json({ error: "Failed to delete lab" }); }
  });

  // Submit lab completion
  app.post("/api/labs/:labId/submit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const parsed = submitLabSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid submission data", details: parsed.error.flatten().fieldErrors });
      const { courseId, submissionText } = parsed.data;
      res.json(await storage.createLabSubmission(String(req.params.labId), userId, courseId, submissionText));
    } catch (error) { logger.error({ err: error }, "Error submitting lab"); res.status(500).json({ error: "Failed to submit lab" }); }
  });

  // Get lab submission
  app.get("/api/labs/:labId/submission", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      res.json(await storage.getLabSubmission(String(req.params.labId), userId) || null);
    } catch (error) { logger.error({ err: error }, "Error fetching submission"); res.status(500).json({ error: "Failed to fetch submission" }); }
  });
}
