const { MongoClient } = require('mongodb');

async function debugChatMessages() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('hrde'); // Adjust database name if different
    const chatMessages = db.collection('chatmessages');
    const meetings = db.collection('meetings');
    
    // 1. Check if database and collections exist
    console.log('\n📊 Database Collections:');
    const collections = await db.listCollections().toArray();
    console.log(collections.map(c => c.name));
    
    // 2. Check total chat messages count
    const totalMessages = await chatMessages.countDocuments();
    console.log(`\n💬 Total chat messages in database: ${totalMessages}`);
    
    // 3. Check meetings count
    const totalMeetings = await meetings.countDocuments();
    console.log(`📅 Total meetings in database: ${totalMeetings}`);
    
    // 4. List all meetings with their IDs
    console.log('\n📅 All meetings:');
    const allMeetings = await meetings.find({}).limit(10).toArray();
    allMeetings.forEach(meeting => {
      console.log(`  - ID: ${meeting._id} | Title: ${meeting.title || 'No title'}`);
    });
    
    // 5. Check for the specific meeting ID from your URL
    const specificMeetingId = '68d9d55aad3da2683f05b2d0';
    console.log(`\n🔍 Checking meeting: ${specificMeetingId}`);
    
    try {
      const meeting = await meetings.findOne({ _id: new ObjectId(specificMeetingId) });
      if (meeting) {
        console.log(`✅ Meeting found: ${meeting.title || 'No title'}`);
      } else {
        console.log(`❌ Meeting not found with ID: ${specificMeetingId}`);
      }
    } catch (error) {
      console.log(`❌ Invalid ObjectId format: ${specificMeetingId}`);
      console.log(`   Error: ${error.message}`);
    }
    
    // 6. Check chat messages for the specific meeting
    console.log(`\n💬 Chat messages for meeting ${specificMeetingId}:`);
    try {
      const messages = await chatMessages.find({ 
        meetingId: new ObjectId(specificMeetingId) 
      }).toArray();
      console.log(`   Found ${messages.length} messages`);
      
      if (messages.length > 0) {
        messages.forEach((msg, index) => {
          console.log(`   ${index + 1}. ${msg.displayName}: ${msg.text.substring(0, 50)}...`);
        });
      }
    } catch (error) {
      console.log(`❌ Error querying messages: ${error.message}`);
    }
    
    // 7. Check all chat messages (first 5)
    console.log('\n💬 All chat messages (first 5):');
    const allMessages = await chatMessages.find({}).limit(5).toArray();
    allMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. Meeting: ${msg.meetingId} | ${msg.displayName}: ${msg.text.substring(0, 30)}...`);
    });
    
    // 8. Check if there are any messages with different meeting ID formats
    console.log('\n🔍 Checking for messages with different meeting ID formats:');
    const sampleMessages = await chatMessages.find({}).limit(10).toArray();
    const uniqueMeetingIds = [...new Set(sampleMessages.map(msg => msg.meetingId.toString()))];
    console.log(`   Unique meeting IDs in messages: ${uniqueMeetingIds.length}`);
    uniqueMeetingIds.forEach(id => {
      console.log(`   - ${id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Import ObjectId
const { ObjectId } = require('mongodb');

debugChatMessages().catch(console.error);
