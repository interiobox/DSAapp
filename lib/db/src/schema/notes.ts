import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const projectNotesTable = mysqlTable("project_notes", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: int("author_id").notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).$onUpdateFn(() => new Date()).notNull(),
});

export const personalNotesTable = mysqlTable("personal_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull().default("Personal note"),
  content: text("content").notNull(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).$onUpdateFn(() => new Date()).notNull(),
});

export const insertProjectNoteSchema = createInsertSchema(projectNotesTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type ProjectNote = typeof projectNotesTable.$inferSelect;

export const insertPersonalNoteSchema = createInsertSchema(personalNotesTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPersonalNote = z.infer<typeof insertPersonalNoteSchema>;
export type PersonalNote = typeof personalNotesTable.$inferSelect;