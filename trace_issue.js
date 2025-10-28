const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    console.log('Checking recent participants...\n');
    return mongoose.connection.db.collection('participants')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
  })
  .then(participants => {
    participants.forEach((p, idx) => {
      console.log(`\n${idx + 1}. Participant: ${p.displayName}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Sessions: ${p.sessions?.length || 0}`);
      console.log(`   totalDurationSec: ${p.totalDurationSec || 0}`);
      if (p.sessions && p.sessions.length > 0) {
        p.sessions.forEach((s, sidx) => {
          console.log(`   Session ${sidx + 1}: joinedAt=${s.joinedAt}, leftAt=${s.leftAt || 'NULL'}, duration=${s.durationSec}`);
        });
      }
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
