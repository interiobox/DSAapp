import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

export const galleryAlbumsTable = mysqlTable("gallery_albums", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: int("created_by").notNull(),
  uploaderName: varchar("uploader_name", { length: 255 }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const galleryMediaTable = mysqlTable("gallery_media", {
  id: int("id").autoincrement().primaryKey(),
  albumId: int("album_id").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: int("file_size").notNull(),
  contentType: varchar("content_type", { length: 255 }).notNull(),
  uploadedBy: int("uploaded_by").notNull(),
  uploaderName: varchar("uploader_name", { length: 255 }).notNull(),
  uploadedAt: datetime("uploaded_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export type GalleryAlbum = typeof galleryAlbumsTable.$inferSelect;
export type GalleryMedia = typeof galleryMediaTable.$inferSelect;