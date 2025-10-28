const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    console.log('✅ Connected to live-solution database');
    return mongoose.connection.db.collection('participants').findOne({ 
      _id: new mongoose.Types.ObjectId('68febc773c384326e1faf4fc')
    });
  })
  .then(p => {
    if (!p) {
      console.log('❌ Participant not found');
      return mongoose.connection.db.collection('participants').find({}).limit(3).toArray();
    }
    console.log('\n📊 Participant found:');
    console.log('  _id:', p._id);
    console.log('  status:', p.status);
    console.log('  displayName:', p.displayName);
    console.log('  sessions count:', p.sessions?.length || 0);
    console.log('  totalDurationSec:', p.totalDurationSec);
    
    if (p.sessions && p.sessions.length > 0) {
      console.log('\n📋 Sessions:');
      p.sessions.forEach((s, idx) => {
        console.log(`  Session ${idx + 1}:`);
        console.log('    joinedAt:', s.joinedAt);
        console.log('    leftAt:', s.leftAt || 'NULL (still active)');
        console.log('    durationSec:', s.durationSec);
      });
    } else {
      console.log('\n❌ NO SESSIONS! This participant has no sessions array.');
    }
    process.exit(0);
  })
  .then(arr => {
    if (arr) {
      console.log('\nShowing first 3 participants instead:');
      arr.forEach(p => console.log(p._id, '- status:', p.status, '- sessions:', p.sessions?.length || 0));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
