import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const chatChannelsTable = mysqlTable("chat_channels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdBy: int("created_by").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const chatMessagesTable = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channel_id").notNull(),
  authorId: int("author_id").notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const insertChatChannelSchema = createInsertSchema(chatChannelsTable).omit({
  id: true,
  createdAt: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannelsTable.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;