import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const disciplinesTable = mysqlTable("disciplines", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertDisciplineSchema = createInsertSchema(disciplinesTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
});

export type InsertDiscipline = z.infer<typeof insertDisciplineSchema>;
export type Discipline = typeof disciplinesTable.$inferSelect;