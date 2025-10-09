const mongoose = require('mongoose');

// Connect to your MongoDB database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/livekit-app';

async function clearDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear all collections
    const collections = ['members', 'meetings', 'participants', 'chats', 'vods'];
    
    for (const collection of collections) {
      const result = await mongoose.connection.db.collection(collection).deleteMany({});
      console.log(`🗑️  Cleared ${result.deletedCount} documents from ${collection}`);
    }

    console.log('\n🎉 Database cleared successfully!');
    console.log('📝 Your database is now empty and ready for real data.');
    console.log('\n✅ No hardcoded mock data will interfere with your real users and meetings.');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

clearDatabase();


