import express, { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";

import {
  db,
  galleryAlbumsTable,
  galleryMediaTable,
  drawingsTable,
  projectsTable,
} from "@workspace/db";
import {
  CreateGalleryAlbumBody,
  CreateGalleryAlbumResponse,
  GetGalleryAlbumParams,
  GetGalleryAlbumResponse,
  ListGalleryAlbumsQueryParams,
  ListGalleryAlbumsResponse,
  UploadGalleryMediaParams,
  UploadGalleryMediaResponse,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";
import { deleteDriveFile, downloadDriveFile, getDriveFileId, uploadGalleryMediaToGoogleDrive } from "../lib/googleDrive";
import { isDriveFilePath } from "../lib/googleDrive";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const MAX_MEDIA_SIZE = 100 * 1024 * 1024;
const objectStorageService = new ObjectStorageService();

async function albumWithCount(album: typeof galleryAlbumsTable.$inferSelect) {
  const media = await db.select({ id: galleryMediaTable.id })
    .from(galleryMediaTable)
    .where(eq(galleryMediaTable.albumId, album.id));
  return {
    id: album.id,
    projectName: album.projectName,
    name: album.name,
    description: album.description,
    uploaderName: album.uploaderName,
    createdAt: album.createdAt,
    mediaCount: media.length,
  };
}

router.get("/gallery/albums", async (req, res): Promise<void> => {
  const parsed = ListGalleryAlbumsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project filter." });
    return;
  }
  const albums = await db.select().from(galleryAlbumsTable)
    .where(parsed.data.projectName ? eq(galleryAlbumsTable.projectName, parsed.data.projectName) : undefined)
    .orderBy(asc(galleryAlbumsTable.createdAt), asc(galleryAlbumsTable.name));
  res.json(ListGalleryAlbumsResponse.parse(await Promise.all(albums.map(albumWithCount))));
});

router.post("/gallery/albums", async (req, res): Promise<void> => {
  const parsed = CreateGalleryAlbumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Project, album name, and description are required." });
    return;
  }
  const projectName = parsed.data.projectName.trim();
  const name = parsed.data.name.trim();
  const description = parsed.data.description?.trim() || null;
  if (!projectName || !name) {
    res.status(400).json({ error: "Project and album name are required." });
    return;
  }
  const [project] = await db.select({ name: projectsTable.name })
    .from(projectsTable)
    .where(and(eq(projectsTable.name, projectName), isNull(projectsTable.deletedAt)))
    .limit(1);
  const [legacyProject] = await db.select({ projectName: drawingsTable.projectName })
    .from(drawingsTable)
    .where(and(eq(drawingsTable.projectName, projectName), isNull(drawingsTable.deletedAt)))
    .limit(1);
  if (!project && !legacyProject) {
    res.status(404).json({ error: "Choose an active project for this album." });
    return;
  }
  const [existing] = await db.select({ id: galleryAlbumsTable.id })
    .from(galleryAlbumsTable)
    .where(and(eq(galleryAlbumsTable.projectName, projectName), eq(galleryAlbumsTable.name, name)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An album with this name already exists in this project." });
    return;
  }
  const user = requireCurrentUser(req);
  const [{ id }] = await db.insert(galleryAlbumsTable).values({
    projectName,
    name,
    description,
    createdBy: user.id,
    uploaderName: user.name,
  }).$returningId();
  const [album] = await db.select().from(galleryAlbumsTable).where(eq(galleryAlbumsTable.id, id)).limit(1);
  res.status(201).json(CreateGalleryAlbumResponse.parse(await albumWithCount(album)));
});

router.get("/gallery/albums/:id", async (req, res): Promise<void> => {
  const parsed = GetGalleryAlbumParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid album id is required." });
    return;
  }
  const [album] = await db.select().from(galleryAlbumsTable)
    .where(eq(galleryAlbumsTable.id, parsed.data.id))
    .limit(1);
  if (!album) {
    res.status(404).json({ error: "Gallery album not found." });
    return;
  }
  const media = await db.select().from(galleryMediaTable)
    .where(eq(galleryMediaTable.albumId, album.id))
    .orderBy(asc(galleryMediaTable.uploadedAt), asc(galleryMediaTable.fileName));
  res.json(GetGalleryAlbumResponse.parse({
    ...(await albumWithCount(album)),
    media,
  }));
});

router.post(
  "/gallery/albums/:id/media",
  express.raw({ type: "application/octet-stream", limit: `${MAX_MEDIA_SIZE}b` }),
  async (req, res): Promise<void> => {
    const params = UploadGalleryMediaParams.safeParse(req.params);
    if (!params.success || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "A valid photo or video file is required." });
      return;
    }
    const fileName = decodeURIComponent(String(req.headers["x-file-name"] ?? "gallery-media"));
    const contentType = String(req.headers["x-file-content-type"] ?? "application/octet-stream");
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      res.status(400).json({ error: "Gallery albums accept image and video files only." });
      return;
    }
    const [album] = await db.select().from(galleryAlbumsTable)
      .where(eq(galleryAlbumsTable.id, params.data.id))
      .limit(1);
    if (!album) {
      res.status(404).json({ error: "Gallery album not found." });
      return;
    }
    const driveFile = await uploadGalleryMediaToGoogleDrive({
      projectName: album.projectName,
      albumName: album.name,
      fileName,
      contentType,
      body: req.body,
    });
    let filePath: string;
    if (driveFile) {
      filePath = `/drive/files/${driveFile.id}`;
    } else {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: req.body,
      });
      if (!uploadResponse.ok) {
        res.status(502).json({ error: "The media could not be saved to workspace storage." });
        return;
      }
      filePath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    }
    const user = requireCurrentUser(req);
    const [{ id }] = await db.insert(galleryMediaTable).values({
      albumId: album.id,
      filePath,
      fileName,
      fileSize: req.body.length,
      contentType,
      uploadedBy: user.id,
      uploaderName: user.name,
    }).$returningId();
    const [media] = await db.select().from(galleryMediaTable).where(eq(galleryMediaTable.id, id)).limit(1);
    res.status(201).json(UploadGalleryMediaResponse.parse(media));
  },
);

router.get("/gallery/media/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "A valid media id is required." });
    return;
  }
  const [media] = await db.select().from(galleryMediaTable).where(eq(galleryMediaTable.id, id)).limit(1);
  if (!media) {
    res.status(404).json({ error: "Gallery media not found." });
    return;
  }
  const file = isDriveFilePath(media.filePath)
    ? await downloadDriveFile(getDriveFileId(media.filePath))
    : {
        metadata: { mimeType: media.contentType, size: String(media.fileSize) },
        response: await objectStorageService.downloadObject(
          await objectStorageService.getObjectEntityFile(media.filePath),
        ),
      };
  if (!file) {
    res.status(404).json({ error: "Stored media is unavailable." });
    return;
  }
  res.setHeader("Content-Type", file.metadata.mimeType ?? media.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${media.fileName.replaceAll('"', "")}"`);
  if (file.metadata.size) res.setHeader("Content-Length", file.metadata.size);
  if (file.response.body) {
    const { Readable } = await import("node:stream");
    Readable.fromWeb(file.response.body as ReadableStream<Uint8Array>).pipe(res);
  } else {
    res.end();
  }
});

router.delete("/gallery/media/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "A valid media id is required." });
    return;
  }
  const [media] = await db.select().from(galleryMediaTable).where(eq(galleryMediaTable.id, id)).limit(1);
  if (!media) {
    res.status(404).json({ error: "Gallery media not found." });
    return;
  }
  if (isDriveFilePath(media.filePath)) {
    await deleteDriveFile(getDriveFileId(media.filePath));
  } else {
    await objectStorageService.deleteObjectEntity(media.filePath);
  }
  await db.delete(galleryMediaTable).where(eq(galleryMediaTable.id, id));
  res.sendStatus(204);
});

export default router;