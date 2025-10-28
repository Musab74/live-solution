const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    console.log('🔍 Finding participants with null sessions...\n');
    return mongoose.connection.db.collection('participants')
      .find({ $expr: { $gt: [{ $size: { $filter: { input: "$sessions", cond: { $eq: ["$$this", null] } } } }, 0] } })
      .toArray();
  })
  .then(participants => {
    if (participants.length === 0) {
      console.log('✅ No participants with null sessions found');
      return mongoose.connection.close();
    }
    
    console.log(`Found ${participants.length} participants with null sessions\n`);
    
    return Promise.all(participants.map(p => {
      const cleanedSessions = p.sessions.filter(s => s !== null && s !== undefined && s.joinedAt);
      console.log(`Participant ${p._id}: Cleaning ${p.sessions.length} → ${cleanedSessions.length} sessions`);
      
      return mongoose.connection.db.collection('participants').updateOne(
        { _id: p._id },
        { $set: { sessions: cleanedSessions } }
      );
    }));
  })
  .then(() => {
    console.log('\n✅ Fixed all participants with null sessions');
    return mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err.message);
    mongoose.connection.close();
  });
