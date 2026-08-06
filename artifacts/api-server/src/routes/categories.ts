import { Router, type IRouter } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, disciplinesTable, drawingUploadsTable, drawingsTable } from "@workspace/db";
import { requireCurrentUser } from "../lib/portalAuth";
import { addActivity } from "../lib/drawings";
import { getDriveFileId, isDriveFilePath, moveDriveFileToDrawingFolder } from "../lib/googleDrive";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  res.json(await db.select().from(disciplinesTable).where(isNull(disciplinesTable.deletedAt)).orderBy(asc(disciplinesTable.name)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Category name is required" });
    return;
  }
  const [existing] = await db.select({ id: disciplinesTable.id })
    .from(disciplinesTable)
    .where(sql`lower(${disciplinesTable.name}) = lower(${name}) AND ${disciplinesTable.deletedAt} IS NULL`)
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That category already exists" });
    return;
  }
  const [{ id }] = await db.insert(disciplinesTable).values({ name }).$returningId();
  const [category] = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, id)).limit(1);
  res.status(201).json(category);
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!Number.isInteger(id) || id < 1 || !name) {
    res.status(400).json({ error: "Valid category id and name are required" });
    return;
  }
  const [existing] = await db.select({ id: disciplinesTable.id })
    .from(disciplinesTable)
    .where(sql`lower(${disciplinesTable.name}) = lower(${name}) AND ${disciplinesTable.id} <> ${id} AND ${disciplinesTable.deletedAt} IS NULL`)
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That category already exists" });
    return;
  }
  const [currentCategory] = await db.select().from(disciplinesTable)
    .where(sql`${disciplinesTable.id} = ${id} AND ${disciplinesTable.deletedAt} IS NULL`)
    .limit(1);
  if (!currentCategory) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await db.update(disciplinesTable)
    .set({ name })
    .where(sql`${disciplinesTable.id} = ${id} AND ${disciplinesTable.deletedAt} IS NULL`);
  const [category] = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, id)).limit(1);
  const affectedDrawings = await db.select({
    id: drawingsTable.id,
    title: drawingsTable.title,
    projectName: drawingsTable.projectName,
    drawingNumber: drawingsTable.drawingNumber,
    discipline: drawingsTable.discipline,
    deletedAt: drawingsTable.deletedAt,
  })
    .from(drawingsTable)
    .where(eq(drawingsTable.discipline, currentCategory.name));
  await db.update(drawingsTable)
    .set({ discipline: name })
    .where(eq(drawingsTable.discipline, currentCategory.name));
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
      `${drawing.title} changed category from ${currentCategory.name} to ${name}`,
      drawing.id,
      String(user.id),
      user.name,
    );
  }
  res.json(category);
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Valid category id is required" });
    return;
  }
  const [category] = await db.select().from(disciplinesTable)
    .where(sql`${disciplinesTable.id} = ${id} AND ${disciplinesTable.deletedAt} IS NULL`)
    .limit(1);
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const [used] = await db.select({ id: drawingsTable.id })
    .from(drawingsTable)
    .where(and(eq(drawingsTable.discipline, category.name), isNull(drawingsTable.deletedAt)))
    .limit(1);
  if (used) {
    res.status(409).json({ error: "This category is used by existing drawings and cannot be deleted" });
    return;
  }
  await db.update(disciplinesTable).set({ deletedAt: new Date() }).where(eq(disciplinesTable.id, id));
  res.sendStatus(204);
});

export default router;