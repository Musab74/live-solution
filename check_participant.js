const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/hrde')
  .then(() => {
    return mongoose.connection.db.collection('participants').findOne({ 
      _id: new mongoose.Types.ObjectId('68febc773c384326e1faf4fc')
    });
  })
  .then(p => {
    console.log('Participant status:', p?.status);
    console.log('Sessions count:', p?.sessions?.length || 0);
    console.log('Has sessions array?', Array.isArray(p?.sessions));
    console.log('totalDurationSec:', p?.totalDurationSec);
    console.log('\nFull sessions:', JSON.stringify(p?.sessions, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
