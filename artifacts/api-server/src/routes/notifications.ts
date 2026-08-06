import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { ListNotificationsResponse, MarkNotificationReadParams } from "@workspace/api-zod";
import { listUserNotifications, markNotificationRead } from "../lib/notifications";
import { requireCurrentUser } from "../lib/portalAuth";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const user = requireCurrentUser(req);
  res.json(ListNotificationsResponse.parse(await listUserNotifications(user.id)));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = requireCurrentUser(req);
  const notification = await markNotificationRead(params.data.id, user.id);
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const user = requireCurrentUser(req);
  await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(eq(notificationsTable.recipientId, user.id));
  res.sendStatus(204);
});

export default router;