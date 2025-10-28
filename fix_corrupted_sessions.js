const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/live-solution')
  .then(() => {
    console.log('Finding participants with corrupted sessions...\n');
    return mongoose.connection.db.collection('participants').find({}).toArray();
  })
  .then(participants => {
    let fixedCount = 0;
    return Promise.all(participants.map(p => {
      if (!p.sessions || p.sessions.length === 0) return Promise.resolve();
      
      const originalLength = p.sessions.length;
      // Filter out null and empty sessions
      const cleanedSessions = p.sessions.filter(s => 
        s !== null && 
        s !== undefined && 
        typeof s === 'object' && 
        s.joinedAt !== undefined && 
        s.joinedAt !== null &&
        Object.keys(s).length > 0
      );
      
      if (cleanedSessions.length !== originalLength) {
        console.log(`Fixing participant ${p._id}:`);
        console.log(`  Before: ${originalLength} sessions`);
        console.log(`  After: ${cleanedSessions.length} sessions`);
        console.log(`  Removed ${originalLength - cleanedSessions.length} corrupted sessions`);
        fixedCount++;
        
        return mongoose.connection.db.collection('participants').updateOne(
          { _id: p._id },
          { $set: { sessions: cleanedSessions } }
        );
      }
      return Promise.resolve();
    })).then(() => {
      console.log(`\n✅ Fixed ${fixedCount} participants`);
      return mongoose.connection.close();
    });
  })
  .catch(err => {
    console.error('Error:', err.message);
    mongoose.connection.close();
  });
