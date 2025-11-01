import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from .env file...');
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️  No .env file found, using environment variables only');
}

async function fixUserIdIndex() {
  try {
    // Connect to MongoDB - Use same logic as database.module.ts
    const isProd = process.env.NODE_ENV === 'production';
    const MONGODB_URI = isProd ? process.env.MONGODB_PROD : process.env.MONGODB;
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI not found in environment variables. Set MONGODB or MONGODB_PROD');
    }
    
    console.log(`Connecting to MongoDB (${isProd ? 'PROD' : 'DEV'})...`);
    console.log(`URI: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***:***@')}`); // Hide credentials
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

