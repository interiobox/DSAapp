import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import disciplinesRouter from "./disciplines";
import categoriesRouter from "./categories";
import drawingsRouter from "./drawings";
import projectsRouter from "./projects";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import checklistsRouter from "./checklists";
import chatRouter from "./chat";
import notificationsRouter from "./notifications";
import contactsRouter from "./contacts";
import notesRouter from "./notes";
import recycleBinRouter from "./recycleBin";
import googleDriveRouter from "./googleDrive";
import attendanceRouter from "./attendance";
import galleryRouter from "./gallery";
import { authenticatePortalUser } from "../lib/portalAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use((req, res, next): void => {
  void authenticatePortalUser(req, res, next);
});
router.use(adminRouter);
router.use(googleDriveRouter);
router.use(attendanceRouter);
router.use(galleryRouter);
router.use(disciplinesRouter);
router.use(categoriesRouter);
router.use(drawingsRouter);
router.use(projectsRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(checklistsRouter);
router.use(chatRouter);
router.use(notificationsRouter);
router.use(contactsRouter);
router.use(notesRouter);
router.use(recycleBinRouter);

export default router;
