#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create database connection
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function runMigration() {
  console.log('🚀 Starting Enhanced Schema Migration...');
  console.log('⚠️  This migration includes major schema changes. Make sure you have a backup!');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../src/drizzle/migrations/0001_enhanced_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Reading migration file...');
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Enhanced schema migration completed successfully!');
    console.log('\n📋 Migration Summary:');
    console.log('   ✓ Fixed audit logs primary key issue');
    console.log('   ✓ Enhanced users table with personal info');
    console.log('   ✓ Added user-organization membership system');
    console.log('   ✓ Comprehensive job management features');
    console.log('   ✓ Enhanced employee HR features');
    console.log('   ✓ Client and property management tables');
    console.log('   ✓ Improved permissions with modules');
    console.log('   ✓ Added proper indexes for performance');
    
    console.log('\n🎉 Your T3 Mechanical system is now ready for production!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔄 To rollback this migration, run:');
    console.log('   npm run migrate:rollback');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

async function runRollback() {
  console.log('🔄 Starting Enhanced Schema Rollback...');
  console.log('⚠️  WARNING: This will remove enhanced features and may cause data loss!');
  
  try {
    // Read the rollback SQL file
    const rollbackPath = path.join(__dirname, '../src/drizzle/migrations/0001_enhanced_schema_rollback.sql');
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    console.log('📖 Reading rollback file...');
    
    // Execute the rollback
    console.log('⚡ Executing rollback...');
    await sql.unsafe(rollbackSQL);
    
    console.log('✅ Schema rollback completed.');
    console.log('⚠️  Enhanced features have been removed.');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'rollback') {
  runRollback();
} else {
  runMigration();
}

















