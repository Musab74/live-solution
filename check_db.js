const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/hrde')
  .then(() => {
    console.log('Connected to database');
    return mongoose.connection.db.listCollections().toArray();
  })
  .then(collections => {
    console.log('Collections:', collections.map(c => c.name));
    return mongoose.connection.db.collection('participants').countDocuments();
  })
  .then(count => {
    console.log('Total participants:', count);
    return mongoose.connection.db.collection('participants').findOne({});
  })
  .then(p => {
    if (p) {
      console.log('\nSample participant fields:', Object.keys(p));
      console.log('status:', p.status);
      console.log('sessions:', p.sessions);
      console.log('totalDurationSec:', p.totalDurationSec);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
