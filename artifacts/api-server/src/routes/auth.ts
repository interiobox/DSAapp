import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authenticatePortalUser, clearSession, createSession, publicUser, verifyPassword } from "../lib/portalAuth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.username, username), isNull(usersTable.deletedAt))).limit(1);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  await createSession(user.id, res);
  res.json(publicUser(user));
});

router.get("/auth/me", authenticatePortalUser, async (req, res): Promise<void> => {
  res.json(req.portalUser);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await clearSession(req, res);
  res.sendStatus(204);
});

export default router;