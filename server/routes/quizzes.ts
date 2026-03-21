import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth/googleAuth";

export function registerQuizRoutes(app: Express, _httpServer: Server): void {
  // Get quizzes for a module
  app.get("/api/courses/:courseId/modules/:moduleId/quizzes", async (req: Request, res: Response) => {
    try { res.json(await storage.getQuizzesByModule(String(req.params.moduleId))); }
    catch (error) { console.error("Error fetching quizzes:", error); res.status(500).json({ error: "Failed to fetch quizzes" }); }
  });

  // Get quizzes for a course
  app.get("/api/courses/:courseId/quizzes", async (req: Request, res: Response) => {
    try { res.json(await storage.getQuizzesByCourse(String(req.params.courseId))); }
    catch (error) { console.error("Error fetching quizzes:", error); res.status(500).json({ error: "Failed to fetch quizzes" }); }
  });

  // Create quiz (admin only)
  app.post("/api/courses/:courseId/quizzes", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { res.json(await storage.createQuiz({ ...req.body, courseId: String(req.params.courseId) })); }
    catch (error) { console.error("Error creating quiz:", error); res.status(500).json({ error: "Failed to create quiz" }); }
  });

  // Delete quiz (admin only)
  app.delete("/api/quizzes/:quizId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { await storage.deleteQuiz(String(req.params.quizId)); res.json({ success: true }); }
    catch (error) { console.error("Error deleting quiz:", error); res.status(500).json({ error: "Failed to delete quiz" }); }
  });

  // Get questions for a quiz
  app.get("/api/quizzes/:quizId/questions", async (req: Request, res: Response) => {
    try { res.json(await storage.getQuestionsByQuiz(String(req.params.quizId))); }
    catch (error) { console.error("Error fetching questions:", error); res.status(500).json({ error: "Failed to fetch questions" }); }
  });

  // Create quiz question (admin only)
  app.post("/api/quizzes/:quizId/questions", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try { res.json(await storage.createQuizQuestion({ ...req.body, quizId: String(req.params.quizId) })); }
    catch (error) { console.error("Error creating question:", error); res.status(500).json({ error: "Failed to create question" }); }
  });

  // Submit quiz attempt
  app.post("/api/quizzes/:quizId/attempt", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const { answers, courseId } = req.body;
      const quizId = String(req.params.quizId);
      const questions = await storage.getQuestionsByQuiz(quizId);
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      let correctCount = 0;
      const answerResults: any[] = [];
      questions.forEach((q, i) => {
        const userAnswer = answers[i];
        const isCorrect = userAnswer === q.correctIndex;
        if (isCorrect) correctCount++;
        answerResults.push({ questionId: q.id, userAnswer, correctIndex: q.correctIndex, isCorrect, explanation: q.explanation });
      });
      const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
      const passed = score >= quiz.passingScore;
      const attempt = await storage.createQuizAttempt({
        quizId, userId, courseId: courseId || quiz.courseId,
        score, totalQuestions: questions.length, passed, answers: answerResults,
      });
      res.json({ attempt, answerResults, score, passed });
    } catch (error) { console.error("Error submitting quiz:", error); res.status(500).json({ error: "Failed to submit quiz" }); }
  });

  // Get quiz attempts for a user
  app.get("/api/quizzes/:quizId/attempts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      res.json(await storage.getQuizAttempts(String(req.params.quizId), userId));
    } catch (error) { console.error("Error fetching attempts:", error); res.status(500).json({ error: "Failed to fetch attempts" }); }
  });

  // Get best quiz attempt
  app.get("/api/quizzes/:quizId/best-attempt", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const attempt = await storage.getBestQuizAttempt(String(req.params.quizId), userId);
      res.json(attempt || null);
    } catch (error) { console.error("Error fetching best attempt:", error); res.status(500).json({ error: "Failed to fetch best attempt" }); }
  });

  // Get all quiz attempts for a course
  app.get("/api/courses/:courseId/quiz-attempts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      res.json(await storage.getQuizAttemptsByCourse(String(req.params.courseId), userId));
    } catch (error) { console.error("Error fetching quiz attempts:", error); res.status(500).json({ error: "Failed to fetch quiz attempts" }); }
  });
}
