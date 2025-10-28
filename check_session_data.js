const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    return mongoose.connection.db.collection('participants').findOne({ 
      _id: new mongoose.Types.ObjectId('68e616c90c8718c926dc2d48')
    });
  })
  .then(p => {
    console.log('Participant status:', p.status);
    console.log('Sessions count:', p.sessions?.length);
    console.log('\nSessions details:');
    if (p.sessions && p.sessions.length > 0) {
      p.sessions.forEach((s, idx) => {
        console.log(`\nSession ${idx + 1}:`);
        console.log('  joinedAt:', s.joinedAt);
        console.log('  leftAt:', s.leftAt || 'NULL - STILL ACTIVE');
        console.log('  durationSec:', s.durationSec);
      });
      console.log('\ntotalDurationSec:', p.totalDurationSec);
    }
    process.exit(0);
  })
  .catch(err => console.error('Error:', err.message));
