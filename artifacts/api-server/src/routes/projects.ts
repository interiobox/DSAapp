import { Router, type IRouter } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  contactProjectsTable,
  db,
  drawingsTable,
  projectChecklistsTable,
  projectNotesTable,
  projectsTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  CreateProjectResponse,
  ListProjectsResponse,
  UpdateProjectBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/portalAuth";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const [projects, drawings] = await Promise.all([
    db.select().from(projectsTable).where(isNull(projectsTable.deletedAt)).orderBy(asc(projectsTable.name)),
    db.select({ projectName: drawingsTable.projectName }).from(drawingsTable).where(isNull(drawingsTable.deletedAt)),
  ]);
  const allProjectNames = await db.select({ name: projectsTable.name }).from(projectsTable).where(isNull(projectsTable.deletedAt));
  const knownNames = new Set(allProjectNames.map((project) => project.name.toLocaleLowerCase()));
  const legacyNames = new Map<string, string>();
  for (const drawing of drawings) {
    const name = drawing.projectName.trim();
    const normalizedName = name.toLocaleLowerCase();
    if (name && !knownNames.has(normalizedName)) {
      legacyNames.set(normalizedName, name);
    }
  }
  const legacyProjects = Array.from(legacyNames.values())
    .sort((a, b) => a.localeCompare(b))
    .map((name, index) => ({
      id: -(index + 1),
      name,
      deletedAt: null,
      createdAt: new Date(0),
    }));
  res.json(ListProjectsResponse.parse([...projects, ...legacyProjects]));
});

router.get("/projects/recycle-bin", requireAdmin, async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable)
    .where(sql`${projectsTable.deletedAt} is not null`)
    .orderBy(asc(projectsTable.name));
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }
  // Project names are case-insensitive for the user-facing picker.
  const [existingProjects, drawings] = await Promise.all([
    db.select().from(projectsTable).where(isNull(projectsTable.deletedAt)),
    db.select({ projectName: drawingsTable.projectName }).from(drawingsTable).where(isNull(drawingsTable.deletedAt)),
  ]);
  const normalizedName = name.toLocaleLowerCase();
  const duplicate = existingProjects.some((project) => project.name.toLocaleLowerCase() === normalizedName)
    || drawings.some((drawing) => drawing.projectName.trim().toLocaleLowerCase() === normalizedName);
  if (duplicate) {
    res.status(409).json({ error: "A project with this name already exists" });
    return;
  }
  const [{ id }] = await db.insert(projectsTable).values({ name }).$returningId();
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  res.status(201).json(CreateProjectResponse.parse(project));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Valid project id is required" });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const [currentProject] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt)))
    .limit(1);
  if (!currentProject) {
    res.status(404).json({ error: "Active project not found" });
    return;
  }
  if (currentProject.name === name) {
    res.json(CreateProjectResponse.parse(currentProject));
    return;
  }

  const normalizedName = name.toLocaleLowerCase();
  const [existingProject] = await db.select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(
      isNull(projectsTable.deletedAt),
      sql`lower(${projectsTable.name}) = ${normalizedName}`,
      sql`${projectsTable.id} <> ${id}`,
    ))
    .limit(1);
  const currentProjectName = currentProject.name.toLocaleLowerCase();
  const legacyDrawing = currentProjectName === normalizedName
    ? undefined
    : (await db.select({ id: drawingsTable.id })
      .from(drawingsTable)
      .where(sql`lower(trim(${drawingsTable.projectName})) = ${normalizedName}`)
      .limit(1))[0];
  if (existingProject || legacyDrawing) {
    res.status(409).json({ error: "A project with this name already exists" });
    return;
  }

  const updatedProject = await db.transaction(async (tx) => {
    await tx.update(projectsTable)
      .set({ name })
      .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt)));
    await Promise.all([
      tx.update(drawingsTable).set({ projectName: name }).where(eq(drawingsTable.projectName, currentProject.name)),
      tx.update(projectNotesTable).set({ projectName: name }).where(eq(projectNotesTable.projectName, currentProject.name)),
      tx.update(projectChecklistsTable).set({ projectName: name }).where(eq(projectChecklistsTable.projectName, currentProject.name)),
      tx.update(contactProjectsTable).set({ projectName: name }).where(eq(contactProjectsTable.projectName, currentProject.name)),
    ]);
    const [updated] = await tx.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    return updated;
  });
  res.json(CreateProjectResponse.parse(updatedProject));
});

router.delete("/projects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Valid project id is required" });
    return;
  }
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Active project not found" });
    return;
  }
  await db.update(projectsTable).set({ deletedAt: new Date() }).where(eq(projectsTable.id, id));
  res.sendStatus(204);
});

router.post("/projects/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Valid project id is required" });
    return;
  }
  const [deletedProject] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), sql`${projectsTable.deletedAt} is not null`))
    .limit(1);
  if (!deletedProject) {
    res.status(404).json({ error: "Deleted project not found" });
    return;
  }
  const [conflict] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(
      isNull(projectsTable.deletedAt),
      sql`lower(${projectsTable.name}) = lower(${deletedProject.name})`,
    ))
    .limit(1);
  if (conflict) {
    res.status(409).json({ error: "An active project already uses this name" });
    return;
  }
  await db.update(projectsTable).set({ deletedAt: null }).where(eq(projectsTable.id, id));
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  res.json(project);
});

export default router;