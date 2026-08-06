import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { chatChannelMembersTable, db, notificationsTable, usersTable } from "@workspace/db";

type NotificationInput = {
  recipientId: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

export async function createNotification(input: NotificationInput) {
  await db.insert(notificationsTable).values({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link ?? null,
  });
}

export async function notifyUserByName(name: string | null | undefined, input: Omit<NotificationInput, "recipientId">, excludeUserId?: number) {
  const trimmed = name?.trim();
  if (!trimmed) return;
  const [user] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(and(sql`lower(${usersTable.name}) = lower(${trimmed})`, eq(usersTable.active, true)))
    .orderBy(usersTable.id)
    .limit(1);
  if (user && user.id !== excludeUserId) {
    await createNotification({ ...input, recipientId: user.id });
  }
}

export async function notifyMentions(content: string, input: Omit<NotificationInput, "recipientId">, excludeUserId?: number) {
  const usernames = Array.from(new Set(Array.from(content.matchAll(/@([a-z0-9._-]+)/gi), (match) => match[1].toLowerCase())));
  if (!usernames.length) return;
  const users = await db.select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(and(
      eq(usersTable.active, true),
      sql`lower(${usersTable.username}) IN (${sql.join(usernames.map((username) => sql`${username}`), sql`, `)})`,
    ));
  await Promise.all(users.filter((user) => user.id !== excludeUserId).map((user) => createNotification({
    ...input,
    recipientId: user.id,
    message: input.message.replace("{mention}", `@${user.username}`),
  })));
}

export async function notifyChatChannelMembers(
  channelId: number,
  channelName: string,
  senderName: string,
  content: string,
  attachmentName: string | null | undefined,
  excludeUserId?: number,
) {
  const mentionedUsernames = new Set(
    Array.from(content.matchAll(/@([a-z0-9._-]+)/gi), (match) => match[1].toLowerCase()),
  );
  const members = await db.select({
    id: usersTable.id,
    username: usersTable.username,
  })
    .from(chatChannelMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, chatChannelMembersTable.userId))
    .where(and(
      eq(chatChannelMembersTable.channelId, channelId),
      eq(usersTable.active, true),
    ));
  const preview = content || (attachmentName ? `sent ${attachmentName}` : "sent a new message");
  await Promise.all(members
    .filter((member) => member.id !== excludeUserId && !mentionedUsernames.has(member.username?.toLowerCase() ?? ""))
    .map((member) => createNotification({
      recipientId: member.id,
      type: "chat_message",
      title: `New message in #${channelName}`,
      message: `${senderName}: ${preview}`,
      link: "/chat",
    })));
}

export async function notifyDrawingAssignee(drawingId: number, assignedTo: string | null | undefined, input: Omit<NotificationInput, "recipientId">, excludeUserId?: number) {
  await notifyUserByName(assignedTo, { ...input, link: input.link ?? `/drawings/${drawingId}` }, excludeUserId);
}

export async function notifyUserById(userId: number | null | undefined, input: Omit<NotificationInput, "recipientId">, excludeUserId?: number) {
  if (!userId || userId === excludeUserId) return;
  const [user] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.active, true)))
    .limit(1);
  if (user) await createNotification({ ...input, recipientId: user.id });
}

export async function notifyDrawingAssigneeById(drawingId: number, userId: number | null | undefined, assignedTo: string | null | undefined, input: Omit<NotificationInput, "recipientId">, excludeUserId?: number) {
  if (userId) {
    await notifyUserById(userId, { ...input, link: input.link ?? `/drawings/${drawingId}` }, excludeUserId);
  } else {
    await notifyDrawingAssignee(drawingId, assignedTo, input, excludeUserId);
  }
}

export async function safelyNotify(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error("Notification delivery failed", error);
  }
}

export async function listUserNotifications(userId: number) {
  return db.select().from(notificationsTable)
    .where(eq(notificationsTable.recipientId, userId))
    .orderBy(asc(notificationsTable.readAt), desc(notificationsTable.createdAt), desc(notificationsTable.id));
}

export async function markNotificationRead(notificationId: number, userId: number) {
  await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.recipientId, userId), isNull(notificationsTable.readAt)))
  const [notification] = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.recipientId, userId)))
    .limit(1);
  if (notification) return notification;
  const [alreadyRead] = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.recipientId, userId)))
    .limit(1);
  return alreadyRead;
}