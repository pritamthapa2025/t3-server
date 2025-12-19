#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 T3 Mechanical - Enhanced Schema Migration');
console.log('============================================');
console.log('');
console.log('This migration will enhance your database with:');
console.log('✓ Fixed audit logs with proper auto-increment');
console.log('✓ Enhanced users table with personal information');
console.log('✓ User-organization membership system');
console.log('✓ Comprehensive job management');
console.log('✓ Enhanced employee HR features');
console.log('✓ Client and property management');
console.log('✓ Improved permissions system');
console.log('');
console.log('⚠️  IMPORTANT: Make sure you have a database backup before proceeding!');
console.log('');

rl.question('Do you want to proceed with the migration? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('');
    console.log('🔄 Starting migration...');
    
    try {
      // Run the migration
      execSync('npm run migrate:enhanced', { stdio: 'inherit' });
      
      console.log('');
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Update your application code to use the new features');
      console.log('2. Populate the user_organizations table with existing relationships');
      console.log('3. Test your APIs with the enhanced data structure');
      console.log('');
      console.log('If you encounter issues, you can rollback with:');
      console.log('   npm run migrate:rollback');
      
    } catch (error) {
      console.error('');
      console.error('❌ Migration failed:', error.message);
      console.log('');
      console.log('To rollback any partial changes, run:');
      console.log('   npm run migrate:rollback');
    }
  } else {
    console.log('Migration cancelled.');
  }
  
  rl.close();
});










