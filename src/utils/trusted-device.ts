import { randomBytes, createHash } from 'crypto';
import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '../config/db.js';
import { trustedDevices } from '../drizzle/schema/auth.schema.js';
import type { Request } from 'express';

/**
 * Generate a secure device token
 */
export function generateDeviceToken(): string {
  // Generate 32 bytes of random data and convert to hex
  return randomBytes(32).toString('hex');
}

/**
 * Hash device token for storage (similar to password hashing)
 */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Extract device information from request
 */
export function getDeviceInfo(req: Request) {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   (req.headers['x-real-ip'] as string) || 
                   req.socket.remoteAddress || 
                   'Unknown';

  // Extract browser name from user agent for friendly display
  let deviceName = 'Unknown Browser';
  if (userAgent.includes('Chrome')) deviceName = 'Chrome Browser';
  else if (userAgent.includes('Firefox')) deviceName = 'Firefox Browser';
  else if (userAgent.includes('Safari')) deviceName = 'Safari Browser';
  else if (userAgent.includes('Edge')) deviceName = 'Microsoft Edge';

  return {
    userAgent,
    ipAddress,
    deviceName,
  };
}

/**
 * Store a trusted device token for a user
 */
export async function storeTrustedDevice(
  userId: string,
  deviceToken: string,
  req: Request,
  expiryDays: number = 30
) {
  const hashedToken = hashDeviceToken(deviceToken);
  const deviceInfo = getDeviceInfo(req);
  
  // Set expiry date (30 days from now by default)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  console.log('Storing trusted device:', {
    userId,
    originalTokenLength: deviceToken.length,
    hashedTokenLength: hashedToken.length,
    deviceInfo,
    expiresAt: expiresAt.toISOString(),
    expiryDays
  });

  const [trustedDevice] = await db.insert(trustedDevices).values({
    userId,
    deviceToken: hashedToken,
    deviceName: deviceInfo.deviceName,
    ipAddress: deviceInfo.ipAddress,
    userAgent: deviceInfo.userAgent,
    expiresAt,
    lastUsedAt: new Date(),
  }).returning();

  console.log('Trusted device stored:', {
    deviceId: trustedDevice?.id,
    userId: trustedDevice?.userId,
    deviceToken: trustedDevice?.deviceToken,
    expiresAt: trustedDevice?.expiresAt?.toISOString()
  });

  return trustedDevice;
}

/**
 * Validate a device token and return user ID if valid
 */
export async function validateDeviceToken(deviceToken: string): Promise<string | null> {
  if (!deviceToken) {
    console.log('Device token validation: No token provided');
    return null;
  }

  try {
    const hashedToken = hashDeviceToken(deviceToken);
    const now = new Date();
    
    console.log('Device token validation:', {
      originalTokenLength: deviceToken.length,
      hashedTokenLength: hashedToken.length,
      currentTime: now.toISOString()
    });

    // Find active, non-expired device
    const [device] = await db
      .select({
        userId: trustedDevices.userId,
        id: trustedDevices.id,
        deviceToken: trustedDevices.deviceToken,
        isActive: trustedDevices.isActive,
        expiresAt: trustedDevices.expiresAt,
        lastUsedAt: trustedDevices.lastUsedAt,
      })
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.deviceToken, hashedToken),
          eq(trustedDevices.isActive, true),
          gt(trustedDevices.expiresAt, now)
        )
      )
      .limit(1);

    console.log('Device token query result:', {
      deviceFound: !!device,
      deviceId: device?.id,
      userId: device?.userId,
      isActive: device?.isActive,
      expiresAt: device?.expiresAt?.toISOString(),
      lastUsedAt: device?.lastUsedAt?.toISOString()
    });

    if (!device) {
      // Let's also check if there are any devices for this token (ignoring active/expiry status)
      const allDevicesWithToken = await db
        .select({
          userId: trustedDevices.userId,
          id: trustedDevices.id,
          isActive: trustedDevices.isActive,
          expiresAt: trustedDevices.expiresAt,
        })
        .from(trustedDevices)
        .where(eq(trustedDevices.deviceToken, hashedToken))
        .limit(5);
        
      console.log('All devices with this token (ignoring filters):', allDevicesWithToken);
      return null;
    }

    // Update last used timestamp
    await db
      .update(trustedDevices)
      .set({ 
        lastUsedAt: now,
        updatedAt: now 
      })
      .where(eq(trustedDevices.id, device.id));

    return device.userId;
  } catch (error) {
    console.error('Error validating device token:', error);
    return null;
  }
}

/**
 * Revoke a specific trusted device
 */
export async function revokeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    const result = await db
      .update(trustedDevices)
      .set({ 
        isActive: false,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.userId, userId)
        )
      );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error revoking trusted device:', error);
    return false;
  }
}

/**
 * Get all trusted devices for a user
 */
export async function getUserTrustedDevices(userId: string) {
  try {
    const devices = await db
      .select({
        id: trustedDevices.id,
        deviceName: trustedDevices.deviceName,
        ipAddress: trustedDevices.ipAddress,
        lastUsedAt: trustedDevices.lastUsedAt,
        createdAt: trustedDevices.createdAt,
        expiresAt: trustedDevices.expiresAt,
        isActive: trustedDevices.isActive,
      })
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.isActive, true)
        )
      )
      .orderBy(trustedDevices.lastUsedAt);

    return devices;
  } catch (error) {
    console.error('Error getting user trusted devices:', error);
    return [];
  }
}

/**
 * Revoke all trusted devices for a user (useful for security incidents)
 */
export async function revokeAllUserDevices(userId: string): Promise<number> {
  try {
    const result = await db
      .update(trustedDevices)
      .set({ 
        isActive: false,
        updatedAt: new Date() 
      })
      .where(eq(trustedDevices.userId, userId));

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Error revoking all user devices:', error);
    return 0;
  }
}

/**
 * Clean up expired tokens (should be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const now = new Date();
    const result = await db
      .update(trustedDevices)
      .set({ 
        isActive: false,
        updatedAt: now 
      })
      .where(
        and(
          eq(trustedDevices.isActive, true),
          lt(trustedDevices.expiresAt, now)
        )
      );

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
}
