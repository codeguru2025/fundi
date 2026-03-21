import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";

export function registerLabRoutes(app: Express, _httpServer: Server): void {
  // Get labs for a course
  app.get("/api/courses/:courseId/labs", async (req: Request, res: Response) => {
    try { res.json(await storage.getLabsByCourse(String(req.params.courseId))); }
    catch (error) { console.error("Error fetching labs:", error); res.status(500).json({ error: "Failed to fetch labs" }); }
  });

  // Create lab (admin only)
  app.post("/api/courses/:courseId/labs", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { res.json(await storage.createLab({ ...req.body, courseId: String(req.params.courseId) })); }
    catch (error) { console.error("Error creating lab:", error); res.status(500).json({ error: "Failed to create lab" }); }
  });

  // Delete lab (admin only)
  app.delete("/api/labs/:labId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteLab(String(req.params.labId)); res.json({ success: true }); }
    catch (error) { console.error("Error deleting lab:", error); res.status(500).json({ error: "Failed to delete lab" }); }
  });

  // Submit lab completion
  app.post("/api/labs/:labId/submit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const { courseId, submissionText } = req.body;
      res.json(await storage.createLabSubmission(String(req.params.labId), userId, courseId, submissionText));
    } catch (error) { console.error("Error submitting lab:", error); res.status(500).json({ error: "Failed to submit lab" }); }
  });

  // Get lab submission
  app.get("/api/labs/:labId/submission", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      res.json(await storage.getLabSubmission(String(req.params.labId), userId) || null);
    } catch (error) { console.error("Error fetching submission:", error); res.status(500).json({ error: "Failed to fetch submission" }); }
  });
}
