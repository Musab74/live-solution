const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Running meeting migration...');

// Run the migration script
exec('npx ts-node src/scripts/migrate-meetings.ts', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:', error);
    return;
  }
  
  if (stderr) {
    console.error('⚠️ Migration warnings:', stderr);
  }
  
  console.log('✅ Migration output:', stdout);
  console.log('🎉 Migration completed successfully!');
});
