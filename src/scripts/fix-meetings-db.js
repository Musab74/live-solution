const { MongoClient } = require('mongodb');

async function fixMeetingsDatabase() {
  
  // Replace with your actual MongoDB connection string
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    
    const db = client.db();
    const meetingsCollection = db.collection('meetings');
    
    // Find all meetings without currentHostId
    const meetingsWithoutCurrentHost = await meetingsCollection.find({
      currentHostId: { $exists: false }
    }).toArray();
    
    
    if (meetingsWithoutCurrentHost.length === 0) {
      return;
    }
    
    let updatedCount = 0;
    
    for (const meeting of meetingsWithoutCurrentHost) {
      // Set currentHostId = hostId for existing meetings
      const result = await meetingsCollection.updateOne(
        { _id: meeting._id },
        { 
          $set: { 
            currentHostId: meeting.hostId 
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
      } else {
      }
    }
    
    
    // Verify the fix
    const remainingWithoutCurrentHost = await meetingsCollection.countDocuments({
      currentHostId: { $exists: false }
    });
    
    
    if (remainingWithoutCurrentHost === 0) {
    } else {
    }
    
  } catch (error) {
  } finally {
    await client.close();
  }
}

// Run the fix
