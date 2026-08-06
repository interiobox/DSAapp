import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const chatChannelsTable = mysqlTable("chat_channels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdBy: int("created_by").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const chatChannelMembersTable = mysqlTable("chat_channel_members", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channel_id").notNull(),
  userId: int("user_id").notNull(),
  joinedAt: datetime("joined_at", { mode: "date" }).default(sql`(now())`).notNull(),
}, (table) => ({
  channelUserUnique: uniqueIndex("chat_channel_user_unique").on(table.channelId, table.userId),
}));

export const chatMessagesTable = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channel_id").notNull(),
  authorId: int("author_id").notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  attachmentPath: text("attachment_path"),
  attachmentName: varchar("attachment_name", { length: 255 }),
  attachmentSize: int("attachment_size"),
  attachmentContentType: varchar("attachment_content_type", { length: 255 }),
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
export const insertChatChannelMemberSchema = createInsertSchema(chatChannelMembersTable).omit({
  id: true,
  joinedAt: true,
});

export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannelsTable.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatChannelMember = z.infer<typeof insertChatChannelMemberSchema>;
export type ChatChannelMember = typeof chatChannelMembersTable.$inferSelect;