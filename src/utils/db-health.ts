import { pool } from '../config/db.js';

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  connectionTest: {
    success: boolean;
    responseTime: number;
  };
  simpleQuery: {
    success: boolean;
    responseTime: number;
  };
  authTableQuery: {
    success: boolean;
    responseTime: number;
  };
  poolStatus: {
    total: number;
    idle: number;
    waiting: number;
  };
  errors: string[];
}

/**
 * Comprehensive database health check
 * Tests connection, simple query, and auth table access
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const result: DatabaseHealthStatus = {
    isHealthy: true,
    connectionTest: { success: false, responseTime: 0 },
    simpleQuery: { success: false, responseTime: 0 },
    authTableQuery: { success: false, responseTime: 0 },
    poolStatus: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
    errors: [],
  };

  // Test 1: Basic connection test
  try {
    const start = Date.now();
    const client = await pool.connect();
    client.release();
    result.connectionTest = {
      success: true,
      responseTime: Date.now() - start,
    };
    console.log(`✅ DB Connection test: ${result.connectionTest.responseTime}ms`);
  } catch (error: any) {
    result.isHealthy = false;
    result.connectionTest = { success: false, responseTime: 0 };
    result.errors.push(`Connection test failed: ${error.message}`);
    console.error(`❌ DB Connection test failed:`, error.message);
  }

  // Test 2: Simple query test
  if (result.connectionTest.success) {
    try {
      const start = Date.now();
      const client = await pool.connect();
      await client.query('SELECT 1 as test');
      client.release();
      result.simpleQuery = {
        success: true,
        responseTime: Date.now() - start,
      };
      console.log(`✅ Simple query test: ${result.simpleQuery.responseTime}ms`);
    } catch (error: any) {
      result.isHealthy = false;
      result.simpleQuery = { success: false, responseTime: 0 };
      result.errors.push(`Simple query failed: ${error.message}`);
      console.error(`❌ Simple query test failed:`, error.message);
    }
  }

  // Test 3: Auth table query test (similar to authentication query)
  if (result.simpleQuery.success) {
    try {
      const start = Date.now();
      const client = await pool.connect();
      // Test with a random UUID to see if the query structure is the issue
      await client.query(
        'SELECT id, email, is_active, is_deleted FROM auth.users WHERE id = $1 LIMIT 1',
        ['00000000-0000-4000-8000-000000000000'] // Random UUID that likely doesn't exist
      );
      client.release();
      result.authTableQuery = {
        success: true,
        responseTime: Date.now() - start,
      };
      console.log(`✅ Auth table query test: ${result.authTableQuery.responseTime}ms`);
    } catch (error: any) {
      result.isHealthy = false;
      result.authTableQuery = { success: false, responseTime: 0 };
      result.errors.push(`Auth table query failed: ${error.message}`);
      console.error(`❌ Auth table query test failed:`, error.message);
    }
  }

  // Overall health assessment
  const maxAcceptableTime = 1000; // 1 second
  if (result.connectionTest.responseTime > maxAcceptableTime ||
      result.simpleQuery.responseTime > maxAcceptableTime ||
      result.authTableQuery.responseTime > maxAcceptableTime) {
    result.isHealthy = false;
    result.errors.push('Database response times are too slow (>1s)');
  }

  return result;
}

/**
 * Quick database performance test for the specific user ID that's failing
 */
export async function testSpecificUserQuery(userId: string) {
  console.log(`\n🧪 Testing specific user query for ID: ${userId}`);
  
  try {
    const start = Date.now();
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT id, email, is_active, is_deleted FROM auth.users WHERE id = $1',
      [userId]
    );
    
    client.release();
    const responseTime = Date.now() - start;
    
    console.log(`✅ User query completed in ${responseTime}ms`);
    console.log(`📊 Found ${result.rows.length} user(s)`);
    
    if (result.rows.length > 0) {
      console.log(`👤 User found:`, {
        id: result.rows[0].id,
        email: result.rows[0].email,
        isActive: result.rows[0].is_active,
        isDeleted: result.rows[0].is_deleted,
      });
    }
    
    return {
      success: true,
      responseTime,
      userFound: result.rows.length > 0,
      user: result.rows[0] || null,
    };
  } catch (error: any) {
    console.error(`❌ User query failed:`, error.message);
    return {
      success: false,
      responseTime: 0,
      userFound: false,
      user: null,
      error: error.message,
    };
  }
}

/**
 * Test database indexes performance
 */
export async function testDatabaseIndexes() {
  console.log(`\n🔍 Testing database indexes...`);
  
  try {
    const client = await pool.connect();
    
    // Check if indexes exist on users table
    const indexQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'auth' 
        AND tablename = 'users'
      ORDER BY indexname;
    `;
    
    const result = await client.query(indexQuery);
    client.release();
    
    console.log(`📋 Found ${result.rows.length} indexes on auth.users table:`);
    result.rows.forEach(row => {
      console.log(`  • ${row.indexname}: ${row.indexdef}`);
    });
    
    // Check if the primary key index exists
    const hasIdIndex = result.rows.some(row => 
      row.indexname.includes('pkey') || row.indexname.includes('users_id')
    );
    
    if (!hasIdIndex) {
      console.warn(`⚠️  WARNING: No index found on users.id column!`);
    }
    
    return result.rows;
  } catch (error: any) {
    console.error(`❌ Index check failed:`, error.message);
    return [];
  }
}
