import { Router, type IRouter } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  checklistTemplateItemsTable,
  checklistTemplatesTable,
  db,
  projectChecklistItemsTable,
  projectChecklistsTable,
  projectsTable,
} from "@workspace/db";
import {
  ApplyChecklistTemplateBody,
  CreateChecklistTemplateBody,
  DeleteChecklistTemplateParams,
  DeleteProjectChecklistParams,
  ListProjectChecklistsQueryParams,
  ToggleProjectChecklistItemParams,
  ToggleProjectChecklistItemBody,
  UpdateChecklistTemplateBody,
  UpdateChecklistTemplateParams,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";

const router: IRouter = Router();

async function loadTemplate(id: number) {
  const [template] = await db.select().from(checklistTemplatesTable).where(and(eq(checklistTemplatesTable.id, id), isNull(checklistTemplatesTable.deletedAt))).limit(1);
  if (!template) return null;
  const items = await db.select().from(checklistTemplateItemsTable)
    .where(eq(checklistTemplateItemsTable.templateId, id))
    .orderBy(asc(checklistTemplateItemsTable.position), asc(checklistTemplateItemsTable.id));
  return { ...template, items };
}

async function loadProjectChecklist(id: number) {
  const [checklist] = await db.select().from(projectChecklistsTable).where(and(eq(projectChecklistsTable.id, id), isNull(projectChecklistsTable.deletedAt))).limit(1);
  if (!checklist) return null;
  const items = await db.select().from(projectChecklistItemsTable)
    .where(eq(projectChecklistItemsTable.projectChecklistId, id))
    .orderBy(asc(projectChecklistItemsTable.position), asc(projectChecklistItemsTable.id));
  return { ...checklist, items };
}

function parseItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
}

router.get("/checklist-templates", async (_req, res): Promise<void> => {
  const templates = await db.select().from(checklistTemplatesTable).where(isNull(checklistTemplatesTable.deletedAt)).orderBy(asc(checklistTemplatesTable.name));
  const result = await Promise.all(templates.map((template) => loadTemplate(template.id)));
  res.json(result.filter((template): template is NonNullable<typeof template> => Boolean(template)));
});

router.post("/checklist-templates", async (req, res): Promise<void> => {
  const parsed = CreateChecklistTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const name = parsed.data.name.trim();
  const items = parseItems(parsed.data.items);
  if (!name || items.length === 0) {
    res.status(400).json({ error: "Template name and at least one checklist item are required" });
    return;
  }
  const [duplicate] = await db.select({ id: checklistTemplatesTable.id })
    .from(checklistTemplatesTable)
    .where(sql`lower(${checklistTemplatesTable.name}) = lower(${name}) AND ${checklistTemplatesTable.deletedAt} IS NULL`)
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "A checklist template with this name already exists" });
    return;
  }
  const [{ id }] = await db.insert(checklistTemplatesTable).values({
    name,
    description: parsed.data.description?.trim() || null,
    createdBy: user.id,
  }).$returningId();
  const [template] = await db.select().from(checklistTemplatesTable).where(eq(checklistTemplatesTable.id, id)).limit(1);
  await db.insert(checklistTemplateItemsTable).values(items.map((title, position) => ({
    templateId: template.id,
    title,
    position,
  })));
  res.status(201).json(await loadTemplate(template.id));
});

router.patch("/checklist-templates/:id", async (req, res): Promise<void> => {
  const params = UpdateChecklistTemplateParams.safeParse(req.params);
  const parsed = UpdateChecklistTemplateBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: !params.success ? params.error.message : "Invalid checklist template" });
    return;
  }
  const name = parsed.data.name.trim();
  const items = parseItems(parsed.data.items);
  if (!name || items.length === 0) {
    res.status(400).json({ error: "Template name and at least one checklist item are required" });
    return;
  }
  const [existing] = await db.select().from(checklistTemplatesTable)
    .where(and(eq(checklistTemplatesTable.id, params.data.id), isNull(checklistTemplatesTable.deletedAt))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Checklist template not found" });
    return;
  }
  const [duplicate] = await db.select({ id: checklistTemplatesTable.id })
    .from(checklistTemplatesTable)
    .where(sql`lower(${checklistTemplatesTable.name}) = lower(${name}) AND ${checklistTemplatesTable.id} <> ${params.data.id} AND ${checklistTemplatesTable.deletedAt} IS NULL`)
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "A checklist template with this name already exists" });
    return;
  }
  await db.update(checklistTemplatesTable).set({
    name,
    description: parsed.data.description?.trim() || null,
  }).where(eq(checklistTemplatesTable.id, params.data.id));
  await db.delete(checklistTemplateItemsTable).where(eq(checklistTemplateItemsTable.templateId, params.data.id));
  await db.insert(checklistTemplateItemsTable).values(items.map((title, position) => ({
    templateId: params.data.id,
    title,
    position,
  })));
  res.json(await loadTemplate(params.data.id));
});

router.delete("/checklist-templates/:id", async (req, res): Promise<void> => {
  const parsed = DeleteChecklistTemplateParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [template] = await db.select({ id: checklistTemplatesTable.id })
    .from(checklistTemplatesTable).where(and(eq(checklistTemplatesTable.id, parsed.data.id), isNull(checklistTemplatesTable.deletedAt))).limit(1);
  if (!template) {
    res.status(404).json({ error: "Checklist template not found" });
    return;
  }
  await db.update(checklistTemplatesTable).set({ deletedAt: new Date() }).where(eq(checklistTemplatesTable.id, parsed.data.id));
  res.sendStatus(204);
});

router.get("/project-checklists", async (req, res): Promise<void> => {
  const parsed = ListProjectChecklistsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const checklists = await db.select().from(projectChecklistsTable)
    .where(and(
      isNull(projectChecklistsTable.deletedAt),
      ...(parsed.data.projectName ? [eq(projectChecklistsTable.projectName, parsed.data.projectName)] : []),
    ))
    .orderBy(asc(projectChecklistsTable.projectName), asc(projectChecklistsTable.name));
  const result = await Promise.all(checklists.map((checklist) => loadProjectChecklist(checklist.id)));
  res.json(result.filter((checklist): checklist is NonNullable<typeof checklist> => Boolean(checklist)));
});

router.post("/project-checklists", async (req, res): Promise<void> => {
  const parsed = ApplyChecklistTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const projectName = parsed.data.projectName.trim();
  const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
    .where(sql`lower(${projectsTable.name}) = lower(${projectName}) AND ${projectsTable.deletedAt} IS NULL`).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const template = await loadTemplate(parsed.data.templateId);
  if (!template) {
    res.status(404).json({ error: "Checklist template not found" });
    return;
  }
  const [{ id }] = await db.insert(projectChecklistsTable).values({
    projectName: project.name,
    templateId: template.id,
    name: template.name,
    createdBy: user.id,
  }).$returningId();
  const [checklist] = await db.select().from(projectChecklistsTable).where(eq(projectChecklistsTable.id, id)).limit(1);
  await db.insert(projectChecklistItemsTable).values(template.items.map((item) => ({
    projectChecklistId: checklist.id,
    title: item.title,
    position: item.position,
  })));
  res.status(201).json(await loadProjectChecklist(checklist.id));
});

router.delete("/project-checklists/:id", async (req, res): Promise<void> => {
  const parsed = DeleteProjectChecklistParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [checklist] = await db.select({ id: projectChecklistsTable.id })
    .from(projectChecklistsTable).where(and(eq(projectChecklistsTable.id, parsed.data.id), isNull(projectChecklistsTable.deletedAt))).limit(1);
  if (!checklist) {
    res.status(404).json({ error: "Project checklist not found" });
    return;
  }
  await db.update(projectChecklistsTable).set({ deletedAt: new Date() }).where(eq(projectChecklistsTable.id, parsed.data.id));
  res.sendStatus(204);
});

router.patch("/project-checklists/:id/items/:itemId", async (req, res): Promise<void> => {
  const params = ToggleProjectChecklistItemParams.safeParse(req.params);
  const parsed = ToggleProjectChecklistItemBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: !params.success ? params.error.message : "Invalid checklist item update" });
    return;
  }
  const user = requireCurrentUser(req);
  const [item] = await db.select().from(projectChecklistItemsTable).where(and(
    eq(projectChecklistItemsTable.id, params.data.itemId),
    eq(projectChecklistItemsTable.projectChecklistId, params.data.id),
    sql`EXISTS (SELECT 1 FROM project_checklists WHERE project_checklists.id = ${projectChecklistItemsTable.projectChecklistId} AND project_checklists.deleted_at IS NULL)`,
  )).limit(1);
  if (!item) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }
  await db.update(projectChecklistItemsTable).set({
    completed: parsed.data.completed,
    completedBy: parsed.data.completed ? user.id : null,
    completedAt: parsed.data.completed ? new Date() : null,
  }).where(eq(projectChecklistItemsTable.id, item.id));
  res.json(await loadProjectChecklist(params.data.id));
});

export default router;