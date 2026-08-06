import { and, eq, isNull, isNotNull, lt } from "drizzle-orm";
import {
  checklistTemplatesTable,
  checklistTemplateItemsTable,
  contactProjectsTable,
  contactsTable,
  db,
  disciplinesTable,
  drawingCommentsTable,
  drawingUploadsTable,
  drawingsTable,
  personalNotesTable,
  projectChecklistItemsTable,
  projectChecklistsTable,
  projectNotesTable,
  projectsTable,
  usersTable,
} from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import type { PortalUser } from "./portalAuth";
import { deleteDriveFile, getDriveFileId, isDriveFilePath, moveDriveFileToDrawingFolder } from "./googleDrive";

export type RecycleBinType =
  | "project"
  | "drawing"
  | "upload"
  | "comment"
  | "project-note"
  | "personal-note"
  | "contact"
  | "contact-project"
  | "checklist"
  | "template"
  | "category"
  | "user";

export type RecycleBinEntry = {
  type: RecycleBinType;
  id: number;
  label: string;
  deletedAt: Date;
};

const objectStorageService = new ObjectStorageService();
const expiredBefore = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

async function deleteStoredFile(filePath: string) {
  if (isDriveFilePath(filePath)) {
    await deleteDriveFile(getDriveFileId(filePath));
  } else {
    await objectStorageService.deleteObjectEntity(filePath);
  }
}

async function restoreDeletedRow(table: any, idColumn: any, where: any): Promise<any[]> {
  const [existing] = await db.select().from(table).where(where).limit(1);
  if (!existing) return [];
  await db.update(table).set({ deletedAt: null }).where(where);
  const [restored] = await db.select().from(table).where(eq(idColumn, existing.id)).limit(1);
  return restored ? [restored] : [];
}

export async function listRecycleBin(user: PortalUser): Promise<RecycleBinEntry[]> {
  const [
    projects, drawings, uploads, comments, projectNotes, personalNotes,
    contacts, contactProjects, checklists, templates, categories, users,
  ] = await Promise.all([
    db.select({ id: projectsTable.id, label: projectsTable.name, deletedAt: projectsTable.deletedAt }).from(projectsTable).where(isNotNull(projectsTable.deletedAt)),
    db.select({ id: drawingsTable.id, label: drawingsTable.title, deletedAt: drawingsTable.deletedAt }).from(drawingsTable).where(isNotNull(drawingsTable.deletedAt)),
    db.select({ id: drawingUploadsTable.id, label: drawingUploadsTable.fileName, deletedAt: drawingUploadsTable.deletedAt }).from(drawingUploadsTable).where(isNotNull(drawingUploadsTable.deletedAt)),
    db.select({ id: drawingCommentsTable.id, label: drawingCommentsTable.comment, deletedAt: drawingCommentsTable.deletedAt }).from(drawingCommentsTable).where(isNotNull(drawingCommentsTable.deletedAt)),
    db.select({ id: projectNotesTable.id, label: projectNotesTable.content, deletedAt: projectNotesTable.deletedAt }).from(projectNotesTable).where(isNotNull(projectNotesTable.deletedAt)),
    db.select({
      id: personalNotesTable.id,
      label: personalNotesTable.title,
      userId: personalNotesTable.userId,
      deletedAt: personalNotesTable.deletedAt,
    }).from(personalNotesTable).where(isNotNull(personalNotesTable.deletedAt)),
    db.select({ id: contactsTable.id, label: contactsTable.companyName, deletedAt: contactsTable.deletedAt }).from(contactsTable).where(isNotNull(contactsTable.deletedAt)),
    db.select({ id: contactProjectsTable.id, label: contactProjectsTable.projectName, deletedAt: contactProjectsTable.deletedAt }).from(contactProjectsTable).where(isNotNull(contactProjectsTable.deletedAt)),
    db.select({ id: projectChecklistsTable.id, label: projectChecklistsTable.name, deletedAt: projectChecklistsTable.deletedAt }).from(projectChecklistsTable).where(isNotNull(projectChecklistsTable.deletedAt)),
    db.select({ id: checklistTemplatesTable.id, label: checklistTemplatesTable.name, deletedAt: checklistTemplatesTable.deletedAt }).from(checklistTemplatesTable).where(isNotNull(checklistTemplatesTable.deletedAt)),
    db.select({ id: disciplinesTable.id, label: disciplinesTable.name, deletedAt: disciplinesTable.deletedAt }).from(disciplinesTable).where(isNotNull(disciplinesTable.deletedAt)),
    db.select({ id: usersTable.id, label: usersTable.name, deletedAt: usersTable.deletedAt }).from(usersTable).where(isNotNull(usersTable.deletedAt)),
  ]);
  const entries = [
    ...projects.map((item) => ({ ...item, type: "project" as const })),
    ...drawings.map((item) => ({ ...item, type: "drawing" as const })),
    ...uploads.map((item) => ({ ...item, type: "upload" as const })),
    ...comments.map((item) => ({ ...item, type: "comment" as const })),
    ...projectNotes.map((item) => ({ ...item, type: "project-note" as const })),
    ...personalNotes.map((item) => ({ ...item, type: "personal-note" as const })),
    ...contacts.map((item) => ({ ...item, type: "contact" as const })),
    ...contactProjects.map((item) => ({ ...item, type: "contact-project" as const })),
    ...checklists.map((item) => ({ ...item, type: "checklist" as const })),
    ...templates.map((item) => ({ ...item, type: "template" as const })),
    ...categories.map((item) => ({ ...item, type: "category" as const })),
    ...users.map((item) => ({ ...item, type: "user" as const })),
  ].sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime()) as RecycleBinEntry[];

  if (user.role === "admin") return entries;

  const ownPersonalNoteIds = new Set(
    personalNotes
      .filter((note) => note.userId === user.id)
      .map((note) => note.id),
  );

  return entries.filter((entry) => {
    if (entry.type === "user") return false;
    if (entry.type === "personal-note") return ownPersonalNoteIds.has(entry.id);
    return true;
  });
}

export async function restoreRecycleBinEntry(type: RecycleBinType, id: number, user: PortalUser) {
  const isAdmin = user.role === "admin";
  switch (type) {
    case "project": return restoreDeletedRow(projectsTable, projectsTable.id, and(eq(projectsTable.id, id), isNotNull(projectsTable.deletedAt)));
    case "drawing": {
      const [drawing] = await db.select().from(drawingsTable)
        .where(and(eq(drawingsTable.id, id), isNotNull(drawingsTable.deletedAt))).limit(1);
      if (!drawing) return [];
      const restored = await restoreDeletedRow(drawingsTable, drawingsTable.id, and(eq(drawingsTable.id, id), isNotNull(drawingsTable.deletedAt)));
      const uploads = await db.select({ filePath: drawingUploadsTable.filePath })
        .from(drawingUploadsTable)
        .where(and(eq(drawingUploadsTable.drawingId, id), isNull(drawingUploadsTable.deletedAt)));
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
      return restored;
    }
    case "upload": {
      const [upload] = await db.select().from(drawingUploadsTable)
        .where(and(eq(drawingUploadsTable.id, id), isNotNull(drawingUploadsTable.deletedAt))).limit(1);
      if (!upload) return [];
      const restored = await restoreDeletedRow(drawingUploadsTable, drawingUploadsTable.id, and(eq(drawingUploadsTable.id, id), isNotNull(drawingUploadsTable.deletedAt)));
      const [drawing] = await db.select().from(drawingsTable).where(eq(drawingsTable.id, upload.drawingId)).limit(1);
      if (drawing && isDriveFilePath(upload.filePath)) {
        await moveDriveFileToDrawingFolder(getDriveFileId(upload.filePath), {
          projectName: drawing.projectName,
          category: drawing.discipline,
          drawingNumber: drawing.drawingNumber,
          drawingTitle: drawing.title,
        });
      }
      return restored;
    }
    case "comment": return restoreDeletedRow(drawingCommentsTable, drawingCommentsTable.id, and(eq(drawingCommentsTable.id, id), isNotNull(drawingCommentsTable.deletedAt)));
    case "project-note": return restoreDeletedRow(projectNotesTable, projectNotesTable.id, and(eq(projectNotesTable.id, id), isNotNull(projectNotesTable.deletedAt)));
    case "personal-note": return restoreDeletedRow(personalNotesTable, personalNotesTable.id, and(
      eq(personalNotesTable.id, id),
      isNotNull(personalNotesTable.deletedAt),
      ...(isAdmin ? [] : [eq(personalNotesTable.userId, user.id)]),
    ));
    case "contact": return restoreDeletedRow(contactsTable, contactsTable.id, and(eq(contactsTable.id, id), isNotNull(contactsTable.deletedAt)));
    case "contact-project": return restoreDeletedRow(contactProjectsTable, contactProjectsTable.id, and(eq(contactProjectsTable.id, id), isNotNull(contactProjectsTable.deletedAt)));
    case "checklist": return restoreDeletedRow(projectChecklistsTable, projectChecklistsTable.id, and(eq(projectChecklistsTable.id, id), isNotNull(projectChecklistsTable.deletedAt)));
    case "template": return restoreDeletedRow(checklistTemplatesTable, checklistTemplatesTable.id, and(eq(checklistTemplatesTable.id, id), isNotNull(checklistTemplatesTable.deletedAt)));
    case "category": return restoreDeletedRow(disciplinesTable, disciplinesTable.id, and(eq(disciplinesTable.id, id), isNotNull(disciplinesTable.deletedAt)));
    case "user": {
      if (!isAdmin) return [];
      const [existing] = await db.select().from(usersTable)
        .where(and(eq(usersTable.id, id), isNotNull(usersTable.deletedAt))).limit(1);
      if (!existing) return [];
      await db.update(usersTable).set({ deletedAt: null, active: true }).where(eq(usersTable.id, id));
      const [restored] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
      return restored ? [restored] : [];
    }
  }
}

export async function purgeExpiredRecycleBin() {
  const before = expiredBefore();
  const expiredDrawings = await db.select({ id: drawingsTable.id }).from(drawingsTable)
    .where(and(isNotNull(drawingsTable.deletedAt), lt(drawingsTable.deletedAt, before)));
  for (const drawing of expiredDrawings) {
    const uploads = await db.select().from(drawingUploadsTable).where(eq(drawingUploadsTable.drawingId, drawing.id));
    for (const upload of uploads) await deleteStoredFile(upload.filePath);
    await db.delete(drawingCommentsTable).where(eq(drawingCommentsTable.drawingId, drawing.id));
    await db.delete(drawingUploadsTable).where(eq(drawingUploadsTable.drawingId, drawing.id));
    await db.delete(drawingsTable).where(eq(drawingsTable.id, drawing.id));
  }
  const expiredContacts = await db.select({ id: contactsTable.id }).from(contactsTable)
    .where(and(isNotNull(contactsTable.deletedAt), lt(contactsTable.deletedAt, before)));
  for (const contact of expiredContacts) {
    await db.delete(contactProjectsTable).where(eq(contactProjectsTable.contactId, contact.id));
    await db.delete(contactsTable).where(eq(contactsTable.id, contact.id));
  }
  await db.delete(contactProjectsTable).where(and(isNotNull(contactProjectsTable.deletedAt), lt(contactProjectsTable.deletedAt, before)));
  const expiredProjects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable)
    .where(and(isNotNull(projectsTable.deletedAt), lt(projectsTable.deletedAt, before)));
  for (const project of expiredProjects) {
    const projectDrawings = await db.select({ id: drawingsTable.id }).from(drawingsTable)
      .where(eq(drawingsTable.projectName, project.name));
    for (const drawing of projectDrawings) {
      const uploads = await db.select().from(drawingUploadsTable).where(eq(drawingUploadsTable.drawingId, drawing.id));
      for (const upload of uploads) await deleteStoredFile(upload.filePath);
      await db.delete(drawingCommentsTable).where(eq(drawingCommentsTable.drawingId, drawing.id));
      await db.delete(drawingUploadsTable).where(eq(drawingUploadsTable.drawingId, drawing.id));
      await db.delete(drawingsTable).where(eq(drawingsTable.id, drawing.id));
    }
    await db.delete(contactProjectsTable).where(eq(contactProjectsTable.projectName, project.name));
    await db.delete(projectNotesTable).where(eq(projectNotesTable.projectName, project.name));
    const projectChecklists = await db.select({ id: projectChecklistsTable.id }).from(projectChecklistsTable)
      .where(eq(projectChecklistsTable.projectName, project.name));
    for (const checklist of projectChecklists) {
      await db.delete(projectChecklistItemsTable).where(eq(projectChecklistItemsTable.projectChecklistId, checklist.id));
    }
    await db.delete(projectChecklistsTable).where(eq(projectChecklistsTable.projectName, project.name));
    await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
  }
  const expiredUploads = await db.select().from(drawingUploadsTable)
    .where(and(isNotNull(drawingUploadsTable.deletedAt), lt(drawingUploadsTable.deletedAt, before)));
  for (const upload of expiredUploads) {
    await deleteStoredFile(upload.filePath);
    await db.delete(drawingUploadsTable).where(eq(drawingUploadsTable.id, upload.id));
  }
  await db.delete(drawingCommentsTable).where(and(isNotNull(drawingCommentsTable.deletedAt), lt(drawingCommentsTable.deletedAt, before)));
  await db.delete(projectNotesTable).where(and(isNotNull(projectNotesTable.deletedAt), lt(projectNotesTable.deletedAt, before)));
  await db.delete(personalNotesTable).where(and(isNotNull(personalNotesTable.deletedAt), lt(personalNotesTable.deletedAt, before)));
  const expiredChecklists = await db.select({ id: projectChecklistsTable.id }).from(projectChecklistsTable)
    .where(and(isNotNull(projectChecklistsTable.deletedAt), lt(projectChecklistsTable.deletedAt, before)));
  for (const checklist of expiredChecklists) {
    await db.delete(projectChecklistItemsTable).where(eq(projectChecklistItemsTable.projectChecklistId, checklist.id));
    await db.delete(projectChecklistsTable).where(eq(projectChecklistsTable.id, checklist.id));
  }
  const expiredTemplates = await db.select({ id: checklistTemplatesTable.id }).from(checklistTemplatesTable)
    .where(and(isNotNull(checklistTemplatesTable.deletedAt), lt(checklistTemplatesTable.deletedAt, before)));
  for (const template of expiredTemplates) {
    await db.delete(checklistTemplateItemsTable).where(eq(checklistTemplateItemsTable.templateId, template.id));
    await db.delete(checklistTemplatesTable).where(eq(checklistTemplatesTable.id, template.id));
  }
  await db.delete(disciplinesTable).where(and(isNotNull(disciplinesTable.deletedAt), lt(disciplinesTable.deletedAt, before)));
  await db.delete(usersTable).where(and(isNotNull(usersTable.deletedAt), lt(usersTable.deletedAt, before)));
}