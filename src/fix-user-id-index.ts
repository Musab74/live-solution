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

    console.log('Dropping old unique email index...');
    try {
      await membersCollection.dropIndex('email_1');
      console.log('✅ Unique email index dropped successfully');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('Email index does not exist, skipping drop');
      } else {
        console.warn('Error dropping email index:', error.message);
      }
    }

    console.log('Dropping old user_id index...');
    try {
      await membersCollection.dropIndex('user_id_1');
      console.log('Old user_id index dropped successfully');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('user_id index does not exist, skipping drop');
      } else {
        console.warn('Error dropping user_id index:', error.message);
      }
    }

    console.log('Creating new sparse unique index on user_id...');
    await membersCollection.createIndex(
      { user_id: 1 },
      { unique: true, sparse: true }
    );
    console.log('New sparse unique index on user_id created successfully');

    console.log('Creating non-unique index on email...');
    await membersCollection.createIndex({ email: 1 }, { unique: false });
    console.log('Non-unique email index created successfully');

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

