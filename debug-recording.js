const axios = require('axios');

async function testRecording() {
  try {
    console.log('🔍 Testing Recording Permission Issue...\n');
    
    // Test login first
    console.log('1. Testing login...');
    const loginResponse = await axios.post('https://api.hrdeedu.co.kr/graphql', {
      query: `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            token
            user {
              _id
              displayName
              email
              systemRole
            }
          }
        }
      `,
      variables: {
        email: 'romatrade17@gmail.com',
        password: 'Tillo2003'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true'
      }
    });
    
    console.log('✅ Login successful:', loginResponse.data);
    
    const token = loginResponse.data.data.login.token;
    const userId = loginResponse.data.data.login.user._id;
    
    console.log(`\n2. User ID: ${userId}`);
    console.log(`3. Token: ${token.substring(0, 20)}...`);
    
    // Test start recording
    console.log('\n4. Testing start recording...');
    const recordingResponse = await axios.post('https://api.hrdeedu.co.kr/graphql', {
      query: `
        mutation StartMeetingRecording($input: StartMeetingRecordingInput!) {
          startMeetingRecording(input: $input) {
            success
            message
            recordingId
          }
        }
      `,
      variables: {
        input: {
          meetingId: '68f709735fd2e0389091411f'
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Recording started:', recordingResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testRecording();
