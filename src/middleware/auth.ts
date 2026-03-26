import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { isTokenBlacklisted } from "../utils/tokenBlacklist.js";
import {
  getMeProfileBundle,
  mapProfileToAuthGate,
  type AuthMeProfileRow,
} from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

// Timeout wrapper for database queries to prevent hanging
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
};

// Optimized LRU (Least Recently Used) cache with automatic eviction
// Configurable via environment variables
interface CachedUser {
  /** Full profile row — GET /auth/me can reuse without a second query. */
  principal: AuthMeProfileRow;
  expiresAt: number;
  lastAccessed: number; // For LRU tracking
}

// LRU Cache Node for efficient O(1) operations
class LRUNode {
  key: string;
  value: CachedUser;
  prev: LRUNode | null = null;
  next: LRUNode | null = null;

  constructor(key: string, value: CachedUser) {
    this.key = key;
    this.value = value;
  }
}

// Optimized LRU Cache implementation
class LRUCache {
  private capacity: number;
  private cache: Map<string, LRUNode>;
  private head: LRUNode;
  private tail: LRUNode;
  private size: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleaning: boolean = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();

    // Create dummy head and tail nodes for O(1) operations
    this.head = new LRUNode("", {} as CachedUser);
    this.tail = new LRUNode("", {} as CachedUser);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // Add node to head (most recently used)
  private addToHead(node: LRUNode): void {
    node.prev = this.head;
    node.next = this.head.next;
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  // Remove node from list
  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }

  // Move node to head (mark as recently used)
  private moveToHead(node: LRUNode): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  // Remove tail node (least recently used)
  private removeTail(): LRUNode | null {
    const lastNode = this.tail.prev;
    if (lastNode && lastNode !== this.head) {
      this.removeNode(lastNode);
      return lastNode;
    }
    return null;
  }

  // Get value from cache (O(1))
  get(key: string): CachedUser | null {
    const node = this.cache.get(key);
    if (!node) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (node.value.expiresAt < now) {
      // Expired - remove it
      this.removeNode(node);
      this.cache.delete(key);
      this.size--;
      return null;
    }

    // Update last accessed time and move to head (LRU)
    node.value.lastAccessed = now;
    this.moveToHead(node);
    return node.value;
  }

  // Set value in cache (O(1))
  set(key: string, value: CachedUser): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.value.lastAccessed = Date.now();
      this.moveToHead(existingNode);
      return;
    }

    // Check if we need to evict
    if (this.size >= this.capacity) {
      const tail = this.removeTail();
      if (tail) {
        this.cache.delete(tail.key);
        this.size--;
      }
    }

    // Add new node
    const newNode = new LRUNode(key, value);
    value.lastAccessed = Date.now();
    this.addToHead(newNode);
    this.cache.set(key, newNode);
    this.size++;
  }

  // Delete from cache (O(1))
  delete(key: string): void {
    const node = this.cache.get(key);
    if (node) {
      this.removeNode(node);
      this.cache.delete(key);
      this.size--;
    }
  }

  // Get current size
  getSize(): number {
    return this.size;
  }

  // Clean expired entries (non-blocking, batched)
  private async cleanExpired(): Promise<void> {
    if (this.isCleaning || this.size === 0) {
      return;
    }

    this.isCleaning = true;
    const now = Date.now();
    const batchSize = 100; // Process in batches to avoid blocking
    let cleaned = 0;
    let processed = 0;

    // Use iterator for memory efficiency
    const iterator = this.cache.entries();
    const toDelete: string[] = [];

    // Process batch
    for (const [key, node] of iterator) {
      if (processed >= batchSize) {
        break;
      }

      if (node.value.expiresAt < now) {
        toDelete.push(key);
        cleaned++;
      }
      processed++;
    }

    // Delete expired entries
    for (const key of toDelete) {
      this.delete(key);
    }

    this.isCleaning = false;

    // If we cleaned items or cache is still large, schedule next cleanup
    if (cleaned > 0 || this.size > this.capacity * 0.9) {
      // Schedule next cleanup in smaller batches if cache is large
      setTimeout(() => this.cleanExpired(), 1000);
    }
  }

  // Start periodic cleanup (non-blocking)
  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      return; // Already started
    }

    // Initial cleanup after 30 seconds
    setTimeout(() => this.cleanExpired(), 30000);

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      // Use setImmediate for non-blocking execution
      setImmediate(() => this.cleanExpired());
    }, intervalMs);
  }

  // Stop cleanup
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Clear all entries
  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }
}

// Cache configuration
const CACHE_TTL = parseInt(process.env.AUTH_CACHE_TTL || "300000", 10); // Default: 5 minutes
const MAX_CACHE_SIZE = parseInt(process.env.AUTH_CACHE_MAX_SIZE || "10000", 10); // Default: 10k entries
const CACHE_ENABLED = process.env.AUTH_CACHE_ENABLED !== "false"; // Default enabled
const DB_QUERY_TIMEOUT = parseInt(process.env.AUTH_DB_TIMEOUT || "5000", 10); // Default: 5 seconds (fail fast)

// Initialize optimized LRU cache
const authCache = new LRUCache(MAX_CACHE_SIZE);

// Start automatic cleanup if cache is enabled
if (CACHE_ENABLED) {
  authCache.startCleanup(60000); // Clean every minute

  // Log cache stats periodically (optional, for monitoring)
  if (process.env.NODE_ENV === "development") {
    setInterval(() => {
      logger.debug(
        `Auth cache stats: ${authCache.getSize()}/${MAX_CACHE_SIZE} entries`,
      );
    }, 300000); // Every 5 minutes
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Check if we've already processed this request - prevent duplicate processing
  if ((req as any).__authProcessed) {
    // Already processed - skip and continue to next middleware
    return next();
  }

  // Mark as processed immediately to prevent duplicate processing
  (req as any).__authProcessed = true;

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization denied. Please provide a valid authentication token.",
      });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid token format.",
      });
    }

    const token = parts[1].trim();

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid or expired token.",
      });
    }

    // Extract userId from decoded token
    const userId = (decoded as { userId: string }).userId;
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid token.",
      });
    }

    const jti = decoded.jti;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      logger.warn(`Invalid UUID format in token: ${userId}`, {
        method: req.method,
        url: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid user identifier format.",
      });
    }

    let principal: AuthMeProfileRow | null = null;
    let dbTime = 0;

    const loadPrincipal = async (): Promise<AuthMeProfileRow | null> => {
      if (CACHE_ENABLED) {
        const cacheStart = Date.now();
        const cached = authCache.get(userId);
        const cacheTime = Date.now() - cacheStart;
        if (cached) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `✅ Auth: from cache (${cacheTime}ms) [${req.method} ${
                req.originalUrl || req.url
              }]`,
            );
          }
          return cached.principal;
        }
      }

      const dbStart = Date.now();
      try {
        const row = await withTimeout(
          getMeProfileBundle(userId),
          DB_QUERY_TIMEOUT,
          CACHE_ENABLED
            ? "Database query timeout"
            : `Database auth query timeout after ${DB_QUERY_TIMEOUT}ms for user ${userId}`,
        );
        dbTime = Date.now() - dbStart;
        if (row && CACHE_ENABLED) {
          authCache.set(userId, {
            principal: row,
            expiresAt: Date.now() + CACHE_TTL,
            lastAccessed: Date.now(),
          });
        }
        if (process.env.NODE_ENV === "development") {
          console.log(
            `✅ Auth: from db (${dbTime}ms) [${req.method} ${
              req.originalUrl || req.url
            }]`,
          );
        }
        return row;
      } catch (dbError: any) {
        dbTime = Date.now() - dbStart;
        logger.error(`Database query failed or timed out after ${dbTime}ms:`, {
          ...dbError,
          userId,
          method: req.method,
          url: req.originalUrl,
          userAgent: req.headers["user-agent"],
          cacheEnabled: CACHE_ENABLED,
          queryTimeout: DB_QUERY_TIMEOUT,
          poolStatus: {
            total: (req as any).__dbPoolTotal,
            idle: (req as any).__dbPoolIdle,
            waiting: (req as any).__dbPoolWaiting,
          },
        });
        throw new Error(
          dbError.message?.includes("timeout")
            ? "Database connection timeout. Please try again."
            : "Database error during authentication",
        );
      }
    };

    if (jti) {
      const [revoked, loaded] = await Promise.all([
        isTokenBlacklisted(jti),
        loadPrincipal(),
      ]);
      if (revoked) {
        return res.status(401).json({
          success: false,
          message: "Authorization denied. Token has been revoked.",
        });
      }
      principal = loaded;
    } else {
      principal = await loadPrincipal();
    }

    if (!principal) {
      if (CACHE_ENABLED) {
        authCache.delete(userId);
      }
      return res.status(401).json({
        success: false,
        message: "Authorization denied. User not found.",
      });
    }

    if (!principal.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your account is inactive.",
      });
    }

    if (principal.isDeleted === true) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your account has been deleted.",
      });
    }

    const gate = mapProfileToAuthGate(principal);
    req.authPrincipal = principal;
    req.user = {
      id: gate.id,
      ...(gate.email && { email: gate.email }),
      ...(gate.employeeId != null && { employeeId: gate.employeeId }),
    };

    next();
  } catch (error: any) {
    logger.logApiError("Authentication error", error, req);

    // Provide more specific error messages
    const errorMessage = error?.message || String(error);
    const isTimeout = errorMessage.includes("timeout");
    const isDatabaseError = errorMessage.includes("Database");

    return res.status(isTimeout || isDatabaseError ? 503 : 500).json({
      success: false,
      message: isTimeout
        ? "Authentication service temporarily unavailable. Please try again."
        : isDatabaseError
          ? errorMessage
          : "Authentication failed",
    });
  }
};
