import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isAuthenticated } from "../../auth/googleAuth";

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get(/^\/objects\/(.+)/, async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType || "application/octet-stream";
      const fileSize = parseInt(metadata.size as string, 10);

      const isStreamable = contentType.startsWith("video/") || contentType.startsWith("audio/");
      const rangeHeader = req.headers.range;

      if (isStreamable && rangeHeader && fileSize) {
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (!rangeMatch) {
          res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
          return res.end();
        }
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : Math.min(start + 5 * 1024 * 1024, fileSize - 1);

        if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
          res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
          return res.end();
        }

        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        });

        const stream = objectFile.createReadStream({ start, end });
        stream.on("error", (err) => {
          console.error("Range stream error:", err);
          if (!res.headersSent) res.status(500).end();
          else res.end();
        });
        stream.pipe(res);
      } else if (isStreamable && fileSize) {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        });
        const stream = objectFile.createReadStream();
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).end();
          else res.end();
        });
        stream.pipe(res);
      } else {
        await objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

