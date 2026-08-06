import { and, asc, desc, eq, isNull, or, sql, like } from "drizzle-orm";
import { db, chatChannelsTable, chatMessagesTable, drawingActivityTable, drawingsTable } from "@workspace/db";

export function getIdParam(value: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(raw, 10);
}

export function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export function projectDrawing(row: typeof drawingsTable.$inferSelect) {
  return row;
}

export async function addActivity(
  type: string,
  message: string,
  drawingId?: number,
  actor?: string,
  actorName?: string,
): Promise<void> {
  await db.insert(drawingActivityTable).values({ type, message, drawingId, actor: actor ?? null });
  if (drawingId === undefined || actor === undefined || actorName === undefined) return;

  let [channel] = await db
    .select({ id: chatChannelsTable.id })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.name, "drawing-reviews"))
    .limit(1);
  if (!channel) {
    await db.insert(chatChannelsTable).values({
      name: "drawing-reviews",
      description: "Questions and decisions about drawing reviews",
      createdBy: Number(actor),
    }).onDuplicateKeyUpdate({ set: { name: sql`${chatChannelsTable.name}` } });
    [channel] = await db
      .select({ id: chatChannelsTable.id })
      .from(chatChannelsTable)
      .where(eq(chatChannelsTable.name, "drawing-reviews"))
      .limit(1);
  }
  if (!channel) throw new Error("The drawing-reviews chat channel could not be created");

  await db.insert(chatMessagesTable).values({
    channelId: channel.id,
    authorId: Number(actor),
    authorName: actorName,
    content: `Drawing update · ${message}`,
  });
}

export async function getDashboard() {
  const rows = await db.select().from(drawingsTable).where(isNull(drawingsTable.deletedAt));
  const today = new Date().toISOString().slice(0, 10);
  const byCategory: Record<string, number> = {};
  for (const row of rows) byCategory[row.discipline] = (byCategory[row.discipline] ?? 0) + 1;
  return {
    totalDrawings: rows.length,
    inReview: rows.filter((row) => row.status === "in_review").length,
    approved: rows.filter((row) => row.status === "approved").length,
    issued: rows.filter((row) => row.status === "issued").length,
    overdue: rows.filter((row) => row.dueDate && row.dueDate < today && row.status !== "issued" && row.status !== "superseded").length,
    byCategory,
  };
}

export async function listDrawingRows(filters: {
  search?: string;
  status?: string;
  discipline?: string;
  project?: string;
  revision?: string;
  assignedTo?: string;
  due?: "all" | "overdue" | "upcoming" | "none";
}) {
  const conditions = [];
  conditions.push(isNull(drawingsTable.deletedAt));
  if (filters.search) {
    const search = `%${filters.search}%`;
    conditions.push(
      or(
        like(drawingsTable.drawingNumber, search),
        like(drawingsTable.title, search),
        like(drawingsTable.projectName, search),
        like(drawingsTable.author, search),
        like(drawingsTable.discipline, search),
        like(drawingsTable.revision, search),
        like(drawingsTable.status, search),
        like(drawingsTable.assignedTo, search),
      ),
    );
  }
  if (filters.status) conditions.push(eq(drawingsTable.status, filters.status));
  if (filters.discipline) conditions.push(eq(drawingsTable.discipline, filters.discipline));
  if (filters.project) conditions.push(eq(drawingsTable.projectName, filters.project));
  if (filters.revision) conditions.push(like(drawingsTable.revision, `%${filters.revision}%`));
  if (filters.assignedTo === "unassigned") conditions.push(isNull(drawingsTable.assignedTo));
  else if (filters.assignedTo) conditions.push(eq(drawingsTable.assignedTo, filters.assignedTo));
  if (filters.due === "none") conditions.push(isNull(drawingsTable.dueDate));
  if (filters.due === "overdue") {
    conditions.push(sql`${drawingsTable.dueDate} < current_date()`);
    conditions.push(sql`${drawingsTable.status} not in ('issued', 'superseded')`);
  }
  if (filters.due === "upcoming") {
    conditions.push(sql`${drawingsTable.dueDate} >= current_date()`);
    conditions.push(sql`${drawingsTable.status} not in ('issued', 'superseded')`);
  }
  return db
    .select()
    .from(drawingsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(drawingsTable.drawingNumber));
}