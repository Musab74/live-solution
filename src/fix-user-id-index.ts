import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
}

async function fixUserIdIndex() {
  try {
    // Connect to MongoDB - Use same logic as database.module.ts
    const isProd = process.env.NODE_ENV === 'production';
    const MONGODB_URI = isProd ? process.env.MONGODB_PROD : process.env.MONGODB;
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI not found in environment variables. Set MONGODB or MONGODB_PROD');
    }
    

    const db = mongoose.connection.db;
    const membersCollection = db.collection('members');

    try {
      await membersCollection.dropIndex('email_1');
    } catch (error: any) {
      if (error.code === 27) {
      } else {
      }
    }

    try {
      await membersCollection.dropIndex('user_id_1');
    } catch (error: any) {
      if (error.code === 27) {
      } else {
      }
    }

    await membersCollection.createIndex(
      { user_id: 1 },
      { unique: true, sparse: true }
    );

    await membersCollection.createIndex({ email: 1 }, { unique: false });

    // Get index info
    const indexes = await membersCollection.indexes();

    await mongoose.disconnect();
    
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

fixUserIdIndex();

