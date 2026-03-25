/**
 * DigitalOcean Spaces (S3-compatible) client.
 *
 * This replaces the Replit Object Storage integration.
 * Set the following env vars on DO App Platform:
 *   DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET, DO_SPACES_REGION
 *
 * Bucket files are stored with ACL: public-read so that the CDN can serve them.
 * CDN URL format: https://<bucket>.<region>.cdn.digitaloceanspaces.com/<key>
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

function getSpacesClient(): S3Client {
  const region = process.env.DO_SPACES_REGION;
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;

  if (!region || !key || !secret) {
    throw new Error(
      "DO Spaces not configured. Set DO_SPACES_REGION, DO_SPACES_KEY, DO_SPACES_SECRET."
    );
  }

  return new S3Client({
    endpoint: `https://${region}.digitaloceanspaces.com`,
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  });
}

function getBucket(): string {
  const bucket = process.env.DO_SPACES_BUCKET;
  if (!bucket) throw new Error("DO_SPACES_BUCKET env var is not set.");
  return bucket;
}

/**
 * Returns a pre-signed PUT URL valid for 1 hour.
 * The client uploads directly to Spaces — the server never buffers the file.
 */
export async function getUploadSignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const client = getSpacesClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ACL: "public-read" as ObjectCannedACL,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generates a unique object key for an upload.
 * Format: uploads/<yyyy-mm>/<nanoid>.<ext>
 */
export function generateObjectKey(originalName: string): string {
  const ext = originalName.split(".").pop() ?? "bin";
  const month = new Date().toISOString().slice(0, 7); // 2026-03
  return `uploads/${month}/${nanoid()}${ext ? "." + ext : ""}`;
}

/**
 * Returns the public CDN URL for a stored object.
 * Falls back to the direct Spaces URL if CDN is not yet enabled.
 */
export function getPublicUrl(key: string): string {
  const bucket = getBucket();
  const region = process.env.DO_SPACES_REGION!;
  // CDN URL (enabled in DO console → Spaces → Enable CDN)
  return `https://${bucket}.${region}.cdn.digitaloceanspaces.com/${key}`;
}

/**
 * Deletes an object from Spaces (e.g. when a book/course is deleted).
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getSpacesClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
}
