const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

// Test the recording upload endpoint
async function testRecordingUpload() {
  console.log('🧪 Testing Recording Upload System...\n');

  // Create a test file
  const testContent = 'This is a test recording file content';
  const testFilePath = '/tmp/test-recording.webm';
  fs.writeFileSync(testFilePath, testContent);

  try {
    // Create form data
    const formData = new FormData();
    formData.append('recording', fs.createReadStream(testFilePath), {
      filename: 'test-recording.webm',
      contentType: 'video/webm'
    });
    formData.append('meetingId', 'test-meeting-123');
    formData.append('userId', 'test-user-456');
    formData.append('recordingName', 'Test Recording');

    console.log('📤 Uploading to backend...');
    console.log('   Backend URL: https://api.hrdeedu.co.kr/recording-upload/client-recording');
    console.log('   File size:', testContent.length, 'bytes');

    // Upload to backend
    const response = await axios.post('https://api.hrdeedu.co.kr/recording-upload/client-recording', formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    console.log('✅ Backend Response:');
    console.log('   Status:', response.status);
    console.log('   Success:', response.data.success);
    console.log('   Message:', response.data.message);
    console.log('   Recording URL:', response.data.recordingUrl);
    console.log('   File Name:', response.data.fileName);

    // Test VOD server access
    if (response.data.recordingUrl) {
      console.log('\n🔗 Testing VOD Server Access...');
      console.log('   VOD URL:', response.data.recordingUrl);
      
      try {
        const vodResponse = await axios.head(response.data.recordingUrl, { timeout: 10000 });
        console.log('✅ VOD Server Response:');
        console.log('   Status:', vodResponse.status);
        console.log('   Content-Type:', vodResponse.headers['content-type']);
        console.log('   Content-Length:', vodResponse.headers['content-length']);
      } catch (vodError) {
        console.log('⚠️  VOD Server Test:');
        console.log('   Error:', vodError.message);
        console.log('   Note: File might still be processing on VOD server');
      }
    }

  } catch (error) {
    console.error('❌ Test Failed:');
    console.error('   Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('\n🧹 Test file cleaned up');
    }
  }
}

// Run the test
testRecordingUpload();
