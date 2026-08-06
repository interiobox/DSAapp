import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

export const notificationsTable = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientId: int("recipient_id").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  link: text("link"),
  readAt: datetime("read_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;