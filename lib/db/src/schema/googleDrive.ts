import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const googleDriveConnectionsTable = mysqlTable("google_drive_connections", {
  id: int("id").primaryKey(),
  accountEmail: varchar("account_email", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  accessTokenEncrypted: text("access_token_encrypted"),
  accessTokenExpiresAt: datetime("access_token_expires_at", { mode: "date" }),
  rootFolderId: varchar("root_folder_id", { length: 255 }).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export const googleDriveOAuthSettingsTable = mysqlTable("google_drive_oauth_settings", {
  id: int("id").primaryKey(),
  clientJsonEncrypted: text("client_json_encrypted").notNull(),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).notNull(),
});

export type GoogleDriveConnection = typeof googleDriveConnectionsTable.$inferSelect;