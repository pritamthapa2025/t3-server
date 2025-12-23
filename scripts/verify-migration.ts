import { db } from "../src/config/db.js";
import { sql } from "drizzle-orm";

/**
 * Verify that the latest migration was applied successfully
 * Usage: npx tsx scripts/verify-migration.ts [table_name]
 */
async function verifyLatestMigration() {
  try {
    const tableName = process.argv[2] || 'trusted_devices';
    const schemaName = process.argv[3] || 'auth';
    
    console.log(`🔍 Verifying migration for ${schemaName}.${tableName}...\n`);

    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = ${schemaName} AND table_name = ${tableName}
    `);

    if (tableExists.rows.length > 0) {
      console.log(`✅ Table ${schemaName}.${tableName} exists`);
      
      // Get table structure
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = ${schemaName} AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);
      
      console.log(`📋 Table structure (${columns.rows.length} columns):`);
      columns.rows.forEach(col => {
        console.log(`  • ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });

      // Check constraints
      const constraints = await db.execute(sql`
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_schema = ${schemaName} AND table_name = ${tableName}
      `);
      
      if (constraints.rows.length > 0) {
        console.log(`🔒 Constraints (${constraints.rows.length}):`);
        constraints.rows.forEach(c => {
          console.log(`  • ${c.constraint_name}: ${c.constraint_type}`);
        });
      }

      console.log(`\n✅ Migration verification successful!`);
    } else {
      console.log(`❌ Table ${schemaName}.${tableName} does NOT exist`);
      
      // Show available tables
      const allTables = await db.execute(sql`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('auth', 'org', 'public')
        ORDER BY table_schema, table_name
      `);
      
      console.log(`\n📋 Available tables:`);
      let currentSchema = '';
      allTables.rows.forEach(table => {
        if (table.table_schema !== currentSchema) {
          currentSchema = table.table_schema;
          console.log(`\n  ${currentSchema}:`);
        }
        console.log(`    • ${table.table_name}`);
      });
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    process.exit(0);
  }
}

verifyLatestMigration();



