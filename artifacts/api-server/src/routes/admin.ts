import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, disciplinesTable, drawingActivityTable, drawingUploadsTable, drawingsTable, personalNotesTable, sessionsTable, usersTable } from "@workspace/db";
import { hashPassword, publicUser, requireAdmin, requireCurrentUser } from "../lib/portalAuth";
import { addActivity } from "../lib/drawings";
import { getDriveFileId, isDriveFilePath, moveDriveFileToDrawingFolder } from "../lib/googleDrive";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(isNull(usersTable.deletedAt)).orderBy(asc(usersTable.name));
  res.json(users.map(publicUser));
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role === "admin" ? "admin" : "user";
  if (!name || !username || !password) {
    res.status(400).json({ error: "Name, username, and password are required" });
    return;
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    res.status(400).json({ error: "Username must be 3-40 characters using letters, numbers, dots, dashes, or underscores" });
    return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.username, username), isNull(usersTable.deletedAt))).limit(1);
  if (existing) {
    res.status(409).json({ error: "That username is already in use" });
    return;
  }
  const [{ id }] = await db.insert(usersTable).values({
    name,
    username,
    passwordHash: await hashPassword(password),
    role,
    active: true,
  }).$returningId();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.status(201).json(publicUser(user));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const [current] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt))).limit(1);
  if (!current) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : undefined;
  const password = typeof req.body?.password === "string" ? req.body.password : undefined;
  const role = req.body?.role === "admin" || req.body?.role === "user" ? req.body.role : undefined;
  const active = typeof req.body?.active === "boolean" ? req.body.active : undefined;
  if (username !== undefined && !/^[a-z0-9._-]{3,40}$/.test(username)) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }
  if (username && username !== current.username) {
    const [duplicate] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.username, username), isNull(usersTable.deletedAt))).limit(1);
    if (duplicate) {
      res.status(409).json({ error: "That username is already in use" });
      return;
    }
  }
  if (name && name.toLocaleLowerCase() !== current.name.toLocaleLowerCase()) {
    const [duplicateName] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.name}) = lower(${name}) AND ${usersTable.id} <> ${id} AND ${usersTable.deletedAt} IS NULL`)
      .limit(1);
    if (duplicateName) {
      res.status(409).json({ error: "That display name is already in use" });
      return;
    }
  }
  if (current.role === "admin" && (role === "user" || active === false)) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.role} = 'admin' AND ${usersTable.active} = true`);
    if (Number(count) <= 1) {
      res.status(400).json({ error: "At least one active administrator is required" });
      return;
    }
  }
  await db.update(usersTable).set({
    ...(name !== undefined ? { name } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(active !== undefined ? { active } : {}),
  }).where(eq(usersTable.id, id));
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (password || role !== undefined || active === false) {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, id));
  }
  res.json(publicUser(updated));
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt))).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role === "admin") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.role} = 'admin' AND ${usersTable.active} = true`);
    if (Number(count) <= 1) {
      res.status(400).json({ error: "At least one active administrator is required" });
      return;
    }
  }
  await db.update(usersTable).set({ deletedAt: new Date(), active: false }).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/disciplines", async (_req, res): Promise<void> => {
  res.json(await db.select().from(disciplinesTable).where(isNull(disciplinesTable.deletedAt)).orderBy(asc(disciplinesTable.name)));
});

router.post("/admin/disciplines", async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Discipline name is required" });
    return;
  }
  const [existing] = await db.select().from(disciplinesTable).where(sql`lower(${disciplinesTable.name}) = lower(${name}) AND ${disciplinesTable.deletedAt} IS NULL`).limit(1);
  if (existing) {
    res.status(409).json({ error: "That discipline already exists" });
    return;
  }
  const [{ id }] = await db.insert(disciplinesTable).values({ name }).$returningId();
  const [discipline] = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, id)).limit(1);
  res.status(201).json(discipline);
});

router.patch("/admin/disciplines/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!Number.isInteger(id) || !name) {
    res.status(400).json({ error: "Valid discipline id and name are required" });
    return;
  }
  const [existing] = await db
    .select({ id: disciplinesTable.id })
    .from(disciplinesTable)
    .where(sql`lower(${disciplinesTable.name}) = lower(${name}) AND ${disciplinesTable.id} <> ${id} AND ${disciplinesTable.deletedAt} IS NULL`)
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That discipline already exists" });
    return;
  }
  const [currentDiscipline] = await db.select().from(disciplinesTable).where(and(eq(disciplinesTable.id, id), isNull(disciplinesTable.deletedAt))).limit(1);
  if (!currentDiscipline) {
    res.status(404).json({ error: "Discipline not found" });
    return;
  }
  await db.update(disciplinesTable).set({ name }).where(eq(disciplinesTable.id, id));
  const [discipline] = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, id)).limit(1);
  if (!discipline) {
    res.status(404).json({ error: "Discipline not found" });
    return;
  }
  const affectedDrawings = await db.select({
    id: drawingsTable.id,
    title: drawingsTable.title,
    projectName: drawingsTable.projectName,
    drawingNumber: drawingsTable.drawingNumber,
    discipline: drawingsTable.discipline,
    deletedAt: drawingsTable.deletedAt,
  })
    .from(drawingsTable)
     .where(eq(drawingsTable.discipline, currentDiscipline.name));
  await db.update(drawingsTable).set({ discipline: name }).where(eq(drawingsTable.discipline, currentDiscipline.name));
  const user = requireCurrentUser(req);
  for (const drawing of affectedDrawings) {
    const uploads = await db.select({ filePath: drawingUploadsTable.filePath, deletedAt: drawingUploadsTable.deletedAt })
      .from(drawingUploadsTable)
      .where(eq(drawingUploadsTable.drawingId, drawing.id));
    for (const upload of uploads) {
      if (isDriveFilePath(upload.filePath)) {
        await moveDriveFileToDrawingFolder(getDriveFileId(upload.filePath), {
          projectName: drawing.projectName,
          category: name,
          drawingNumber: drawing.drawingNumber,
          drawingTitle: drawing.title,
        }, Boolean(drawing.deletedAt || upload.deletedAt));
      }
    }
    await addActivity(
      "drawing_updated",
      `${drawing.title} changed discipline from ${currentDiscipline.name} to ${name}`,
      drawing.id,
      String(user.id),
      user.name,
    );
  }
  res.json(discipline);
});

router.delete("/admin/disciplines/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [discipline] = await db.select().from(disciplinesTable).where(and(eq(disciplinesTable.id, id), isNull(disciplinesTable.deletedAt))).limit(1);
  if (!discipline) {
    res.status(404).json({ error: "Discipline not found" });
    return;
  }
  const [used] = await db.select({ id: drawingsTable.id }).from(drawingsTable).where(and(eq(drawingsTable.discipline, discipline.name), isNull(drawingsTable.deletedAt))).limit(1);
  if (used) {
    res.status(409).json({ error: "This discipline is used by existing drawings and cannot be deleted" });
    return;
  }
  await db.update(disciplinesTable).set({ deletedAt: new Date() }).where(eq(disciplinesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/activity", async (_req, res): Promise<void> => {
  res.json(await db.select().from(drawingActivityTable).orderBy(desc(drawingActivityTable.createdAt)).limit(500));
});

router.get("/admin/personal-notes", async (_req, res): Promise<void> => {
  res.json(await db.select().from(personalNotesTable).where(isNull(personalNotesTable.deletedAt)).orderBy(desc(personalNotesTable.updatedAt), desc(personalNotesTable.id)));
});

export default router;