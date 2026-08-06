import { and, asc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";

import {
  contactProjectsTable,
  contactsTable,
  db,
  drawingsTable,
  projectsTable,
} from "@workspace/db";
import {
  AddContactProjectBody,
  AddContactProjectParams,
  CreateContactBody,
  DeleteContactParams,
  ListContactsQueryParams,
  RemoveContactProjectParams,
  UpdateContactBody,
  UpdateContactParams,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";

const router: IRouter = Router();

async function loadContact(id: number) {
  const [contact] = await db.select().from(contactsTable).where(and(eq(contactsTable.id, id), isNull(contactsTable.deletedAt))).limit(1);
  if (!contact) return null;
  const projects = await db
    .select({
      id: contactProjectsTable.id,
      projectName: contactProjectsTable.projectName,
      role: contactProjectsTable.role,
      notes: contactProjectsTable.notes,
      createdAt: contactProjectsTable.createdAt,
    })
    .from(contactProjectsTable)
    .where(and(eq(contactProjectsTable.contactId, id), isNull(contactProjectsTable.deletedAt)))
    .orderBy(asc(contactProjectsTable.projectName), asc(contactProjectsTable.id));
  return { ...contact, projects };
}

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const cleaned = value?.trim();
  return cleaned || null;
}

router.get("/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const projectName = parsed.data.projectName?.trim();
  const contacts = projectName
    ? await db
      .select({ contact: contactsTable })
      .from(contactsTable)
      .innerJoin(contactProjectsTable, eq(contactProjectsTable.contactId, contactsTable.id))
       .where(and(
         eq(contactProjectsTable.projectName, projectName),
         isNull(contactsTable.deletedAt),
         isNull(contactProjectsTable.deletedAt),
       ))
      .orderBy(asc(contactsTable.companyName), asc(contactsTable.id))
    : await db.select({ contact: contactsTable }).from(contactsTable).where(isNull(contactsTable.deletedAt)).orderBy(asc(contactsTable.companyName), asc(contactsTable.id));
  const uniqueContacts = Array.from(new Map(contacts.map(({ contact }) => [contact.id, contact])).values());
  const result = await Promise.all(uniqueContacts.map((contact) => loadContact(contact.id)));
  res.json(result.filter((contact): contact is NonNullable<typeof contact> => Boolean(contact)));
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const companyName = parsed.data.companyName.trim();
  if (!companyName) {
    res.status(400).json({ error: "Company or contact name is required" });
    return;
  }
  const [{ id }] = await db.insert(contactsTable).values({
    companyName,
    contactName: cleanOptional(parsed.data.contactName),
    type: parsed.data.type,
    service: cleanOptional(parsed.data.service),
    email: cleanOptional(parsed.data.email),
    phone: cleanOptional(parsed.data.phone),
    website: cleanOptional(parsed.data.website),
    address: cleanOptional(parsed.data.address),
    notes: cleanOptional(parsed.data.notes),
    createdBy: user.id,
  }).$returningId();
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
  if (parsed.data.projectName?.trim()) {
    await db.insert(contactProjectsTable).values({
      contactId: contact.id,
      projectName: parsed.data.projectName.trim(),
      role: cleanOptional(parsed.data.projectRole),
      notes: cleanOptional(parsed.data.projectNotes),
    });
  }
  res.status(201).json(await loadContact(contact.id));
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const params = UpdateContactParams.safeParse(req.params);
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = params.data.id;
  const [existing] = await db.select({ id: contactsTable.id }).from(contactsTable).where(and(eq(contactsTable.id, id), isNull(contactsTable.deletedAt))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  await db.update(contactsTable).set({
    ...(parsed.data.companyName !== undefined ? { companyName: parsed.data.companyName.trim() } : {}),
    ...(parsed.data.contactName !== undefined ? { contactName: cleanOptional(parsed.data.contactName) } : {}),
    ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
    ...(parsed.data.service !== undefined ? { service: cleanOptional(parsed.data.service) } : {}),
    ...(parsed.data.email !== undefined ? { email: cleanOptional(parsed.data.email) } : {}),
    ...(parsed.data.phone !== undefined ? { phone: cleanOptional(parsed.data.phone) } : {}),
    ...(parsed.data.website !== undefined ? { website: cleanOptional(parsed.data.website) } : {}),
    ...(parsed.data.address !== undefined ? { address: cleanOptional(parsed.data.address) } : {}),
    ...(parsed.data.notes !== undefined ? { notes: cleanOptional(parsed.data.notes) } : {}),
  }).where(eq(contactsTable.id, id));
  const [updated] = await db.select().from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
  res.json(await loadContact(updated.id));
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteContactParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select({ id: contactsTable.id }).from(contactsTable).where(and(eq(contactsTable.id, parsed.data.id), isNull(contactsTable.deletedAt))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  await db.update(contactsTable).set({ deletedAt: new Date() }).where(eq(contactsTable.id, parsed.data.id));
  res.sendStatus(204);
});

router.post("/contacts/:id/projects", async (req, res): Promise<void> => {
  const params = AddContactProjectParams.safeParse(req.params);
  const parsed = AddContactProjectBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [contact] = await db.select({ id: contactsTable.id }).from(contactsTable).where(and(eq(contactsTable.id, params.data.id), isNull(contactsTable.deletedAt))).limit(1);
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const projectName = parsed.data.projectName.trim();
  const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
    .where(and(eq(projectsTable.name, projectName), isNull(projectsTable.deletedAt))).limit(1);
  const [legacyProject] = await db.select({ projectName: drawingsTable.projectName }).from(drawingsTable)
    .where(and(eq(drawingsTable.projectName, projectName), isNull(drawingsTable.deletedAt))).limit(1);
  if (!project && !legacyProject) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [duplicate] = await db.select({ id: contactProjectsTable.id })
    .from(contactProjectsTable)
    .where(and(eq(contactProjectsTable.contactId, contact.id), eq(contactProjectsTable.projectName, projectName), isNull(contactProjectsTable.deletedAt)))
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "This contact is already linked to that project" });
    return;
  }
  await db.insert(contactProjectsTable).values({
    contactId: contact.id,
    projectName,
    role: cleanOptional(parsed.data.role),
    notes: cleanOptional(parsed.data.notes),
  });
  res.json(await loadContact(contact.id));
});

router.delete("/contacts/:id/projects/:projectId", async (req, res): Promise<void> => {
  const parsed = RemoveContactProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [association] = await db.select().from(contactProjectsTable)
    .where(and(eq(contactProjectsTable.id, parsed.data.projectId), eq(contactProjectsTable.contactId, parsed.data.id), isNull(contactProjectsTable.deletedAt)))
    .limit(1);
  if (!association) {
    res.status(404).json({ error: "Project association not found" });
    return;
  }
  await db.update(contactProjectsTable).set({ deletedAt: new Date() }).where(eq(contactProjectsTable.id, association.id));
  res.json(await loadContact(parsed.data.id));
});

export default router;