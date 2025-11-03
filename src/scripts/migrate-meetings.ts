import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Meeting } from '../schemas/Meeting.model';
import { Types } from 'mongoose';

async function migrateMeetings() {
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const meetingModel = app.get<Model<Meeting>>(getModelToken(Meeting.name));
  
  try {
    // Find all meetings without currentHostId
    const meetingsWithoutCurrentHost = await meetingModel.find({
      currentHostId: { $exists: false }
    });
    
    
    let updatedCount = 0;
    
    for (const meeting of meetingsWithoutCurrentHost) {
      // Set currentHostId = hostId for existing meetings
      await meetingModel.findByIdAndUpdate(meeting._id, {
        currentHostId: meeting.hostId
      });
      
      updatedCount++;
    }
    
    
  } catch (error) {
  } finally {
    await app.close();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
}

export { migrateMeetings };
