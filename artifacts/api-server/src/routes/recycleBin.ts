import { Router, type IRouter } from "express";
import { requireCurrentUser } from "../lib/portalAuth";
import { listRecycleBin, restoreRecycleBinEntry, type RecycleBinType } from "../lib/recycleBin";

const router: IRouter = Router();
const types = new Set(["project", "drawing", "upload", "comment", "project-note", "personal-note", "contact", "contact-project", "checklist", "template", "category", "user"]);

router.get("/recycle-bin", async (req, res): Promise<void> => {
  res.json(await listRecycleBin(requireCurrentUser(req)));
});

router.post("/recycle-bin/:type/:id/restore", async (req, res): Promise<void> => {
  const type = req.params.type as RecycleBinType;
  const id = Number(req.params.id);
  if (!types.has(type) || !Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid recycle-bin entry" });
    return;
  }
  const restored = await restoreRecycleBinEntry(type, id, requireCurrentUser(req));
  if (!restored.length) {
    res.status(404).json({ error: "Recycle-bin entry not found" });
    return;
  }
  res.json(restored[0]);
});

export default router;