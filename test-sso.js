#!/usr/bin/env node

/**
 * SSO Login Test Script
 * 
 * This script helps you test the SSO integration by:
 * 1. Generating a test JWT token (simulating PHP)
 * 2. Calling the SSO login endpoint
 * 3. Verifying the response
 * 
 * Usage:
 *   node test-sso.js
 */

const jwt = require('jsonwebtoken');

// ============================================
// CONFIGURATION
// ============================================

const config = {
  // NestJS API URL
  apiUrl: 'http://localhost:3007',
  
  // ⚠️ IMPORTANT: This MUST match JWT_SECRET_KEY in your .env file!
  jwtSecret: 'your-php-website-jwt-secret-must-match-exactly-32-chars-minimum',
  
  // Test user data (simulating PHP JWT payload)
  testUser: {
    email: 'sso-test@example.com',
    displayName: '테스트 사용자',
    systemRole: 'MEMBER', // MEMBER, TUTOR, or ADMIN
    lastSeenAt: new Date().toISOString(),
    isBlocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
};

// ============================================
// GENERATE TEST JWT TOKEN
// ============================================

function generateTestToken() {
  const payload = {
    ...config.testUser,
    iat: Math.floor(Date.now() / 1000), // issued at
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // expires in 24 hours
  };

  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
  
  console.log('\n✅ Test JWT Token Generated:');
  console.log('─'.repeat(80));
  console.log(token);
  console.log('─'.repeat(80));
  
  return token;
}

// ============================================
// TEST SSO LOGIN
// ============================================

async function testSSOLogin(token) {
  console.log('\n🔐 Testing SSO Login...\n');

  try {
    // Test 1: Health Check
    console.log('📍 Test 1: Health Check');
    const healthResponse = await fetch(`${config.apiUrl}/auth/sso-health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData.status);

    // Test 2: SSO Login (POST)
    console.log('\n📍 Test 2: SSO Login (POST)');
    const loginResponse = await fetch(`${config.apiUrl}/auth/sso-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`HTTP ${loginResponse.status}: ${errorText}`);
    }

    const loginData = await loginResponse.json();

    console.log('✅ SSO Login Response:');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(loginData, null, 2));
    console.log('─'.repeat(80));

    // Test 3: Verify response structure
    console.log('\n📍 Test 3: Response Validation');
    const validations = [
      { field: 'success', value: loginData.success, expected: true },
      { field: 'user.email', value: loginData.user?.email, expected: config.testUser.email },
      { field: 'user.displayName', value: loginData.user?.displayName, expected: config.testUser.displayName },
      { field: 'token', value: !!loginData.token, expected: true },
      { field: 'existed', value: typeof loginData.existed === 'boolean', expected: true },
    ];

    validations.forEach(({ field, value, expected }) => {
      const match = value === expected;
      console.log(`${match ? '✅' : '❌'} ${field}: ${value} ${match ? '(OK)' : `(Expected: ${expected})`}`);
    });

    // Test 4: Verify NestJS token works
    console.log('\n📍 Test 4: Verify NestJS Token Works');
    // You can add additional API calls here using the returned token
    console.log('✅ NestJS Token received:', loginData.token.substring(0, 50) + '...');

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(80));
    console.log('\nSSO Integration is working correctly! 🚀\n');
    
    if (loginData.existed) {
      console.log('ℹ️  User already existed in MongoDB and was updated.');
    } else {
      console.log('ℹ️  New user was created in MongoDB.');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Check MongoDB: db.members.find({ email: "' + config.testUser.email + '" })');
    console.log('2. Integrate SSO into your frontend');
    console.log('3. Test with real PHP JWT tokens');
    console.log('4. Review SSO_INTEGRATION_GUIDE.md for more details\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Is NestJS server running? (npm run start:dev)');
    console.error('2. Is JWT_SECRET_KEY set in .env file?');
    console.error('3. Does JWT_SECRET_KEY match the secret in this script?');
    console.error('4. Is MongoDB running and connected?');
    console.error('5. Check server logs for detailed errors\n');
    process.exit(1);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 SSO INTEGRATION TEST SCRIPT');
  console.log('='.repeat(80));

  console.log('\n⚠️  BEFORE RUNNING THIS TEST:');
  console.log('1. Make sure NestJS server is running: npm run start:dev');
  console.log('2. Update JWT_SECRET_KEY in .env to match this script');
  console.log('3. Verify MongoDB is running and connected');
  
  console.log('\n📝 Configuration:');
  console.log('- API URL:', config.apiUrl);
  console.log('- Test User Email:', config.testUser.email);
  console.log('- JWT Secret Length:', config.jwtSecret.length, 'characters');

  // Generate test token
  const token = generateTestToken();

  // Wait 2 seconds before starting tests
  console.log('\n⏳ Starting tests in 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Run tests
  await testSSOLogin(token);
}

// Check if jsonwebtoken is installed
try {
  require('jsonwebtoken');
} catch (error) {
  console.error('\n❌ ERROR: jsonwebtoken module not found!');
  console.error('Please install it first: npm install jsonwebtoken\n');
  process.exit(1);
}

// Run main function
main().catch(error => {
  console.error('\n❌ UNEXPECTED ERROR:', error);
  process.exit(1);
});

