import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { date, datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const projectsTable = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const drawingsTable = mysqlTable("drawings", {
  id: int("id").autoincrement().primaryKey(),
  drawingNumber: text("drawing_number").notNull(),
  title: text("title").notNull(),
  discipline: varchar("discipline", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  assignedTo: text("assigned_to"),
  assignedToUserId: int("assigned_to_user_id"),
  revision: text("revision").notNull().default("A"),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  sheetSize: varchar("sheet_size", { length: 20 }).notNull().default("A1"),
  author: text("author").notNull(),
  description: text("description"),
  dueDate: date("due_date", { mode: "string" }),
  issuedDate: date("issued_date", { mode: "string" }),
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  attachmentSize: int("attachment_size"),
  attachmentContentType: text("attachment_content_type"),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertDrawingSchema = createInsertSchema(drawingsTable).omit({
  id: true,
  deletedAt: true,
  updatedAt: true,
  createdAt: true,
});
export type InsertDrawing = z.infer<typeof insertDrawingSchema>;
export type Drawing = typeof drawingsTable.$inferSelect;

export const drawingActivityTable = mysqlTable("drawing_activity", {
  id: int("id").autoincrement().primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  drawingId: int("drawing_id"),
  actor: text("actor"),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const drawingUploadsTable = mysqlTable("drawing_uploads", {
  id: int("id").autoincrement().primaryKey(),
  drawingId: int("drawing_id").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: int("file_size").notNull(),
  contentType: text("content_type").notNull(),
  sha256: varchar("sha256", { length: 64 }),
  uploadedBy: text("uploaded_by").notNull(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  uploadedAt: datetime("uploaded_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertDrawingUploadSchema = createInsertSchema(drawingUploadsTable).omit({
  id: true,
  deletedAt: true,
  uploadedAt: true,
});
export type InsertDrawingUpload = z.infer<typeof insertDrawingUploadSchema>;
export type DrawingUpload = typeof drawingUploadsTable.$inferSelect;

export const drawingCommentsTable = mysqlTable("drawing_comments", {
  id: int("id").autoincrement().primaryKey(),
  drawingId: int("drawing_id").notNull(),
  comment: text("comment").notNull(),
  author: text("author").notNull(),
  authorId: int("author_id"),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertDrawingCommentSchema = createInsertSchema(drawingCommentsTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
});
export type InsertDrawingComment = z.infer<typeof insertDrawingCommentSchema>;
export type DrawingComment = typeof drawingCommentsTable.$inferSelect;

export const insertDrawingActivitySchema = createInsertSchema(drawingActivityTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDrawingActivity = z.infer<typeof insertDrawingActivitySchema>;
export type DrawingActivity = typeof drawingActivityTable.$inferSelect;