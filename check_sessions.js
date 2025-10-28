const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/hrde', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    const db = mongoose.connection.db;
    return db.collection('participants').findOne({ 
      _id: new mongoose.Types.ObjectId('68febc773c384326e1faf4fc')
    });
  })
  .then(participant => {
    console.log('\n📊 Participant Sessions:');
    console.log('Total sessions:', participant?.sessions?.length || 0);
    participant?.sessions?.forEach((session, idx) => {
      console.log(`\nSession ${idx + 1}:`);
      console.log('  joinedAt:', session.joinedAt);
      console.log('  leftAt:', session.leftAt || 'NULL');
      console.log('  durationSec:', session.durationSec);
    });
    console.log('\nTotal durationSec:', participant?.totalDurationSec);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
