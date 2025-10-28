const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/hrde')
  .then(() => {
    return mongoose.connection.db.collection('participants').find({ status: 'LEFT' }).limit(3).toArray();
  })
  .then(participants => {
    console.log('Found', participants.length, 'participants with status LEFT:\n');
    participants.forEach((p, idx) => {
      console.log(`Participant ${idx + 1}:`);
      console.log('  _id:', p._id);
      console.log('  displayName:', p.displayName);
      console.log('  status:', p.status);
      console.log('  sessions count:', p.sessions?.length || 0);
      console.log('  totalDurationSec:', p.totalDurationSec);
      if (p.sessions && p.sessions.length > 0) {
        console.log('  First session:', {
          joinedAt: p.sessions[0].joinedAt,
          leftAt: p.sessions[0].leftAt || 'NULL',
          durationSec: p.sessions[0].durationSec
        });
      }
      console.log();
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
