import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const contactsTable = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: text("contact_name"),
  type: varchar("type", { length: 100 }).notNull().default("consultant"),
  service: text("service"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  notes: text("notes"),
  createdBy: int("created_by"),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).$onUpdateFn(() => new Date()).notNull(),
});

export const contactProjectsTable = mysqlTable("contact_projects", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contact_id").notNull(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  role: text("role"),
  notes: text("notes"),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
export type ContactProject = typeof contactProjectsTable.$inferSelect;