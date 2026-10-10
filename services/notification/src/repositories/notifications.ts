import { sql } from "../utils/db.js";

export interface NewNotification {
  userId: number;
  type: string;
  title: string;
  message: string;
}

export const createNotification = async ({
  userId,
  type,
  title,
  message,
}: NewNotification): Promise<void> => {
  await sql`
    INSERT INTO notifications(user_id,type,title,message)
    VALUES(${userId},${type},${title},${message})
  `;
};

export const listNotifications = async (
  userId: number,
  limit: number,
  offset: number,
) => sql`
  SELECT notification_id,type,title,message,is_read,created_at
  FROM notifications
  WHERE user_id=${userId}
  ORDER BY created_at DESC
  LIMIT ${limit} OFFSET ${offset}
`;

export const markNotificationRead = async (
  userId: number,
  notificationId: number,
) => sql`
  UPDATE notifications SET is_read=TRUE
  WHERE user_id=${userId} AND notification_id=${notificationId}
  RETURNING notification_id,is_read
`;

export const markAllNotificationsRead = async (userId: number) => sql`
  UPDATE notifications SET is_read=TRUE
  WHERE user_id=${userId} AND is_read=FALSE
  RETURNING notification_id
`;

export const getUnreadCount = async (userId: number) => sql`
  SELECT COUNT(*)::integer AS count
  FROM notifications
  WHERE user_id=${userId} AND is_read=FALSE
`;
