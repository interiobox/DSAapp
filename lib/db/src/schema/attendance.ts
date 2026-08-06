import { sql } from "drizzle-orm";
import { date, datetime, double, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const attendanceRecordsTable = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull(),
  attendanceDate: date("attendance_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  reason: text("reason"),
  recordedBy: int("recorded_by").notNull(),
  latitude: double("latitude"),
  longitude: double("longitude"),
  accuracyMeters: double("accuracy_meters"),
  selfCheckinAt: datetime("self_checkin_at", { mode: "date" }),
  recordedAt: datetime("recorded_at", { mode: "date" }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).default(sql`(now())`).$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  employeeDateUnique: uniqueIndex("attendance_employee_date_unique").on(table.employeeId, table.attendanceDate),
}));

export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;