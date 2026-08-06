import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  personalNotesTable,
  projectNotesTable,
} from "@workspace/db";
import {
  CreatePersonalNoteBody,
  CreateProjectNoteBody,
  ListProjectNotesQueryParams,
  UpdatePersonalNoteBody,
  UpdateProjectNoteBody,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";

const router: IRouter = Router();

router.get("/project-notes", async (req, res): Promise<void> => {
  const parsed = ListProjectNotesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const projectName = parsed.data.projectName.trim();
  if (!projectName) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }
  const notes = await db.select().from(projectNotesTable)
    .where(and(eq(projectNotesTable.projectName, projectName), isNull(projectNotesTable.deletedAt)))
    .orderBy(desc(projectNotesTable.updatedAt), desc(projectNotesTable.id));
  res.json(notes);
});

router.post("/project-notes", async (req, res): Promise<void> => {
  const parsed = CreateProjectNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const projectName = parsed.data.projectName.trim();
  const content = parsed.data.content.trim();
  if (!projectName || !content) {
    res.status(400).json({ error: "Project name and note content are required" });
    return;
  }
  const [{ id }] = await db.insert(projectNotesTable).values({
    projectName,
    content,
    authorId: user.id,
    authorName: user.name,
  }).$returningId();
  const [note] = await db.select().from(projectNotesTable).where(eq(projectNotesTable.id, id)).limit(1);
  res.status(201).json(note);
});

router.patch("/project-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdateProjectNoteBody.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    res.status(400).json({ error: !parsed.success ? parsed.error.message : "Invalid note id" });
    return;
  }
  const user = requireCurrentUser(req);
  const [current] = await db.select().from(projectNotesTable).where(and(eq(projectNotesTable.id, id), isNull(projectNotesTable.deletedAt))).limit(1);
  if (!current) {
    res.status(404).json({ error: "Project note not found" });
    return;
  }
  if (current.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the note author or an administrator can edit this note" });
    return;
  }
  const content = parsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Note content is required" });
    return;
  }
  await db.update(projectNotesTable).set({ content }).where(and(eq(projectNotesTable.id, id), isNull(projectNotesTable.deletedAt)));
  const [note] = await db.select().from(projectNotesTable).where(eq(projectNotesTable.id, id)).limit(1);
  res.json(note);
});

router.delete("/project-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid note id" });
    return;
  }
  const user = requireCurrentUser(req);
  const [current] = await db.select().from(projectNotesTable).where(and(eq(projectNotesTable.id, id), isNull(projectNotesTable.deletedAt))).limit(1);
  if (!current) {
    res.status(404).json({ error: "Project note not found" });
    return;
  }
  if (current.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the note author or an administrator can delete this note" });
    return;
  }
  await db.update(projectNotesTable).set({ deletedAt: new Date() }).where(eq(projectNotesTable.id, id));
  res.sendStatus(204);
});

router.get("/personal-notes", async (req, res): Promise<void> => {
  const user = requireCurrentUser(req);
  const notes = await db.select().from(personalNotesTable)
    .where(and(eq(personalNotesTable.userId, user.id), isNull(personalNotesTable.deletedAt)))
    .orderBy(desc(personalNotesTable.updatedAt), desc(personalNotesTable.id));
  res.json(notes);
});

router.post("/personal-notes", async (req, res): Promise<void> => {
  const parsed = CreatePersonalNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const content = parsed.data.content.trim();
  const title = parsed.data.title?.trim() || "Personal note";
  if (!content) {
    res.status(400).json({ error: "Note content is required" });
    return;
  }
  const [{ id }] = await db.insert(personalNotesTable).values({
    userId: user.id,
    authorName: user.name,
    title,
    content,
  }).$returningId();
  const [note] = await db.select().from(personalNotesTable).where(eq(personalNotesTable.id, id)).limit(1);
  res.status(201).json(note);
});

router.patch("/personal-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdatePersonalNoteBody.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    res.status(400).json({ error: !parsed.success ? parsed.error.message : "Invalid note id" });
    return;
  }
  const user = requireCurrentUser(req);
  const [current] = await db.select().from(personalNotesTable).where(and(
    eq(personalNotesTable.id, id),
    eq(personalNotesTable.userId, user.id),
    isNull(personalNotesTable.deletedAt),
  )).limit(1);
  if (!current) {
    res.status(404).json({ error: "Personal note not found" });
    return;
  }
  const content = parsed.data.content.trim();
  const title = parsed.data.title?.trim() || "Personal note";
  if (!content) {
    res.status(400).json({ error: "Note content is required" });
    return;
  }
  await db.update(personalNotesTable).set({ title, content }).where(and(eq(personalNotesTable.id, id), isNull(personalNotesTable.deletedAt)));
  const [note] = await db.select().from(personalNotesTable).where(eq(personalNotesTable.id, id)).limit(1);
  res.json(note);
});

router.delete("/personal-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid note id" });
    return;
  }
  const user = requireCurrentUser(req);
  const [current] = await db.select({ id: personalNotesTable.id }).from(personalNotesTable).where(and(
    eq(personalNotesTable.id, id),
    eq(personalNotesTable.userId, user.id),
    isNull(personalNotesTable.deletedAt),
  )).limit(1);
  if (!current) {
    res.status(404).json({ error: "Personal note not found" });
    return;
  }
  await db.update(personalNotesTable).set({ deletedAt: new Date() }).where(eq(personalNotesTable.id, id));
  res.sendStatus(204);
});

export default router;