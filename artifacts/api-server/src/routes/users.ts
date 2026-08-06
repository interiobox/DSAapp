import { Router, type IRouter } from "express";
import { asc, isNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ListUsersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(isNull(usersTable.deletedAt)).orderBy(asc(usersTable.name));
  res.json(ListUsersResponse.parse(users));
});

router.post("/users", async (req, res): Promise<void> => {
  res.status(410).json({ error: "Portal users must be created by an administrator with a username and password" });
});

export default router;