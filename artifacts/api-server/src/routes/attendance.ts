import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";

import {
  attendanceRecordsTable,
  db,
  usersTable,
} from "@workspace/db";
import {
  GetMyAttendanceResponse,
  ListAttendanceResponse,
  RecordAttendanceBody,
  RecordAttendanceParams,
  RecordAttendanceResponse,
  SelfCheckinAttendanceBody,
  SelfCheckinAttendanceResponse,
  GetMyAttendanceMonthResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireCurrentUser } from "../lib/portalAuth";

const router: IRouter = Router();
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ATTENDANCE_STATUSES = new Set(["present", "late", "absent", "leave", "remote"]);

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromDateInput(value: Date | string | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && DATE_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
  }
  return null;
}

function invalidDateMessage(date: string | null) {
  if (!date) return "Use a valid attendance date in YYYY-MM-DD format.";
  if (date > todayUtc()) return "Attendance cannot be recorded for a future date.";
  return null;
}

async function loadAttendance(date: string) {
  const entries = await db
    .select({
      employeeId: usersTable.id,
      employeeName: usersTable.name,
      username: usersTable.username,
      attendanceDate: attendanceRecordsTable.attendanceDate,
      status: attendanceRecordsTable.status,
      reason: attendanceRecordsTable.reason,
      recordedBy: attendanceRecordsTable.recordedBy,
      recordedAt: attendanceRecordsTable.recordedAt,
      updatedAt: attendanceRecordsTable.updatedAt,
      latitude: attendanceRecordsTable.latitude,
      longitude: attendanceRecordsTable.longitude,
      accuracyMeters: attendanceRecordsTable.accuracyMeters,
      selfCheckinAt: attendanceRecordsTable.selfCheckinAt,
    })
    .from(usersTable)
    .leftJoin(
      attendanceRecordsTable,
      and(
        eq(attendanceRecordsTable.employeeId, usersTable.id),
        eq(attendanceRecordsTable.attendanceDate, date),
      ),
    )
    .where(and(eq(usersTable.active, true), isNull(usersTable.deletedAt)))
    .orderBy(asc(usersTable.name), asc(usersTable.id));
  return entries.map((entry) => ({
    ...entry,
    attendanceDate: entry.attendanceDate ?? date,
  }));
}

async function loadMyAttendanceMonth(userId: number, month: string) {
  const startDate = `${month}-01`;
  const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const entries = await db
    .select({
      employeeId: usersTable.id,
      employeeName: usersTable.name,
      username: usersTable.username,
      attendanceDate: attendanceRecordsTable.attendanceDate,
      status: attendanceRecordsTable.status,
      reason: attendanceRecordsTable.reason,
      recordedBy: attendanceRecordsTable.recordedBy,
      recordedAt: attendanceRecordsTable.recordedAt,
      updatedAt: attendanceRecordsTable.updatedAt,
      latitude: attendanceRecordsTable.latitude,
      longitude: attendanceRecordsTable.longitude,
      accuracyMeters: attendanceRecordsTable.accuracyMeters,
      selfCheckinAt: attendanceRecordsTable.selfCheckinAt,
    })
    .from(attendanceRecordsTable)
    .innerJoin(usersTable, eq(attendanceRecordsTable.employeeId, usersTable.id))
    .where(and(
      eq(attendanceRecordsTable.employeeId, userId),
      gte(attendanceRecordsTable.attendanceDate, startDate),
      lte(attendanceRecordsTable.attendanceDate, endDate),
    ))
    .orderBy(asc(attendanceRecordsTable.attendanceDate));
  return entries;
}

router.get("/attendance/me", async (req, res): Promise<void> => {
  const rawDate = typeof req.query.date === "string"
    ? req.query.date
    : Array.isArray(req.query.date) && typeof req.query.date[0] === "string"
      ? req.query.date[0]
      : null;
  const date = dateFromDateInput(rawDate ?? undefined);
  const dateError = invalidDateMessage(date);
  if (dateError) {
    res.status(400).json({ error: "A valid date is required." });
    return;
  }
  const user = requireCurrentUser(req);
  const result = (await loadAttendance(date as string)).filter((entry) => entry.employeeId === user.id);
  res.json(GetMyAttendanceResponse.parse(result));
});

router.get("/attendance/me/month", async (req, res): Promise<void> => {
  const rawMonth = typeof req.query.month === "string"
    ? req.query.month
    : Array.isArray(req.query.month) && typeof req.query.month[0] === "string"
      ? req.query.month[0]
      : null;
  if (!rawMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
    res.status(400).json({ error: "Use a valid attendance month in YYYY-MM format." });
    return;
  }
  if (rawMonth > todayUtc().slice(0, 7)) {
    res.status(400).json({ error: "Attendance cannot be viewed for a future month." });
    return;
  }
  const user = requireCurrentUser(req);
  const result = await loadMyAttendanceMonth(user.id, rawMonth);
  res.json(GetMyAttendanceMonthResponse.parse(result));
});

router.post("/attendance/self-checkin", async (req, res): Promise<void> => {
  const parsed = SelfCheckinAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid location coordinates and accuracy are required." });
    return;
  }
  const date = dateFromDateInput(parsed.data.attendanceDate);
  const dateError = invalidDateMessage(date);
  if (dateError) {
    res.status(400).json({ error: dateError });
    return;
  }
  if (date !== todayUtc()) {
    res.status(400).json({ error: "Employees can only self-check in for the current day." });
    return;
  }
  const user = requireCurrentUser(req);
  const [existing] = await db
    .select({ id: attendanceRecordsTable.id })
    .from(attendanceRecordsTable)
    .where(and(
      eq(attendanceRecordsTable.employeeId, user.id),
      eq(attendanceRecordsTable.attendanceDate, date as string),
    ))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "You have already checked in for this date. Ask an administrator to correct the record." });
    return;
  }
  await db.insert(attendanceRecordsTable).values({
    employeeId: user.id,
    attendanceDate: date as string,
    status: parsed.data.workLocation === "remote" ? "remote" : "present",
    reason: `${parsed.data.workLocation === "remote" ? "Working remotely" : "Present in office"} · Self-check-in with location evidence`,
    recordedBy: user.id,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accuracyMeters: parsed.data.accuracyMeters,
    selfCheckinAt: new Date(),
  });
  const [created] = (await loadAttendance(date as string)).filter((entry) => entry.employeeId === user.id);
  res.status(201).json(SelfCheckinAttendanceResponse.parse(created));
});

router.get("/attendance", requireAdmin, async (req, res): Promise<void> => {
  const rawDate = typeof req.query.date === "string"
    ? req.query.date
    : Array.isArray(req.query.date) && typeof req.query.date[0] === "string"
      ? req.query.date[0]
      : null;
  const date = dateFromDateInput(rawDate ?? undefined);
  const dateError = invalidDateMessage(date);
  if (dateError) {
    res.status(400).json({ error: "A valid date is required." });
    return;
  }
  const result = await loadAttendance(date as string);
  res.json(ListAttendanceResponse.parse(result));
});

router.put("/attendance/:employeeId", requireAdmin, async (req, res): Promise<void> => {
  const params = RecordAttendanceParams.safeParse(req.params);
  const parsed = RecordAttendanceBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Employee, date, and attendance status are required." });
    return;
  }
  const date = dateFromDateInput(parsed.data.attendanceDate);
  const dateError = invalidDateMessage(date);
  if (dateError) {
    res.status(400).json({ error: dateError });
    return;
  }
  if (!ATTENDANCE_STATUSES.has(parsed.data.status)) {
    res.status(400).json({ error: "Choose a valid attendance status." });
    return;
  }
  const reason = parsed.data.reason?.trim() || null;
  if ((parsed.data.status === "absent" || parsed.data.status === "leave") && !reason) {
    res.status(400).json({ error: "A reason is required when marking someone absent or on leave." });
    return;
  }
  const [employee] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, params.data.employeeId), eq(usersTable.active, true), isNull(usersTable.deletedAt)))
    .limit(1);
  if (!employee) {
    res.status(404).json({ error: "Active employee not found." });
    return;
  }
  const [existing] = await db
    .select({
      id: attendanceRecordsTable.id,
      latitude: attendanceRecordsTable.latitude,
      longitude: attendanceRecordsTable.longitude,
      accuracyMeters: attendanceRecordsTable.accuracyMeters,
      selfCheckinAt: attendanceRecordsTable.selfCheckinAt,
    })
    .from(attendanceRecordsTable)
    .where(and(
      eq(attendanceRecordsTable.employeeId, employee.id),
      eq(attendanceRecordsTable.attendanceDate, date as string),
    ))
    .limit(1);
  if (!existing) {
    res.status(409).json({ error: "Attendance can only be marked by the employee using location capture and self-check-in." });
    return;
  }
  if (
    existing.latitude === null
    || existing.longitude === null
    || existing.accuracyMeters === null
    || existing.selfCheckinAt === null
  ) {
    res.status(409).json({ error: "This attendance record has no location-backed self-check-in and cannot be corrected here." });
    return;
  }
  const user = requireCurrentUser(req);
  await db.update(attendanceRecordsTable).set({
    status: parsed.data.status,
    reason,
    recordedBy: user.id,
    updatedAt: new Date(),
  }).where(eq(attendanceRecordsTable.id, existing.id));
  const [updated] = (await loadAttendance(date as string)).filter((entry) => entry.employeeId === employee.id);
  res.json(RecordAttendanceResponse.parse(updated));
});

export default router;