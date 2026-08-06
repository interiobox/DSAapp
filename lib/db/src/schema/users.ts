import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const usersTable = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).unique(),
  passwordHash: text("password_hash"),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  active: boolean("active").notNull().default(true),
  deletedAt: datetime("deleted_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const sessionsTable = mysqlTable("portal_sessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  userId: int("user_id").notNull(),
  expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;