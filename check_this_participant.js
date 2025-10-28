const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    return mongoose.connection.db.collection('participants').findOne({ 
      meetingId: new mongoose.Types.ObjectId('68ff2f0e404a1ccab8131c7b')
    });
  })
  .then(p => {
    if (!p) {
      console.log('Participant not found');
      return process.exit(0);
    }
    console.log('Participant found:');
    console.log('  _id:', p._id);
    console.log('  displayName:', p.displayName);
    console.log('  status:', p.status);
    console.log('  totalDurationSec:', p.totalDurationSec);
    console.log('  sessions count:', p.sessions?.length || 0);
    console.log('\nSessions array:');
    if (p.sessions && p.sessions.length > 0) {
      p.sessions.forEach((s, idx) => {
        console.log(`  Session ${idx + 1}:`, JSON.stringify(s, null, 2));
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
