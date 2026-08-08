import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { db, drawingActivityTable, drawingCommentsTable, drawingUploadsTable, drawingsTable, usersTable } from "@workspace/db";
import {
  CreateDrawingBody,
  CreateDrawingResponse,
  DeleteDrawingParams,
  GetDrawingParams,
  GetDrawingResponse,
  ListActivityResponse,
  ListDrawingsQueryParams,
  ListDrawingsResponse,
  UpdateDrawingBody,
  UpdateDrawingParams,
  UpdateDrawingResponse,
  ListDrawingUploadsResponse,
  RecordDrawingUploadBody,
  RecordDrawingUploadResponse,
  ListDrawingCommentsResponse,
  CreateDrawingCommentBody,
  CreateDrawingCommentResponse,
  DeleteDrawingUploadParams,
  UpdateDrawingCommentParams,
  UpdateDrawingCommentBody,
  UpdateDrawingCommentResponse,
  DeleteDrawingCommentParams,
  UpdateDrawingAssignmentBody,
  UpdateDrawingAssignmentResponse,
  PreflightDrawingUploadBody,
  PreflightDrawingUploadResponse,
} from "@workspace/api-zod";
import { addActivity, getIdParam, listDrawingRows, toDateString } from "../lib/drawings";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireCurrentUser } from "../lib/portalAuth";
import { notifyDrawingAssigneeById, notifyMentions, safelyNotify } from "../lib/notifications";
import { getDriveFileId, isDriveFilePath, moveDriveFileToDrawingFolder, normalizeDriveCategory } from "../lib/googleDrive";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

async function hashObjectPath(filePath: string): Promise<string> {
  const file = await objectStorageService.getObjectEntityFile(filePath);
  const hash = createHash("sha256");
  return new Promise((resolve, reject) => {
    const stream = file.createReadStream();
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function revisionRank(value: string | null | undefined): number | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "—" || normalized === "-") return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (/^[A-Z]+$/.test(normalized)) {
    return normalized.split("").reduce((rank, character) => rank * 26 + character.charCodeAt(0) - 64, 0);
  }
  return null;
}

function revisionFromFilename(fileName: string): string | null {
  const match = fileName.match(/(?:revision|rev)[\s._-]*([a-z0-9]+)|(?:^|[_\s.-])r([0-9]+)(?:[_\s.-]|$)/i);
  return match?.[1] ?? match?.[2] ?? null;
}

function currentUserId(req: Request) {
  return String(requireCurrentUser(req).id);
}

function currentUserName(req: Request) {
  return requireCurrentUser(req).name;
}

router.get("/drawings", async (req, res): Promise<void> => {
  const parsed = ListDrawingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await listDrawingRows(parsed.data);
  res.json(ListDrawingsResponse.parse(rows));
});

router.post("/drawings", async (req, res): Promise<void> => {
  const parsed = CreateDrawingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  if (data.status === "approved" && req.portalUser?.role !== "admin") {
    res.status(403).json({ error: "Administrator access required to approve drawings" });
    return;
  }
  const [{ id }] = await db.insert(drawingsTable).values({
    drawingNumber: data.drawingNumber ?? `DR-${Date.now().toString().slice(-6)}`,
    title: data.title ?? "Untitled drawing",
    discipline: normalizeDriveCategory(data.discipline),
    status: data.status ?? "draft",
    revision: data.revision ?? "—",
    projectName: data.projectName ?? "Unassigned",
    sheetSize: data.sheetSize ?? "A1",
    author: data.author ?? "—",
    description: data.description,
    dueDate: toDateString(data.dueDate),
    issuedDate: toDateString(data.issuedDate),
  }).$returningId();
  const [drawing] = await db.select().from(drawingsTable).where(eq(drawingsTable.id, id)).limit(1);
  await addActivity("drawing_added", `${drawing.title} was added to the drawing library`, drawing.id, currentUserId(req), currentUserName(req));
  res.status(201).json(CreateDrawingResponse.parse(drawing));
});

router.get("/drawings/:id", async (req, res): Promise<void> => {
  const parsed = GetDrawingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, parsed.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  res.json(GetDrawingResponse.parse(drawing));
});

router.patch("/drawings/:id", async (req, res): Promise<void> => {
  const params = UpdateDrawingParams.safeParse(req.params);
  const body = UpdateDrawingBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const data = body.data;
  if (data.status === "approved" && req.portalUser?.role !== "admin") {
    res.status(403).json({ error: "Administrator access required to approve drawings" });
    return;
  }
  const issuedDate = data.status === "issued" && data.issuedDate === undefined
    ? new Date().toISOString().slice(0, 10)
    : data.issuedDate !== undefined
      ? toDateString(data.issuedDate)
      : undefined;
  await db.update(drawingsTable).set({
    ...(data.drawingNumber !== undefined ? { drawingNumber: data.drawingNumber } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
     ...(data.discipline !== undefined ? { discipline: normalizeDriveCategory(data.discipline) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.revision !== undefined ? { revision: data.revision } : {}),
    ...(data.projectName !== undefined ? { projectName: data.projectName } : {}),
    ...(data.sheetSize !== undefined ? { sheetSize: data.sheetSize } : {}),
    ...(data.author !== undefined ? { author: data.author } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.dueDate !== undefined ? { dueDate: toDateString(data.dueDate) } : {}),
    ...(issuedDate !== undefined ? { issuedDate } : {}),
    ...(data.attachmentPath !== undefined ? { attachmentPath: data.attachmentPath } : {}),
    ...(data.attachmentName !== undefined ? { attachmentName: data.attachmentName } : {}),
    ...(data.attachmentSize !== undefined ? { attachmentSize: data.attachmentSize } : {}),
    ...(data.attachmentContentType !== undefined ? { attachmentContentType: data.attachmentContentType } : {}),
    updatedAt: new Date(),
  }).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt)));
  const [drawing] = await db.select().from(drawingsTable)
    .where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt))).limit(1);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  if (
    data.drawingNumber !== undefined
    || data.title !== undefined
    || data.discipline !== undefined
    || data.projectName !== undefined
  ) {
    const uploads = await db.select({ filePath: drawingUploadsTable.filePath })
      .from(drawingUploadsTable)
      .where(and(eq(drawingUploadsTable.drawingId, drawing.id), isNull(drawingUploadsTable.deletedAt)));
    for (const upload of uploads) {
      if (isDriveFilePath(upload.filePath)) {
        await moveDriveFileToDrawingFolder(getDriveFileId(upload.filePath), {
          projectName: drawing.projectName,
          category: drawing.discipline,
          drawingNumber: drawing.drawingNumber,
          drawingTitle: drawing.title,
        });
      }
    }
  }
  const activityType = data.status === "issued" ? "drawing_issued" : data.status === "approved" ? "drawing_approved" : "drawing_updated";
  await addActivity(activityType, `${drawing.title} was updated`, drawing.id, currentUserId(req), currentUserName(req));
  if (data.status !== undefined) {
    await safelyNotify(() => notifyDrawingAssigneeById(drawing.id, drawing.assignedToUserId, drawing.assignedTo, {
      type: "status_change",
      title: "Assigned drawing status changed",
      message: `${drawing.title} is now ${String(data.status).replace("_", " ")}`,
      link: `/drawings/${drawing.id}`,
    }, Number(currentUserId(req))));
  }
  res.json(UpdateDrawingResponse.parse(drawing));
});

router.patch("/drawings/:id/assignment", async (req, res): Promise<void> => {
  const params = UpdateDrawingParams.safeParse(req.params);
  const body = UpdateDrawingAssignmentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const assigneeName = body.data.assigneeName?.trim() || null;
  let assigneeUserId: number | null = null;
  let canonicalAssigneeName = assigneeName;
  if (assigneeName) {
    const [assignee] = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(sql`lower(${usersTable.name}) = lower(${assigneeName})`, eq(usersTable.active, true)))
      .orderBy(usersTable.id)
      .limit(1);
    if (!assignee) {
      res.status(400).json({ error: "Assignment must target an active portal user" });
      return;
    }
    assigneeUserId = assignee.id;
    canonicalAssigneeName = assignee.name;
  }
  await db.update(drawingsTable).set({
    assignedTo: canonicalAssigneeName,
    assignedToUserId: assigneeUserId,
    updatedAt: new Date(),
  }).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt)));
  const [drawing] = await db.select().from(drawingsTable)
    .where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt))).limit(1);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const message = canonicalAssigneeName
    ? `${currentUserName(req)} assigned ${drawing.title} to ${canonicalAssigneeName}`
    : `${currentUserName(req)} unassigned ${drawing.title}`;
  await addActivity("drawing_assigned", message, drawing.id, currentUserId(req), currentUserName(req));
  await safelyNotify(() => notifyDrawingAssigneeById(drawing.id, drawing.assignedToUserId, drawing.assignedTo, {
    type: "assignment",
    title: "Drawing assigned to you",
    message: `${drawing.title} was assigned to you by ${currentUserName(req)}`,
    link: `/drawings/${drawing.id}`,
  }, Number(currentUserId(req))));
  res.json(UpdateDrawingAssignmentResponse.parse(drawing));
});

router.delete("/drawings/:id", async (req, res): Promise<void> => {
  const parsed = DeleteDrawingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, parsed.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const uploads = await db.select({ filePath: drawingUploadsTable.filePath })
    .from(drawingUploadsTable)
    .where(and(eq(drawingUploadsTable.drawingId, drawing.id), isNull(drawingUploadsTable.deletedAt)));
  for (const upload of uploads) {
    if (isDriveFilePath(upload.filePath)) {
      await moveDriveFileToDrawingFolder(getDriveFileId(upload.filePath), {
        projectName: drawing.projectName,
        category: drawing.discipline,
        drawingNumber: drawing.drawingNumber,
        drawingTitle: drawing.title,
      }, true);
    }
  }
  await addActivity("drawing_deleted", `${currentUserName(req)} deleted ${drawing.title} from the drawing library`, drawing.id, currentUserId(req), currentUserName(req));
  await db.update(drawingsTable).set({ deletedAt: new Date() }).where(eq(drawingsTable.id, drawing.id));
  res.sendStatus(204);
});

router.get("/activity", async (_req, res): Promise<void> => {
  const activity = await db.select().from(drawingActivityTable).orderBy(desc(drawingActivityTable.createdAt)).limit(12);
  res.json(ListActivityResponse.parse(activity));
});

router.get("/drawings/:id/activity", async (req, res): Promise<void> => {
  const parsed = GetDrawingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drawing] = await db.select({ id: drawingsTable.id })
    .from(drawingsTable)
    .where(and(eq(drawingsTable.id, parsed.data.id), isNull(drawingsTable.deletedAt)))
    .limit(1);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const activity = await db.select().from(drawingActivityTable)
    .where(eq(drawingActivityTable.drawingId, parsed.data.id))
    .orderBy(desc(drawingActivityTable.createdAt), desc(drawingActivityTable.id));
  res.json(ListActivityResponse.parse(activity));
});

router.get("/drawings/:id/uploads", async (req, res): Promise<void> => {
  const parsed = GetDrawingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drawing] = await db.select({ id: drawingsTable.id }).from(drawingsTable).where(and(eq(drawingsTable.id, parsed.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const uploads = await db.select().from(drawingUploadsTable)
    .where(and(eq(drawingUploadsTable.drawingId, parsed.data.id), isNull(drawingUploadsTable.deletedAt)))
    .orderBy(desc(drawingUploadsTable.uploadedAt));
  res.json(ListDrawingUploadsResponse.parse(uploads));
});

router.post("/drawings/:id/uploads/preflight", async (req, res): Promise<void> => {
  const params = GetDrawingParams.safeParse(req.params);
  const body = PreflightDrawingUploadBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [drawing] = await db.select({
    id: drawingsTable.id,
    revision: drawingsTable.revision,
  }).from(drawingsTable).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt))).limit(1);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const uploads = await db.select({
    id: drawingUploadsTable.id,
    fileName: drawingUploadsTable.fileName,
    fileSize: drawingUploadsTable.fileSize,
    sha256: drawingUploadsTable.sha256,
    deletedAt: drawingUploadsTable.deletedAt,
    uploadedAt: drawingUploadsTable.uploadedAt,
  }).from(drawingUploadsTable)
    .where(eq(drawingUploadsTable.drawingId, drawing.id))
    .orderBy(desc(drawingUploadsTable.uploadedAt));
  const activeUploads = uploads.filter((upload) => upload.deletedAt === null);
  const exactDuplicate = activeUploads.find((upload) => upload.sha256?.toLowerCase() === body.data.sha256.toLowerCase());
  const recycledMatch = uploads.some((upload) => upload.deletedAt !== null && upload.sha256?.toLowerCase() === body.data.sha256.toLowerCase());
  const sameFilename = activeUploads.some((upload) => upload.fileName.toLowerCase() === body.data.fileName.toLowerCase());
  const incomingRevision = revisionRank(revisionFromFilename(body.data.fileName));
  const currentRevision = revisionRank(drawing.revision);
  const olderRevision = incomingRevision !== null && currentRevision !== null && incomingRevision < currentRevision;
  const warnings = [
    ...(exactDuplicate ? ["This file is already recorded as an active version of this drawing."] : []),
    ...(sameFilename && !exactDuplicate ? ["A version with this filename already exists for this drawing."] : []),
    ...(olderRevision ? [`The filename appears to contain revision ${revisionFromFilename(body.data.fileName)}, older than the current drawing revision ${drawing.revision}.`] : []),
  ];
  res.json(PreflightDrawingUploadResponse.parse({
    exactDuplicate: Boolean(exactDuplicate),
    sameFilename,
    olderRevision,
    recycledMatch,
    warnings,
    existingUpload: exactDuplicate ?? null,
  }));
});

router.post("/drawings/:id/uploads", async (req, res): Promise<void> => {
  const params = GetDrawingParams.safeParse(req.params);
  const body = RecordDrawingUploadBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const storedSha256 = body.data.filePath.startsWith("/objects/")
    ? await hashObjectPath(body.data.filePath)
    : body.data.sha256;
  if (storedSha256.toLowerCase() !== body.data.sha256.toLowerCase()) {
    if (body.data.filePath.startsWith("/objects/")) {
      await objectStorageService.deleteObjectEntity(body.data.filePath);
    }
    res.status(422).json({ error: "The stored file checksum does not match the upload checksum" });
    return;
  }
  const [{ id }] = await db.insert(drawingUploadsTable).values({
    drawingId: drawing.id,
    ...body.data,
    sha256: storedSha256,
    uploadedBy: currentUserName(req),
  }).$returningId();
  const [upload] = await db.select().from(drawingUploadsTable).where(eq(drawingUploadsTable.id, id)).limit(1);
  await db.update(drawingsTable).set({
    attachmentPath: upload.filePath,
    attachmentName: upload.fileName,
    attachmentSize: upload.fileSize,
    attachmentContentType: upload.contentType,
    updatedAt: new Date(),
  }).where(eq(drawingsTable.id, drawing.id));
  await addActivity("drawing_uploaded", `${upload.fileName} uploaded by ${upload.uploadedBy} to ${drawing.title}`, drawing.id, currentUserId(req), currentUserName(req));
  res.status(201).json(RecordDrawingUploadResponse.parse(upload));
});

router.delete("/drawings/:id/uploads/:uploadId", async (req, res): Promise<void> => {
  const params = DeleteDrawingUploadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [upload] = await db.select().from(drawingUploadsTable).where(and(eq(drawingUploadsTable.id, params.data.uploadId), isNull(drawingUploadsTable.deletedAt)));
  if (!upload || upload.drawingId !== params.data.id) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }
  const [drawingForDrive] = await db.select({
    projectName: drawingsTable.projectName,
    discipline: drawingsTable.discipline,
    drawingNumber: drawingsTable.drawingNumber,
    title: drawingsTable.title,
  }).from(drawingsTable).where(eq(drawingsTable.id, upload.drawingId)).limit(1);
  if (drawingForDrive && isDriveFilePath(upload.filePath)) {
    await moveDriveFileToDrawingFolder(getDriveFileId(upload.filePath), {
      projectName: drawingForDrive.projectName,
      category: drawingForDrive.discipline,
      drawingNumber: drawingForDrive.drawingNumber,
      drawingTitle: drawingForDrive.title,
    }, true);
  }
  await db.update(drawingUploadsTable).set({ deletedAt: new Date() }).where(eq(drawingUploadsTable.id, upload.id));
  const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, upload.drawingId), isNull(drawingsTable.deletedAt)));
  if (drawing?.attachmentPath === upload.filePath) {
    const [replacement] = await db.select().from(drawingUploadsTable)
      .where(and(eq(drawingUploadsTable.drawingId, upload.drawingId), isNull(drawingUploadsTable.deletedAt)))
      .orderBy(desc(drawingUploadsTable.uploadedAt))
      .limit(1);
    await db.update(drawingsTable).set({
      attachmentPath: replacement?.filePath ?? null,
      attachmentName: replacement?.fileName ?? null,
      attachmentSize: replacement?.fileSize ?? null,
      attachmentContentType: replacement?.contentType ?? null,
      updatedAt: new Date(),
    }).where(eq(drawingsTable.id, upload.drawingId));
  }
  await addActivity("drawing_updated", `${upload.fileName} upload was deleted from ${drawing?.title ?? "the drawing"}`, upload.drawingId, currentUserId(req), currentUserName(req));
  res.sendStatus(204);
});

router.get("/drawings/:id/comments", async (req, res): Promise<void> => {
  const parsed = GetDrawingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drawing] = await db.select({ id: drawingsTable.id }).from(drawingsTable).where(and(eq(drawingsTable.id, parsed.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const comments = await db.select().from(drawingCommentsTable)
    .where(and(eq(drawingCommentsTable.drawingId, parsed.data.id), isNull(drawingCommentsTable.deletedAt)))
    .orderBy(desc(drawingCommentsTable.createdAt));
  res.json(ListDrawingCommentsResponse.parse(comments));
});

router.post("/drawings/:id/comments", async (req, res): Promise<void> => {
  const params = GetDrawingParams.safeParse(req.params);
  const body = CreateDrawingCommentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [drawing] = await db.select().from(drawingsTable).where(and(eq(drawingsTable.id, params.data.id), isNull(drawingsTable.deletedAt)));
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }
  const currentUser = requireCurrentUser(req);
  const [{ id }] = await db.insert(drawingCommentsTable).values({
    drawingId: drawing.id,
    ...body.data,
    author: currentUser.name,
    authorId: currentUser.id,
  }).$returningId();
  const [comment] = await db.select().from(drawingCommentsTable).where(eq(drawingCommentsTable.id, id)).limit(1);
  await addActivity("comment_added", `${comment.author} commented on ${drawing.title}`, drawing.id, currentUserId(req), currentUserName(req));
  await safelyNotify(() => notifyMentions(body.data.comment, {
    type: "mention",
    title: `You were mentioned on ${drawing.title}`,
    message: `{mention} was mentioned by ${comment.author}: ${body.data.comment}`,
    link: `/drawings/${drawing.id}`,
  }, Number(currentUserId(req))));
  res.status(201).json(CreateDrawingCommentResponse.parse(comment));
});

router.patch("/drawings/:id/comments/:commentId", async (req, res): Promise<void> => {
  const params = UpdateDrawingCommentParams.safeParse(req.params);
  const body = UpdateDrawingCommentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [comment] = await db.select().from(drawingCommentsTable).where(and(eq(drawingCommentsTable.id, params.data.commentId), isNull(drawingCommentsTable.deletedAt)));
  if (!comment || comment.drawingId !== params.data.id) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  const user = requireCurrentUser(req);
  if (user.role !== "admin" && comment.authorId !== user.id) {
    res.status(403).json({ error: "You can only edit your own comments" });
    return;
  }
  await db.update(drawingCommentsTable).set({ comment: body.data.comment })
    .where(and(eq(drawingCommentsTable.id, comment.id), isNull(drawingCommentsTable.deletedAt)));
  const [updated] = await db.select().from(drawingCommentsTable).where(eq(drawingCommentsTable.id, comment.id)).limit(1);
  await addActivity("drawing_updated", `${updated.author} edited a review comment on drawing ${comment.drawingId}`, comment.drawingId, currentUserId(req), currentUserName(req));
  res.json(UpdateDrawingCommentResponse.parse(updated));
});

router.delete("/drawings/:id/comments/:commentId", async (req, res): Promise<void> => {
  const params = DeleteDrawingCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [comment] = await db.select().from(drawingCommentsTable).where(and(eq(drawingCommentsTable.id, params.data.commentId), isNull(drawingCommentsTable.deletedAt)));
  if (!comment || comment.drawingId !== params.data.id) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  const user = requireCurrentUser(req);
  if (user.role !== "admin" && comment.authorId !== user.id && comment.author !== user.name) {
    res.status(403).json({ error: "You can only delete your own comments" });
    return;
  }
  await db.update(drawingCommentsTable).set({ deletedAt: new Date() }).where(eq(drawingCommentsTable.id, comment.id));
  await addActivity("drawing_updated", `${comment.author}'s review comment was deleted from drawing ${comment.drawingId}`, comment.drawingId, currentUserId(req), currentUserName(req));
  res.sendStatus(204);
});

export default router;