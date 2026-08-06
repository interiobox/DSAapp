import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { getDashboard } from "../lib/drawings";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  res.json(GetDashboardSummaryResponse.parse(await getDashboard()));
});

export default router;