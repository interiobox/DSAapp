import { Router, type IRouter } from "express";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import {
  chatChannelMembersTable,
  chatChannelsTable,
  chatMessagesTable,
  chatMessageReactionsTable,
  db,
  usersTable,
} from "@workspace/db";
import {
  CreateChatChannelBody,
  CreateChatMessageBody,
  CreateChatDirectMessageBody,
  DeleteChatMessageParams,
  JoinChatChannelParams,
  LeaveChatChannelParams,
  ListChatChannelMembersParams,
  ListChatMessagesParams,
  MarkChatChannelReadParams,
  SearchChatMessagesQueryParams,
  ToggleChatMessageReactionBody,
  ToggleChatMessageReactionParams,
  UpdateChatMessageBody,
  UpdateChatMessageParams,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";
import { notifyChatChannelMembers, notifyMentions, safelyNotify } from "../lib/notifications";

const router: IRouter = Router();
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

async function ensureDefaultChannels(userId: number) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(chatChannelsTable);
  if (Number(count) === 0) {
    await db.insert(chatChannelsTable).values([
      { name: "general", description: "Announcements and everyday team conversation", createdBy: userId },
      { name: "site-coordination", description: "Site updates, access, and coordination", createdBy: userId },
      { name: "drawing-reviews", description: "Questions and decisions about drawing reviews", createdBy: userId },
    ]);
  }
}

async function getUnreadCount(channelId: number, userId: number, lastReadAt: Date | null) {
  if (!lastReadAt) return 0;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.channelId, channelId),
      sql`${chatMessagesTable.createdAt} > ${lastReadAt}`,
      sql`${chatMessagesTable.authorId} <> ${userId}`,
      sql`${chatMessagesTable.deletedAt} is null`,
    ));
  return Number(count);
}

async function getReactionSummary(messageId: number, userId: number) {
  const reactions = await db.select({
    emoji: chatMessageReactionsTable.emoji,
    count: sql<number>`count(*)`,
    reacted: sql<boolean>`max(${chatMessageReactionsTable.userId} = ${userId})`,
  }).from(chatMessageReactionsTable)
    .where(eq(chatMessageReactionsTable.messageId, messageId))
    .groupBy(chatMessageReactionsTable.emoji);
  return reactions.map((reaction) => ({
    emoji: reaction.emoji,
    count: Number(reaction.count),
    reacted: Boolean(reaction.reacted),
  }));
}

async function serializeMessage(message: typeof chatMessagesTable.$inferSelect, userId: number) {
  return { ...message, reactions: await getReactionSummary(message.id, userId) };
}

async function getChannelSummary(channelId: number, userId: number) {
  const [channel] = await db.select().from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, channelId))
    .limit(1);
  if (!channel) return null;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(chatChannelMembersTable)
    .where(eq(chatChannelMembersTable.channelId, channelId));
  const [lastMessage] = await db.select({
    content: chatMessagesTable.content,
    attachmentName: chatMessagesTable.attachmentName,
    authorName: chatMessagesTable.authorName,
    createdAt: chatMessagesTable.createdAt,
  }).from(chatMessagesTable)
    .where(eq(chatMessagesTable.channelId, channelId))
    .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
    .limit(1);
  const [membership] = await db.select({
    id: chatChannelMembersTable.id,
    lastReadAt: chatChannelMembersTable.lastReadAt,
  })
    .from(chatChannelMembersTable)
    .where(and(
      eq(chatChannelMembersTable.channelId, channelId),
      eq(chatChannelMembersTable.userId, userId),
    ))
    .limit(1);
  return {
    ...channel,
    memberCount: Number(count),
    joined: Boolean(membership),
    unreadCount: membership ? await getUnreadCount(channelId, userId, membership.lastReadAt) : 0,
    lastMessageContent: membership ? lastMessage?.content || null : null,
    lastMessageAttachmentName: membership ? lastMessage?.attachmentName || null : null,
    lastMessageAuthorName: membership ? lastMessage?.authorName || null : null,
    lastMessageAt: membership ? lastMessage?.createdAt?.toISOString() ?? null : null,
  };
}

async function isChannelMember(channelId: number, userId: number) {
  const [membership] = await db.select({ id: chatChannelMembersTable.id })
    .from(chatChannelMembersTable)
    .where(and(
      eq(chatChannelMembersTable.channelId, channelId),
      eq(chatChannelMembersTable.userId, userId),
    ))
    .limit(1);
  return Boolean(membership);
}

router.get("/chat/channels", async (req, res): Promise<void> => {
  const user = requireCurrentUser(req);
  await ensureDefaultChannels(user.id);
  const channels = await db.select().from(chatChannelsTable)
    .where(sql`${chatChannelsTable.channelType} = 'channel' OR ${chatChannelsTable.id} IN (
      SELECT ${chatChannelMembersTable.channelId}
      FROM ${chatChannelMembersTable}
      WHERE ${chatChannelMembersTable.userId} = ${user.id}
    )`)
    .orderBy(asc(chatChannelsTable.name));
  res.json(await Promise.all(channels.map((channel) => getChannelSummary(channel.id, user.id))));
});

router.post("/chat/channels", async (req, res): Promise<void> => {
  const parsed = CreateChatChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const name = parsed.data.name.trim().toLowerCase().replace(/\s+/g, "-");
  const description = parsed.data.description?.trim() || null;
  if (!name) {
    res.status(400).json({ error: "Channel name is required" });
    return;
  }
  const [duplicate] = await db.select({ id: chatChannelsTable.id })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.name, name))
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "A channel with this name already exists" });
    return;
  }
  const [{ id }] = await db.insert(chatChannelsTable).values({
    name,
    description,
    createdBy: user.id,
  }).$returningId();
  await db.insert(chatChannelMembersTable).values({ channelId: id, userId: user.id });
  const channel = await getChannelSummary(id, user.id);
  res.status(201).json(channel);
});

router.post("/chat/channels/:channelId/join", async (req, res): Promise<void> => {
  const params = JoinChatChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const channel = await getChannelSummary(params.data.channelId, user.id);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  await db.insert(chatChannelMembersTable).values({
    channelId: params.data.channelId,
    userId: user.id,
  }).onDuplicateKeyUpdate({ set: { userId: user.id } });
  res.json(await getChannelSummary(params.data.channelId, user.id));
});

router.post("/chat/channels/:channelId/leave", async (req, res): Promise<void> => {
  const params = LeaveChatChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const [channel] = await db.select({
    id: chatChannelsTable.id,
    createdBy: chatChannelsTable.createdBy,
    channelType: chatChannelsTable.channelType,
  })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, params.data.channelId))
    .limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  if (channel.channelType !== "direct" && channel.createdBy === user.id) {
    res.status(400).json({ error: "The channel creator cannot leave this channel" });
    return;
  }
  await db.delete(chatChannelMembersTable).where(and(
    eq(chatChannelMembersTable.channelId, params.data.channelId),
    eq(chatChannelMembersTable.userId, user.id),
  ));
  res.json(await getChannelSummary(params.data.channelId, user.id));
});

router.get("/chat/channels/:channelId/members", async (req, res): Promise<void> => {
  const params = ListChatChannelMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [channel] = await db.select({ id: chatChannelsTable.id })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, params.data.channelId))
    .limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  const user = requireCurrentUser(req);
  if (!(await isChannelMember(channel.id, user.id))) {
    res.status(403).json({ error: "Join this channel to view its members" });
    return;
  }
  const members = await db.select({
    userId: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    joinedAt: chatChannelMembersTable.joinedAt,
  })
    .from(chatChannelMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, chatChannelMembersTable.userId))
    .where(eq(chatChannelMembersTable.channelId, params.data.channelId))
    .orderBy(asc(usersTable.name));
  res.json(members);
});

router.get("/chat/channels/:channelId/messages", async (req, res): Promise<void> => {
  const params = ListChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [channel] = await db.select({ id: chatChannelsTable.id })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, params.data.channelId))
    .limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  const user = requireCurrentUser(req);
  if (!(await isChannelMember(channel.id, user.id))) {
    res.status(403).json({ error: "Join this channel to view its messages" });
    return;
  }
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.channelId, channel.id))
    .orderBy(asc(chatMessagesTable.createdAt), asc(chatMessagesTable.id));
  res.json(await Promise.all(messages.map((message) => serializeMessage(message, user.id))));
});

router.post("/chat/channels/:channelId/messages", async (req, res): Promise<void> => {
  const params = ListChatMessagesParams.safeParse(req.params);
  const parsed = CreateChatMessageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const content = parsed.data.content?.trim() || "";
  const attachmentPath = parsed.data.attachmentPath?.trim() || null;
  const attachmentName = parsed.data.attachmentName?.trim() || null;
  const attachmentSize = parsed.data.attachmentSize ?? null;
  const attachmentContentType = parsed.data.attachmentContentType?.trim() || null;
  if (!content && !attachmentPath) {
    res.status(400).json({ error: "Message content or an attachment is required" });
    return;
  }
  if (attachmentPath && !attachmentPath.startsWith("/objects/")) {
    res.status(400).json({ error: "Attachment path is invalid" });
    return;
  }
  if (attachmentSize !== null && (!Number.isInteger(attachmentSize) || attachmentSize < 1 || attachmentSize > MAX_ATTACHMENT_SIZE)) {
    res.status(400).json({ error: "Attachments must be 25 MB or smaller" });
    return;
  }
  const [channel] = await db.select({ id: chatChannelsTable.id, name: chatChannelsTable.name })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, params.data.channelId))
    .limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  if (!(await isChannelMember(channel.id, user.id))) {
    res.status(403).json({ error: "Join this channel to read messages" });
    return;
  }
  if (!(await isChannelMember(channel.id, user.id))) {
    res.status(403).json({ error: "Join this channel before sending messages" });
    return;
  }
  const [{ id }] = await db.insert(chatMessagesTable).values({
    channelId: channel.id,
    authorId: user.id,
    authorName: user.name,
    content,
    attachmentPath,
    attachmentName,
    attachmentSize,
    attachmentContentType,
    replyToId: parsed.data.replyToId ?? null,
  }).$returningId();
  const [message] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id)).limit(1);
  if (content) {
    await safelyNotify(() => notifyMentions(content, {
      type: "mention",
      title: `You were mentioned in #${channel.name}`,
      message: `{mention} was mentioned in #${channel.name} by ${user.name}: ${content}`,
       link: `/chat?channelId=${channel.id}`,
    }, user.id));
  }
  await safelyNotify(() => notifyChatChannelMembers(
    channel.id,
    channel.name,
    user.name,
    content,
    attachmentName,
    user.id,
  ));
  res.status(201).json(await serializeMessage(message!, user.id));
});

router.post("/chat/channels/:channelId/read", async (req, res): Promise<void> => {
  const params = MarkChatChannelReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const [channel] = await db.select({ id: chatChannelsTable.id })
    .from(chatChannelsTable).where(eq(chatChannelsTable.id, params.data.channelId)).limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  await db.update(chatChannelMembersTable).set({ lastReadAt: new Date() }).where(and(
    eq(chatChannelMembersTable.channelId, channel.id),
    eq(chatChannelMembersTable.userId, user.id),
  ));
  res.sendStatus(204);
});

router.get("/chat/search", async (req, res): Promise<void> => {
  const parsed = SearchChatMessagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const term = `%${parsed.data.query.trim()}%`;
  const conditions = [
    eq(chatChannelMembersTable.userId, user.id),
    like(chatMessagesTable.content, term),
    sql`${chatMessagesTable.deletedAt} is null`,
  ];
  if (parsed.data.channelId) conditions.push(eq(chatMessagesTable.channelId, parsed.data.channelId));
  const rows = await db.select({
    message: chatMessagesTable,
    channelName: chatChannelsTable.name,
  }).from(chatMessagesTable)
    .innerJoin(chatChannelsTable, eq(chatChannelsTable.id, chatMessagesTable.channelId))
    .innerJoin(chatChannelMembersTable, eq(chatChannelMembersTable.channelId, chatMessagesTable.channelId))
    .where(and(...conditions))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(100);
  res.json(await Promise.all(rows.map(async (row) => ({
    ...(await serializeMessage(row.message, user.id)),
    channelName: row.channelName,
  }))));
});

router.post("/chat/direct", async (req, res): Promise<void> => {
  const parsed = CreateChatDirectMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const [otherUser] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
  }).from(usersTable).where(and(eq(usersTable.id, parsed.data.userId), eq(usersTable.active, true))).limit(1);
  if (!otherUser || otherUser.id === user.id) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const participantIds = [user.id, otherUser.id].sort((a, b) => a - b);
  const directName = `direct-${participantIds.join("-")}`;
  const [existing] = await db.select({ id: chatChannelsTable.id })
    .from(chatChannelsTable).where(eq(chatChannelsTable.name, directName)).limit(1);
  let channelId = existing?.id;
  if (!channelId) {
    const [{ id }] = await db.insert(chatChannelsTable).values({
      name: directName,
      description: `Direct conversation with ${otherUser.name}`,
      createdBy: user.id,
      channelType: "direct",
    }).$returningId();
    channelId = id;
    await db.insert(chatChannelMembersTable).values(participantIds.map((userId) => ({ channelId, userId })));
  } else {
    await db.insert(chatChannelMembersTable).values({
      channelId,
      userId: user.id,
    }).onDuplicateKeyUpdate({ set: { userId: user.id } });
  }
  res.json(await getChannelSummary(channelId, user.id));
});

router.patch("/chat/messages/:messageId", async (req, res): Promise<void> => {
  const params = UpdateChatMessageParams.safeParse(req.params);
  const parsed = UpdateChatMessageBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "A valid message id and content are required" });
    return;
  }
  const user = requireCurrentUser(req);
  const [message] = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.id, params.data.messageId)).limit(1);
  if (!message) {
    res.status(404).json({ error: "Chat message not found" });
    return;
  }
  if (message.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the author or an administrator can edit this message" });
    return;
  }
  await db.update(chatMessagesTable).set({ content: parsed.data.content.trim(), editedAt: new Date() })
    .where(eq(chatMessagesTable.id, message.id));
  const [updated] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, message.id)).limit(1);
  res.json(await serializeMessage(updated!, user.id));
});

router.delete("/chat/messages/:messageId", async (req, res): Promise<void> => {
  const params = DeleteChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const [message] = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.id, params.data.messageId)).limit(1);
  if (!message) {
    res.status(404).json({ error: "Chat message not found" });
    return;
  }
  if (message.authorId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Only the author or an administrator can delete this message" });
    return;
  }
  await db.update(chatMessagesTable).set({
    content: "",
    attachmentPath: null,
    attachmentName: null,
    attachmentSize: null,
    attachmentContentType: null,
    deletedAt: new Date(),
  }).where(eq(chatMessagesTable.id, message.id));
  res.sendStatus(204);
});

router.post("/chat/messages/:messageId/reactions", async (req, res): Promise<void> => {
  const params = ToggleChatMessageReactionParams.safeParse(req.params);
  const parsed = ToggleChatMessageReactionBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "A valid message id and emoji are required" });
    return;
  }
  const user = requireCurrentUser(req);
  const [message] = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.id, params.data.messageId)).limit(1);
  if (!message) {
    res.status(404).json({ error: "Chat message not found" });
    return;
  }
  if (!(await isChannelMember(message.channelId, user.id))) {
    res.status(403).json({ error: "Join this channel to react" });
    return;
  }
  const [existing] = await db.select({ id: chatMessageReactionsTable.id })
    .from(chatMessageReactionsTable).where(and(
      eq(chatMessageReactionsTable.messageId, message.id),
      eq(chatMessageReactionsTable.userId, user.id),
      eq(chatMessageReactionsTable.emoji, parsed.data.emoji),
    )).limit(1);
  if (existing) {
    await db.delete(chatMessageReactionsTable).where(eq(chatMessageReactionsTable.id, existing.id));
  } else {
    await db.insert(chatMessageReactionsTable).values({
      messageId: message.id,
      userId: user.id,
      emoji: parsed.data.emoji,
    });
  }
  res.json(await getReactionSummary(message.id, user.id));
});

export default router;