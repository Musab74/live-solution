import * as mongoose from 'mongoose';

async function fixUserIdIndex() {
  try {
    // Connect to MongoDB - USE PRODUCTION URI
    const MONGODB_URI = process.env.MONGODB_PROD || 'mongodb://localhost:27017/LiveProd';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const membersCollection = db.collection('members');

    console.log('Dropping old user_id index...');
    try {
      await membersCollection.dropIndex('user_id_1');
      console.log('Old index dropped successfully');
    } catch (error) {
      if (error.code === 27) {
        console.log('Index does not exist, skipping drop');
      } else {
        console.warn('Error dropping index:', error.message);
      }
    }

    console.log('Creating new sparse index on user_id...');
    await membersCollection.createIndex(
      { user_id: 1 },
      { unique: true, sparse: true }
    );
    console.log('New sparse index created successfully');

    console.log('Checking for duplicate null user_id values...');
    const duplicates = await membersCollection.aggregate([
      { $match: { user_id: null } },
      { $group: { _id: '$user_id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log('Found multiple documents with null user_id:', duplicates);
      console.log('This is now allowed with the sparse index');
    } else {
      console.log('No duplicate null values found');
    }

    // Get index info
    const indexes = await membersCollection.indexes();
    console.log('\nCurrent indexes on members collection:');
    indexes.forEach(idx => console.log(JSON.stringify(idx, null, 2)));

    await mongoose.disconnect();
    console.log('\nDone! Database fixed successfully.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing database:', error);
    process.exit(1);
  }
}

fixUserIdIndex();

