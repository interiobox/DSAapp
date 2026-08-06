import { Readable } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import express from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, drawingUploadsTable, drawingsTable } from "@workspace/db";
import { GetDrawingParams, RecordDrawingUploadResponse } from "@workspace/api-zod";
import { addActivity } from "../lib/drawings";
import { requireCurrentUser } from "../lib/portalAuth";
import { getDriveFileId, getGoogleDriveStatus, isDriveFilePath, downloadDriveFile, uploadDrawingToGoogleDrive } from "../lib/googleDrive";

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/storage/status", async (_req, res): Promise<void> => {
  res.json(await getGoogleDriveStatus());
});

router.post(
  "/storage/drawings/:id/drive-upload",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  async (req, res): Promise<void> => {
    const params = GetDrawingParams.safeParse(req.params);
    if (!params.success || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "A valid drawing id and file are required" });
      return;
    }
    const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt))).limit(1);
    if (!drawing) {
      res.status(404).json({ error: "Drawing not found" });
      return;
    }
    const fileName = decodeURIComponent(String(req.headers["x-file-name"] ?? "drawing-file"));
    const contentType = String(req.headers["x-file-content-type"] ?? "application/octet-stream");
    const driveFile = await uploadDrawingToGoogleDrive({
      projectName: drawing.projectName,
        category: drawing.discipline,
      drawingNumber: drawing.drawingNumber,
      drawingTitle: drawing.title,
      fileName,
      contentType,
      body: req.body,
    });
    if (!driveFile) {
      res.status(409).json({ error: "Google Drive is not connected. Use the standard upload flow or connect Drive in Admin." });
      return;
    }
    const user = requireCurrentUser(req);
    const filePath = `/drive/files/${driveFile.id}`;
    const [{ id }] = await db.insert(drawingUploadsTable).values({
      drawingId: drawing.id,
      filePath,
      fileName,
      fileSize: req.body.length,
      contentType,
      uploadedBy: user.name,
    }).$returningId();
    const [upload] = await db.select().from(drawingUploadsTable).where(eq(drawingUploadsTable.id, id)).limit(1);
    await db.update(drawingsTable).set({
      attachmentPath: filePath,
      attachmentName: fileName,
      attachmentSize: req.body.length,
      attachmentContentType: contentType,
      updatedAt: new Date(),
    }).where(eq(drawingsTable.id, drawing.id));
    await addActivity("drawing_uploaded", `${fileName} uploaded to Google Drive by ${user.name} to ${drawing.title}`, drawing.id, String(user.id), user.name);
    res.status(201).json(RecordDrawingUploadResponse.parse(upload));
  },
);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      if (size > 25 * 1024 * 1024) {
        res.status(413).json({ error: 'Files must be 25 MB or smaller' });
        return;
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

router.get("/storage/drive-files/:fileId", async (req, res): Promise<void> => {
  const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
  if (!fileId) {
    res.status(400).json({ error: "File id is required" });
    return;
  }
  const [upload] = await db.select({ filePath: drawingUploadsTable.filePath })
    .from(drawingUploadsTable)
    .where(and(eq(drawingUploadsTable.filePath, `/drive/files/${fileId}`), isNull(drawingUploadsTable.deletedAt)))
    .limit(1);
  if (!upload || !isDriveFilePath(upload.filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const file = await downloadDriveFile(getDriveFileId(upload.filePath));
  if (!file) {
    res.status(404).json({ error: "Google Drive is not connected" });
    return;
  }
  res.setHeader("Content-Type", file.metadata.mimeType ?? "application/octet-stream");
  if (file.metadata.name) res.setHeader("Content-Disposition", `inline; filename="${file.metadata.name.replaceAll('"', "")}"`);
  if (file.metadata.size) res.setHeader("Content-Length", file.metadata.size);
  Readable.fromWeb(file.response.body as ReadableStream<Uint8Array>).pipe(res);
});

export default router;
