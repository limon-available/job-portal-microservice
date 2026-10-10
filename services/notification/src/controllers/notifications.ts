import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { z } from "zod";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../repositories/notifications.js";
import { TryCatch } from "../utils/TryCatch.js";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
const notificationIdSchema = z.coerce.number().int().positive().safe();

export const getNotifications: RequestHandler = TryCatch(async (req, res) => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) {
    throw new AppError(401, "Authentication required");
  }
  const pagination = paginationSchema.safeParse({
    limit: req.query.limit ?? 20,
    offset: req.query.offset ?? 0,
  });
  if (!pagination.success) {
    throw new AppError(400, "Invalid pagination parameters");
  }
  const notifications = await listNotifications(
    userId,
    pagination.data.limit,
    pagination.data.offset,
  );
  res.json({
    success: true,
    message: "Notifications",
    data: { notifications },
  });
});

export const markNotificationAsRead: RequestHandler = TryCatch(async (req, res) => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) throw new AppError(401, "Authentication required");
  const parsedId = notificationIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    throw new AppError(400, "Invalid notification ID");
  }
  const updated = await markNotificationRead(userId, parsedId.data);
  if (updated.length === 0) throw new AppError(404, "Notification not found");
  res.json({ success: true, message: "Notification marked as read", data: updated[0] });
});

export const markAllAsRead: RequestHandler = TryCatch(async (req, res) => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) throw new AppError(401, "Authentication required");
  const updated = await markAllNotificationsRead(userId);
  res.json({
    success: true,
    message: "Notifications marked as read",
    data: { updatedCount: updated.length },
  });
});

export const getUnreadNotificationsCount: RequestHandler = TryCatch(async (req, res) => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) throw new AppError(401, "Authentication required");
  const [result] = await getUnreadCount(userId);
  res.json({
    success: true,
    message: "Unread notification count",
    data: { count: result?.count ?? 0 },
  });
});
