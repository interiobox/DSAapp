import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  chatChannelsTable,
  chatMessagesTable,
  db,
} from "@workspace/db";
import {
  CreateChatChannelBody,
  CreateChatMessageBody,
  ListChatMessagesParams,
} from "@workspace/api-zod";
import { requireCurrentUser } from "../lib/portalAuth";
import { notifyMentions, safelyNotify } from "../lib/notifications";

const router: IRouter = Router();

async function ensureDefaultChannels(userId: number) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(chatChannelsTable);
  if (Number(count) > 0) return;
  await db.insert(chatChannelsTable).values([
    { name: "general", description: "Announcements and everyday team conversation", createdBy: userId },
    { name: "site-coordination", description: "Site updates, access, and coordination", createdBy: userId },
    { name: "drawing-reviews", description: "Questions and decisions about drawing reviews", createdBy: userId },
  ]);
}

router.get("/chat/channels", async (req, res): Promise<void> => {
  const user = requireCurrentUser(req);
  await ensureDefaultChannels(user.id);
  const channels = await db.select().from(chatChannelsTable).orderBy(asc(chatChannelsTable.name));
  res.json(channels);
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
  const [channel] = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.id, id)).limit(1);
  res.status(201).json(channel);
});

router.get("/chat/channels/:channelId/messages", async (req, res): Promise<void> => {
  const params = ListChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
  const content = parsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Message content is required" });
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
  const [{ id }] = await db.insert(chatMessagesTable).values({
    channelId: channel.id,
    authorId: user.id,
    authorName: user.name,
    content,
  }).$returningId();
  const [message] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id)).limit(1);
  await safelyNotify(() => notifyMentions(content, {
    type: "mention",
    title: `You were mentioned in #${channel.name}`,
    message: `{mention} was mentioned in #${channel.name} by ${user.name}: ${content}`,
    link: "/chat",
  }, user.id));
  res.status(201).json(message);
});

export default router;