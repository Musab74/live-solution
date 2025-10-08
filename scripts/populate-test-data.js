const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/livekit-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas
const memberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  systemRole: { type: String, enum: ['ADMIN', 'TUTOR', 'MEMBER'], default: 'MEMBER' },
  avatarUrl: { type: String },
  organization: { type: String },
  department: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, enum: ['CREATED', 'SCHEDULED', 'LIVE', 'ENDED'], default: 'CREATED' },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  currentHostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  inviteCode: { type: String, unique: true },
  isPrivate: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  scheduledFor: { type: Date },
  actualStartAt: { type: Date },
  endedAt: { type: Date },
  durationMin: { type: Number },
  maxParticipants: { type: Number, default: 100 },
  notes: { type: String },
  participantCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  joinedAt: { type: Date, required: true },
  leftAt: { type: Date },
  durationSec: { type: Number, default: 0 }
});

const participantSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['HOST', 'PARTICIPANT'], default: 'PARTICIPANT' },
  micState: { type: String, enum: ['ON', 'OFF', 'MUTED', 'MUTED_BY_HOST'], default: 'OFF' },
  cameraState: { type: String, enum: ['ON', 'OFF', 'OFF_BY_ADMIN'], default: 'OFF' },
  screenState: { type: String, enum: ['ON', 'OFF', 'OFF_BY_HOST'], default: 'OFF' },
  hasHandRaised: { type: Boolean, default: false },
  handRaisedAt: { type: Date },
  handLoweredAt: { type: Date },
  status: { type: String, enum: ['WAITING', 'APPROVED', 'REJECTED', 'ADMITTED', 'LEFT'], default: 'WAITING' },
  socketId: { type: String },
  lastSeenAt: { type: Date, default: Date.now },
  sessions: [sessionSchema],
  totalDurationSec: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', memberSchema);
const Meeting = mongoose.model('Meeting', meetingSchema);
const Participant = mongoose.model('Participant', participantSchema);

// Sample data
const sampleMembers = [
  {
    email: 'john.doe@university.edu',
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    systemRole: 'TUTOR',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'kim.student@university.edu',
    displayName: '김철수',
    firstName: '철수',
    lastName: '김',
    systemRole: 'MEMBER',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'lee.student@university.edu',
    displayName: '이영희',
    firstName: '영희',
    lastName: '이',
    systemRole: 'MEMBER',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'park.student@university.edu',
    displayName: '박민수',
    firstName: '민수',
    lastName: '박',
    systemRole: 'MEMBER',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'jung.student@university.edu',
    displayName: '정수진',
    firstName: '수진',
    lastName: '정',
    systemRole: 'MEMBER',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'choi.student@university.edu',
    displayName: '최지훈',
    firstName: '지훈',
    lastName: '최',
    systemRole: 'MEMBER',
    organization: 'Seoul National University',
    department: 'Computer Science',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'
  },
  {
    email: 'admin@university.edu',
    displayName: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    systemRole: 'ADMIN',
    organization: 'Seoul National University',
    department: 'IT Department',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  }
];

const sampleMeetings = [
  {
    title: 'Data Structures and Algorithms - Lecture 1',
    status: 'ENDED',
    inviteCode: 'DSALG001',
    isPrivate: false,
    scheduledFor: new Date('2025-01-15T09:00:00Z'),
    actualStartAt: new Date('2025-01-15T09:05:00Z'),
    endedAt: new Date('2025-01-15T10:35:00Z'),
    durationMin: 90,
    notes: 'Introduction to arrays, linked lists, and basic algorithms'
  },
  {
    title: 'Web Development Workshop',
    status: 'ENDED',
    inviteCode: 'WEBDEV001',
    isPrivate: false,
    scheduledFor: new Date('2025-01-16T14:00:00Z'),
    actualStartAt: new Date('2025-01-16T14:02:00Z'),
    endedAt: new Date('2025-01-16T15:32:00Z'),
    durationMin: 90,
    notes: 'React and Node.js hands-on workshop'
  },
  {
    title: 'Database Design Principles',
    status: 'LIVE',
    inviteCode: 'DBDESIGN001',
    isPrivate: false,
    scheduledFor: new Date('2025-01-17T10:00:00Z'),
    actualStartAt: new Date('2025-01-17T10:00:00Z'),
    notes: 'ER diagrams and normalization'
  }
];

async function populateTestData() {
  try {
    console.log('🗑️  Clearing existing data...');
    await Member.deleteMany({});
    await Meeting.deleteMany({});
    await Participant.deleteMany({});

    console.log('👥 Creating sample members...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const members = [];
    for (const memberData of sampleMembers) {
      const member = new Member({
        ...memberData,
        password: hashedPassword
      });
      await member.save();
      members.push(member);
      console.log(`✅ Created member: ${member.displayName} (${member.email})`);
    }

    console.log('📅 Creating sample meetings...');
    const meetings = [];
    for (let i = 0; i < sampleMeetings.length; i++) {
      const meetingData = sampleMeetings[i];
      const host = members.find(m => m.systemRole === 'TUTOR');
      
      const meeting = new Meeting({
        ...meetingData,
        hostId: host._id,
        currentHostId: host._id,
        participantCount: 0
      });
      await meeting.save();
      meetings.push(meeting);
      console.log(`✅ Created meeting: ${meeting.title}`);
    }

    console.log('👥 Creating sample participants and sessions...');
    
    // Meeting 1: Data Structures Lecture (ENDED)
    const meeting1 = meetings[0];
    const students1 = members.filter(m => m.systemRole === 'MEMBER').slice(0, 4);
    
    for (let i = 0; i < students1.length; i++) {
      const student = students1[i];
      const joinTime = new Date(meeting1.actualStartAt.getTime() + (i * 5 * 60 * 1000)); // 5 min intervals
      const leaveTime = new Date(meeting1.endedAt.getTime() - (i * 2 * 60 * 1000)); // 2 min before end
      const duration = Math.floor((leaveTime - joinTime) / 1000);
      
      const participant = new Participant({
        meetingId: meeting1._id,
        userId: student._id,
        displayName: student.displayName,
        role: 'PARTICIPANT',
        status: 'LEFT',
        micState: Math.random() > 0.5 ? 'ON' : 'OFF',
        cameraState: Math.random() > 0.7 ? 'ON' : 'OFF',
        hasHandRaised: Math.random() > 0.8,
        sessions: [{
          joinedAt: joinTime,
          leftAt: leaveTime,
          durationSec: duration
        }],
        totalDurationSec: duration,
        lastSeenAt: leaveTime
      });
      
      await participant.save();
      console.log(`✅ Created participant: ${student.displayName} for ${meeting1.title}`);
    }

    // Meeting 2: Web Development Workshop (ENDED)
    const meeting2 = meetings[1];
    const students2 = members.filter(m => m.systemRole === 'MEMBER').slice(0, 3);
    
    for (let i = 0; i < students2.length; i++) {
      const student = students2[i];
      const joinTime = new Date(meeting2.actualStartAt.getTime() + (i * 3 * 60 * 1000));
      const leaveTime = new Date(meeting2.endedAt.getTime() - (i * 5 * 60 * 1000));
      const duration = Math.floor((leaveTime - joinTime) / 1000);
      
      // Some students reconnected
      const sessions = [{
        joinedAt: joinTime,
        leftAt: new Date(joinTime.getTime() + (duration * 0.7 * 1000)),
        durationSec: Math.floor(duration * 0.7)
      }];
      
      if (i === 1) { // Second student reconnected
        const reconnectTime = new Date(joinTime.getTime() + (duration * 0.5 * 1000));
        sessions.push({
          joinedAt: reconnectTime,
          leftAt: leaveTime,
          durationSec: Math.floor(duration * 0.3)
        });
      }
      
      const totalDuration = sessions.reduce((sum, s) => sum + s.durationSec, 0);
      
      const participant = new Participant({
        meetingId: meeting2._id,
        userId: student._id,
        displayName: student.displayName,
        role: 'PARTICIPANT',
        status: 'LEFT',
        micState: Math.random() > 0.4 ? 'ON' : 'OFF',
        cameraState: Math.random() > 0.6 ? 'ON' : 'OFF',
        hasHandRaised: Math.random() > 0.7,
        sessions: sessions,
        totalDurationSec: totalDuration,
        lastSeenAt: leaveTime
      });
      
      await participant.save();
      console.log(`✅ Created participant: ${student.displayName} for ${meeting2.title}`);
    }

    // Meeting 3: Database Design (LIVE)
    const meeting3 = meetings[2];
    const students3 = members.filter(m => m.systemRole === 'MEMBER').slice(0, 2);
    
    for (let i = 0; i < students3.length; i++) {
      const student = students3[i];
      const joinTime = new Date(meeting3.actualStartAt.getTime() + (i * 2 * 60 * 1000));
      const now = new Date();
      const duration = Math.floor((now - joinTime) / 1000);
      
      const participant = new Participant({
        meetingId: meeting3._id,
        userId: student._id,
        displayName: student.displayName,
        role: 'PARTICIPANT',
        status: 'ADMITTED',
        micState: Math.random() > 0.3 ? 'ON' : 'OFF',
        cameraState: Math.random() > 0.5 ? 'ON' : 'OFF',
        hasHandRaised: Math.random() > 0.8,
        sessions: [{
          joinedAt: joinTime,
          leftAt: undefined,
          durationSec: duration
        }],
        totalDurationSec: duration,
        lastSeenAt: now
      });
      
      await participant.save();
      console.log(`✅ Created participant: ${student.displayName} for ${meeting3.title}`);
    }

    // Update meeting participant counts
    for (const meeting of meetings) {
      const participantCount = await Participant.countDocuments({ 
        meetingId: meeting._id,
        status: { $in: ['ADMITTED', 'WAITING', 'APPROVED'] }
      });
      await Meeting.findByIdAndUpdate(meeting._id, { participantCount });
    }

    console.log('\n🎉 Test data population completed successfully!');
    console.log(`📊 Created ${members.length} members, ${meetings.length} meetings, and participants`);
    console.log('\n📝 Login credentials:');
    console.log('Email: john.doe@university.edu | Password: password123 (Tutor)');
    console.log('Email: kim.student@university.edu | Password: password123 (Student)');
    console.log('Email: admin@university.edu | Password: password123 (Admin)');
    console.log('\n🔗 You can now test the attendance system with real-looking data!');

  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    mongoose.connection.close();
  }
}

populateTestData();

