import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const checklistTemplatesTable = mysqlTable("checklist_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdBy: int("created_by").notNull(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).$onUpdateFn(() => new Date()).notNull(),
});

export const checklistTemplateItemsTable = mysqlTable("checklist_template_items", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  title: text("title").notNull(),
  position: int("position").notNull().default(0),
});

export const projectChecklistsTable = mysqlTable("project_checklists", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  templateId: int("template_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdBy: int("created_by").notNull(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const projectChecklistItemsTable = mysqlTable("project_checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  projectChecklistId: int("project_checklist_id").notNull(),
  title: text("title").notNull(),
  position: int("position").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  completedBy: int("completed_by"),
  completedAt: datetime("completed_at", { mode: "date" }),
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplatesTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type ChecklistTemplateItem = typeof checklistTemplateItemsTable.$inferSelect;
export type ProjectChecklist = typeof projectChecklistsTable.$inferSelect;
export type ProjectChecklistItem = typeof projectChecklistItemsTable.$inferSelect;