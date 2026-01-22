#!/usr/bin/env tsx

/**
 * Debug Authentication Performance
 * 
 * This script helps diagnose why authentication queries are taking 19+ seconds
 * Run this to identify database performance issues
 */

import { checkDatabaseHealth, testSpecificUserQuery, testDatabaseIndexes } from '../src/utils/db-health.js';

async function debugAuthentication() {
  console.log('🔍 T3 Authentication Debug Tool\n');
  console.log('=' .repeat(50));

  try {
    // Step 1: General database health check
    console.log('\n📊 Step 1: Database Health Check');
    console.log('-'.repeat(30));
    
    const health = await checkDatabaseHealth();
    
    console.log('\n📈 Results:');
    console.log(`Overall Health: ${health.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    console.log(`Connection Test: ${health.connectionTest.success ? '✅' : '❌'} ${health.connectionTest.responseTime}ms`);
    console.log(`Simple Query: ${health.simpleQuery.success ? '✅' : '❌'} ${health.simpleQuery.responseTime}ms`);
    console.log(`Auth Table Query: ${health.authTableQuery.success ? '✅' : '❌'} ${health.authTableQuery.responseTime}ms`);
    console.log(`Pool Status: Total: ${health.poolStatus.total}, Idle: ${health.poolStatus.idle}, Waiting: ${health.poolStatus.waiting}`);
    
    if (health.errors.length > 0) {
      console.log('\n❌ Errors:');
      health.errors.forEach(error => console.log(`  • ${error}`));
    }

    // Step 2: Test the specific failing user ID
    console.log('\n🧪 Step 2: Test Failing User ID');
    console.log('-'.repeat(30));
    
    const failingUserId = '41411309-12e9-40de-a3eb-2519fef7fb7a';
    const userTest = await testSpecificUserQuery(failingUserId);
    
    if (!userTest.success) {
      console.log(`❌ User query failed: ${userTest.error}`);
    } else if (!userTest.userFound) {
      console.log(`⚠️  User ID ${failingUserId} does not exist in the database`);
      console.log(`💡 This might explain the slow query - searching for non-existent records can be slower`);
    }

    // Step 3: Check database indexes
    console.log('\n🔍 Step 3: Database Index Analysis');
    console.log('-'.repeat(30));
    
    await testDatabaseIndexes();

    // Step 4: Performance recommendations
    console.log('\n💡 Recommendations:');
    console.log('-'.repeat(30));
    
    if (health.connectionTest.responseTime > 1000) {
      console.log('• Database connection is slow (>1s) - check network connectivity');
    }
    
    if (health.simpleQuery.responseTime > 100) {
      console.log('• Simple queries are slow (>100ms) - database may be under load');
    }
    
    if (health.authTableQuery.responseTime > 100) {
      console.log('• Auth table queries are slow - check for table locks or missing indexes');
    }
    
    if (health.poolStatus.waiting > 0) {
      console.log('• Connection pool has waiting connections - consider increasing pool size');
    }
    
    if (!userTest.userFound && userTest.success) {
      console.log('• The failing user ID does not exist - implement better error handling');
      console.log('• Consider adding early validation to prevent database queries for invalid IDs');
    }

    console.log('\n🚀 Next Steps:');
    console.log('-'.repeat(30));
    console.log('1. If connection times are slow: Check network connectivity to database');
    console.log('2. If user doesn\'t exist: Add JWT token validation to prevent invalid user lookups');
    console.log('3. If database is slow: Check database server resources (CPU, memory, disk I/O)');
    console.log('4. Monitor connection pool usage during peak times');
    console.log('5. Consider implementing authentication caching (already partially implemented)');

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  } finally {
    process.exit(0);
  }
}

debugAuthentication();
