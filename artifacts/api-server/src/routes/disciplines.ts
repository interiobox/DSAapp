import { Router, type IRouter } from "express";
import { asc, isNull } from "drizzle-orm";
import { db, disciplinesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/disciplines", async (_req, res): Promise<void> => {
  res.json(await db.select().from(disciplinesTable).where(isNull(disciplinesTable.deletedAt)).orderBy(asc(disciplinesTable.name)));
});

export default router;