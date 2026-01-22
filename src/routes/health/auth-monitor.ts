import { Router } from 'express';
import { checkDatabaseHealth } from '../../utils/db-health.js';
import { pool } from '../../config/db.js';

const router = Router();

/**
 * Authentication performance monitoring endpoint
 * GET /health/auth-monitor
 * 
 * This endpoint provides real-time auth system health for monitoring
 */
router.get('/auth-monitor', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Quick health check
    const health = await checkDatabaseHealth();
    const totalTime = Date.now() - startTime;

    // Get pool statistics
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      utilization: pool.totalCount > 0 ? 
        Math.round(((pool.totalCount - pool.idleCount) / pool.totalCount) * 100) : 0
    };

    // Determine overall status
    const isHealthy = health.isHealthy && 
                     health.authTableQuery.responseTime < 1000 && 
                     poolStats.waiting < 10;

    const status = isHealthy ? 'healthy' : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      totalCheckTime: totalTime,
      database: {
        connection: {
          success: health.connectionTest.success,
          responseTime: health.connectionTest.responseTime,
          status: health.connectionTest.responseTime < 500 ? 'good' : 'slow'
        },
        authQuery: {
          success: health.authTableQuery.success,
          responseTime: health.authTableQuery.responseTime,
          status: health.authTableQuery.responseTime < 100 ? 'excellent' :
                  health.authTableQuery.responseTime < 500 ? 'good' : 'slow'
        }
      },
      connectionPool: {
        ...poolStats,
        status: poolStats.waiting > 10 ? 'overloaded' :
               poolStats.utilization > 80 ? 'high' :
               poolStats.utilization > 50 ? 'moderate' : 'low'
      },
      recommendations: generateRecommendations(health, poolStats),
      errors: health.errors
    });

  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      recommendations: [
        'Database is unreachable',
        'Check database server status',
        'Verify network connectivity'
      ]
    });
  }
});

function generateRecommendations(health: any, poolStats: any): string[] {
  const recommendations: string[] = [];

  if (health.connectionTest.responseTime > 1000) {
    recommendations.push('High connection latency detected - check network connectivity');
  }

  if (health.authTableQuery.responseTime > 500) {
    recommendations.push('Slow auth queries detected - monitor database performance');
  }

  if (poolStats.waiting > 5) {
    recommendations.push(`Connection pool has ${poolStats.waiting} waiting connections - consider increasing pool size`);
  }

  if (poolStats.utilization > 80) {
    recommendations.push('High connection pool utilization - monitor for potential bottlenecks');
  }

  if (recommendations.length === 0) {
    recommendations.push('Authentication system is performing well');
  }

  return recommendations;
}

export default router;
