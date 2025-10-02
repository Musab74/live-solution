const mongoose = require('mongoose');

// Connect to your MongoDB database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/livekit-app';

async function testAttendance() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check meetings
    const meetings = await mongoose.connection.db.collection('meetings').find({}).toArray();
    console.log('📊 Meetings found:', meetings.length);
    
    if (meetings.length > 0) {
      const meeting = meetings[0];
      console.log('📋 First meeting:', {
        _id: meeting._id,
        title: meeting.title,
        hostId: meeting.hostId,
        status: meeting.status,
        participantCount: meeting.participantCount
      });

      // Check participants for this meeting
      const participants = await mongoose.connection.db.collection('participants').find({ meetingId: meeting._id.toString() }).toArray();
      console.log('👥 Participants for this meeting:', participants.length);
      
      participants.forEach((p, index) => {
        console.log(`  Participant ${index + 1}:`, {
          _id: p._id,
          displayName: p.displayName,
          status: p.status,
          sessions: p.sessions?.length || 0,
          userId: p.userId
        });
      });

      // Check members
      const members = await mongoose.connection.db.collection('members').find({}).toArray();
      console.log('👤 Members found:', members.length);
      
      members.forEach((m, index) => {
        console.log(`  Member ${index + 1}:`, {
          _id: m._id,
          displayName: m.displayName,
          email: m.email,
          systemRole: m.systemRole
        });
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

testAttendance();
