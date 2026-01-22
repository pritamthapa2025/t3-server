import { getUserByIdForAuth } from '../services/auth.service.js';
import { logger } from './logger.js';

/**
 * Pre-warm the authentication cache with frequently accessed users
 * This prevents cold-start authentication delays
 */
export async function warmupAuthCache(userIds: string[] = []) {
  logger.info('🔥 Warming up authentication cache...');
  
  const commonUserIds = [
    '41411309-12e9-40de-a3eb-2519fef7fb7a', // The problematic user ID
    ...userIds
  ];

  const results = await Promise.allSettled(
    commonUserIds.map(async (userId) => {
      try {
        const startTime = Date.now();
        const user = await getUserByIdForAuth(userId);
        const responseTime = Date.now() - startTime;
        
        if (user) {
          logger.info(`✅ Pre-cached user ${userId} (${responseTime}ms)`);
          return { userId, success: true, responseTime };
        } else {
          logger.warn(`⚠️  User not found during warmup: ${userId}`);
          return { userId, success: false, error: 'User not found' };
        }
      } catch (error: any) {
        logger.error(`❌ Failed to pre-cache user ${userId}:`, error.message);
        return { userId, success: false, error: error.message };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  logger.info(`🎯 Auth cache warmup complete: ${successful} successful, ${failed} failed`);
  
  return {
    total: results.length,
    successful,
    failed,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' })
  };
}

/**
 * Periodically refresh authentication cache for active users
 */
export function startAuthCacheRefresh(intervalMinutes: number = 30) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  setInterval(async () => {
    logger.debug('🔄 Refreshing auth cache...');
    try {
      await warmupAuthCache();
    } catch (error) {
      logger.error('Failed to refresh auth cache:', error);
    }
  }, intervalMs);
  
  logger.info(`⏰ Started auth cache refresh every ${intervalMinutes} minutes`);
}
