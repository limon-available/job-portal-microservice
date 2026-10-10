import { Router } from "express";
import isAuth from "./middleware/isAuth.js";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllAsRead,
  markNotificationAsRead,
} from "./controllers/notifications.js";

const router = Router();
router.use(isAuth);
router.get("/", getNotifications);
router.patch("/read-all", markAllAsRead);
router.get("/unread-count", getUnreadNotificationsCount);
router.patch("/:id/read", markNotificationAsRead);

export default router;
