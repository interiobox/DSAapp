import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  chatChannelMembersTable,
  chatChannelsTable,
  chatMessagesTable,
  db,
  usersTable,
} from "@workspace/db";
import {
  CreateChatChannelBody,
  CreateChatMessageBody,
  JoinChatChannelParams,
  LeaveChatChannelParams,
  ListChatChannelMembersParams,
  ListChatMessagesParams,
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

async function getChannelSummary(channelId: number, userId: number) {
  const [channel] = await db.select().from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, channelId))
    .limit(1);
  if (!channel) return null;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(chatChannelMembersTable)
    .where(eq(chatChannelMembersTable.channelId, channelId));
  const [membership] = await db.select({ id: chatChannelMembersTable.id })
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
  const channels = await db.select().from(chatChannelsTable).orderBy(asc(chatChannelsTable.name));
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
  const [channel] = await db.select({ id: chatChannelsTable.id, createdBy: chatChannelsTable.createdBy })
    .from(chatChannelsTable)
    .where(eq(chatChannelsTable.id, params.data.channelId))
    .limit(1);
  if (!channel) {
    res.status(404).json({ error: "Chat channel not found" });
    return;
  }
  if (channel.createdBy === user.id) {
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
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.channelId, channel.id))
    .orderBy(asc(chatMessagesTable.createdAt), asc(chatMessagesTable.id));
  res.json(messages);
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
  }).$returningId();
  const [message] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id)).limit(1);
  if (content) {
    await safelyNotify(() => notifyMentions(content, {
      type: "mention",
      title: `You were mentioned in #${channel.name}`,
      message: `{mention} was mentioned in #${channel.name} by ${user.name}: ${content}`,
      link: "/chat",
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
  res.status(201).json(message);
});

export default router;