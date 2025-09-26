#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function fixMeetingsDatabase() {
  console.log('🔄 Starting database fix for meetings...');
  
  // Get MongoDB URI from environment or use default
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrde';
  console.log(`🔌 Connecting to: ${uri}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const meetingsCollection = db.collection('meetings');
    
    // Find all meetings without currentHostId
    const meetingsWithoutCurrentHost = await meetingsCollection.find({
      currentHostId: { $exists: false }
    }).toArray();
    
    console.log(`📊 Found ${meetingsWithoutCurrentHost.length} meetings without currentHostId`);
    
    if (meetingsWithoutCurrentHost.length === 0) {
      console.log('✅ All meetings already have currentHostId field');
      return;
    }
    
    let updatedCount = 0;
    
    for (const meeting of meetingsWithoutCurrentHost) {
      try {
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
          console.log(`✅ Updated meeting ${meeting._id}: currentHostId = hostId`);
        } else {
          console.log(`⚠️ Failed to update meeting ${meeting._id}`);
        }
      } catch (error) {
        console.error(`❌ Error updating meeting ${meeting._id}:`, error.message);
      }
    }
    
    console.log(`🎉 Database fix completed! Updated ${updatedCount} meetings`);
    
    // Verify the fix
    const remainingWithoutCurrentHost = await meetingsCollection.countDocuments({
      currentHostId: { $exists: false }
    });
    
    console.log(`📊 Remaining meetings without currentHostId: ${remainingWithoutCurrentHost}`);
    
    if (remainingWithoutCurrentHost === 0) {
      console.log('✅ All meetings now have currentHostId field!');
    } else {
      console.log('⚠️ Some meetings still missing currentHostId field');
    }
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixMeetingsDatabase().catch(console.error);
