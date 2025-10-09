#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Setting up test data for attendance system...\n');

// Run the test data population script
exec('node populate-test-data-simple.js', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error running test data script:', error);
    return;
  }
  
  if (stderr) {
    console.error('⚠️  Warning:', stderr);
  }
  
  console.log(stdout);
  
  console.log('\n🎉 Test data setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Start your backend server: npm run start:dev');
  console.log('2. Start your frontend: cd ../Live-frontend- && npm run dev');
  console.log('3. Login with: john.doe@university.edu / password123');
  console.log('4. Click "상세" button on any meeting to see attendance data!');
});


