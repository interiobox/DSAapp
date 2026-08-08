import { Router, type IRouter } from "express";
import { requireAdmin, requireCurrentUser } from "../lib/portalAuth";
import {
  completeGoogleDriveConnection,
  createGoogleDriveAuthorizationUrl,
  disconnectGoogleDrive,
  getGoogleDriveOAuthErrorMessage,
  getGoogleDriveRedirectUri,
  getGoogleDriveStatus,
  migrateLocalFilesToGoogleDrive,
  verifyGoogleDriveState,
} from "../lib/googleDrive";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function requestOrigin(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0];
  return `${protocol}://${req.get("host")}`;
}

router.get("/admin/google-drive", async (_req, res): Promise<void> => {
  res.json(await getGoogleDriveStatus());
});

router.get("/admin/google-drive/oauth/start", (req, res): void => {
  const user = requireCurrentUser(req);
  const redirectUri = getGoogleDriveRedirectUri(requestOrigin(req));
  res.redirect(createGoogleDriveAuthorizationUrl(user.id, redirectUri));
});

router.get("/admin/google-drive/oauth/callback", async (req, res): Promise<void> => {
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const statePayload = verifyGoogleDriveState(state);
    const currentUser = requireCurrentUser(req);
    if (statePayload.userId !== currentUser.id || currentUser.role !== "admin") {
      throw new Error("Administrator session mismatch.");
    }
    if (!code) throw new Error("Google did not return an authorization code.");
    await completeGoogleDriveConnection(code, statePayload.redirectUri, currentUser.id);
    const migration = await migrateLocalFilesToGoogleDrive();
    req.log.info({ migrated: migration.migrated, failed: migration.failed }, "Migrated local files to Google Drive");
    res.redirect("/admin?drive=connected");
  } catch (error) {
    req.log.error({ err: error }, "Google Drive authorization failed");
    res.redirect(`/admin?drive=error&message=${encodeURIComponent(getGoogleDriveOAuthErrorMessage(error).slice(0, 180))}`);
  }
});

router.post("/admin/google-drive/disconnect", async (req, res): Promise<void> => {
  await disconnectGoogleDrive();
  res.sendStatus(204);
});

export default router;