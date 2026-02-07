import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { verifyToken } from "../utils/jwt.js";
import { getUserByIdForAuth } from "../services/auth.service.js";
import { logger } from "../utils/logger.js";
import type { Notification } from "../types/notification.types.js";
import { SOCKET_EVENTS } from "../types/notification.types.js";

let io: Server;

/**
 * Initialize Socket.IO server with Redis adapter
 */
export async function setupSocketIO(httpServer: any): Promise<Server> {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        process.env.CLIENT_URL || "http://localhost:3000",
        process.env.CLIENT_URL_Old,
      ].filter((url): url is string => Boolean(url)),
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: parseInt(process.env.SOCKET_IO_PING_TIMEOUT || "60000", 10),
    pingInterval: parseInt(process.env.SOCKET_IO_PING_INTERVAL || "25000", 10),
  });

  // Set up Redis adapter for horizontal scaling (if Redis is available)
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({
        url: process.env.REDIS_URL,
      }) as any;
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));

      logger.info("✅ Socket.IO: Redis adapter connected for horizontal scaling");
      
      // Handle Redis errors
      pubClient.on("error", (err: Error) => {
        logger.error("❌ Socket.IO Redis pub client error:", err);
      });
      
      subClient.on("error", (err: Error) => {
        logger.error("❌ Socket.IO Redis sub client error:", err);
      });
    } catch (error) {
      logger.error("❌ Failed to set up Socket.IO Redis adapter:", error);
      logger.warn("⚠️ Socket.IO will run without Redis adapter (single server mode)");
    }
  } else {
    logger.warn("⚠️ REDIS_URL not configured. Socket.IO running without Redis adapter.");
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        logger.warn("Socket.IO: Connection attempt without token");
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      if (!decoded || typeof decoded === "string") {
        logger.warn("Socket.IO: Invalid or expired token");
        return next(new Error("Invalid or expired token"));
      }

      const userId = (decoded as { userId: string }).userId;
      if (!userId || typeof userId !== "string") {
        logger.warn("Socket.IO: Invalid userId in token");
        return next(new Error("Invalid token payload"));
      }

      // Verify user exists and is active
      const user = await getUserByIdForAuth(userId);
      if (!user) {
        logger.warn(`Socket.IO: User not found: ${userId}`);
        return next(new Error("User not found"));
      }

      if (!user.isActive) {
        logger.warn(`Socket.IO: Inactive user attempted connection: ${userId}`);
        return next(new Error("Account is inactive"));
      }

      if (user.isDeleted === true) {
        logger.warn(`Socket.IO: Deleted user attempted connection: ${userId}`);
        return next(new Error("Account has been deleted"));
      }

      // Attach user data to socket
      socket.data.userId = user.id;
      socket.data.userEmail = user.email;
      socket.data.employeeId = user.employeeId;

      next();
    } catch (error) {
      logger.error("Socket.IO authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;

    // Join user-specific room
    socket.join(`user:${userId}`);

    logger.info(
      `✅ Socket.IO: User connected - ${userEmail} (${userId}) [Socket: ${socket.id}]`
    );

    // Handle client events
    socket.on(SOCKET_EVENTS.MARK_READ, async (notificationId: string) => {
      try {
        logger.debug(
          `Socket.IO: Mark read request from ${userId} for notification ${notificationId}`
        );
        // The actual marking as read will be handled by the service/repository
        // This event can be used to broadcast to other connected clients if needed
      } catch (error) {
        logger.error("Socket.IO: Error handling mark_read event:", error);
      }
    });

    socket.on(SOCKET_EVENTS.MARK_ALL_READ, async () => {
      try {
        logger.debug(`Socket.IO: Mark all read request from ${userId}`);
        // The actual marking as read will be handled by the service/repository
      } catch (error) {
        logger.error("Socket.IO: Error handling mark_all_read event:", error);
      }
    });

    socket.on(SOCKET_EVENTS.DELETE_NOTIFICATION, async (notificationId: string) => {
      try {
        logger.debug(
          `Socket.IO: Delete notification request from ${userId} for ${notificationId}`
        );
        // The actual deletion will be handled by the service/repository
      } catch (error) {
        logger.error("Socket.IO: Error handling delete_notification event:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      logger.info(
        `🔌 Socket.IO: User disconnected - ${userEmail} (${userId}) [Reason: ${reason}]`
      );
    });

    // Handle errors
    socket.on("error", (error) => {
      logger.error(
        `❌ Socket.IO: Socket error for user ${userId}:`,
        error
      );
    });
  });

  logger.info("✅ Socket.IO: Server initialized successfully");
  return io;
}

/**
 * Send notification to specific user
 */
export function sendNotificationToUser(
  userId: string,
  notification: Notification
): void {
  if (!io) {
    logger.error("Socket.IO: Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(SOCKET_EVENTS.NEW_NOTIFICATION, notification);
  logger.debug(`📤 Socket.IO: Notification sent to user ${userId}`);
}

/**
 * Send notification to multiple users
 */
export function sendNotificationToUsers(
  userIds: string[],
  notification: Notification
): void {
  if (!io) {
    logger.error("Socket.IO: Server not initialized");
    return;
  }

  userIds.forEach((userId) => {
    sendNotificationToUser(userId, notification);
  });

  logger.debug(
    `📤 Socket.IO: Notification sent to ${userIds.length} users`
  );
}

/**
 * Broadcast notification read status update
 */
export function broadcastNotificationRead(
  userId: string,
  notificationId: string
): void {
  if (!io) {
    logger.error("Socket.IO: Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_READ, {
    notificationId,
  });
}

/**
 * Broadcast notification deleted
 */
export function broadcastNotificationDeleted(
  userId: string,
  notificationId: string
): void {
  if (!io) {
    logger.error("Socket.IO: Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_DELETED, {
    notificationId,
  });
}

/**
 * Update unread count for user
 */
export function updateUnreadCount(userId: string, count: number): void {
  if (!io) {
    logger.error("Socket.IO: Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(SOCKET_EVENTS.UNREAD_COUNT_UPDATE, {
    count,
  });
}

/**
 * Get Socket.IO server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO server not initialized");
  }
  return io;
}

/**
 * Get connected clients count
 */
export function getConnectedClientsCount(): number {
  if (!io) {
    return 0;
  }
  return io.engine.clientsCount;
}

/**
 * Check if user is connected
 */
export async function isUserConnected(userId: string): Promise<boolean> {
  if (!io) {
    return false;
  }

  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
}
