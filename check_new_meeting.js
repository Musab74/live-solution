const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    console.log('Checking NEW meeting 68ff304d9b10d08e4b7fdbc1...\n');
    return mongoose.connection.db.collection('participants').findOne({ 
      meetingId: new mongoose.Types.ObjectId('68ff304d9b10d08e4b7fdbc1')
    });
  })
  .then(p => {
    if (!p) {
      console.log('❌ Participant not found for this meeting');
      return process.exit(0);
    }
    console.log('Participant found:');
    console.log('  _id:', p._id);
    console.log('  displayName:', p.displayName);
    console.log('  status:', p.status);
    console.log('  createdAt:', p.createdAt);
    console.log('  updatedAt:', p.updatedAt);
    console.log('  sessions count:', p.sessions?.length || 0);
    console.log('  totalDurationSec:', p.totalDurationSec);
    console.log('\nSessions:');
    if (p.sessions && p.sessions.length > 0) {
      p.sessions.forEach((s, idx) => {
        console.log(`  Session ${idx + 1}:`, JSON.stringify(s, null, 2));
      });
    } else {
      console.log('  ⚠️  NO SESSIONS! Sessions array is empty!');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
