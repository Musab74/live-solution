const { buildSchema } = require('graphql');

// Test if we can build a schema with the ParticipantAttendance type
const testSchema = `
  type ParticipantAttendance {
    _id: String!
    displayName: String!
    email: String
    firstName: String
    lastName: String
    systemRole: String
    avatarUrl: String
    organization: String
    department: String
    role: String!
    joinedAt: String!
    leftAt: String
    totalTime: Float!
    sessionCount: Float!
    isCurrentlyOnline: Boolean!
    status: String!
    micState: String!
    cameraState: String!
    hasHandRaised: Boolean!
    handRaisedAt: String
    handLoweredAt: String
    sessions: [Session!]!
  }

  type Session {
    joinedAt: String!
    leftAt: String
    durationSec: Float!
  }

  type Query {
    test: ParticipantAttendance
  }
`;

try {
  const schema = buildSchema(testSchema);
  console.log('✅ Schema built successfully');
  console.log('Available types:', Object.keys(schema.getTypeMap()));
} catch (error) {
  console.error('❌ Schema build failed:', error.message);
}


