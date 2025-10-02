# Test Data Setup for Attendance System

This guide will help you populate your database with realistic test data to see the attendance system in action.

## 🚀 Quick Setup

### 1. Run the Test Data Script

```bash
cd live-solution
node populate-test-data-simple.js
```

### 2. What Gets Created

**👥 Sample Members (6 users):**
- **John Doe** (Tutor) - john.doe@university.edu
- **김철수** (Student) - kim.student@university.edu  
- **이영희** (Student) - lee.student@university.edu
- **박민수** (Student) - park.student@university.edu
- **정수진** (Student) - jung.student@university.edu
- **Admin User** (Admin) - admin@university.edu

**Password for all accounts:** `password123`

**📅 Sample Meetings (3 meetings):**

1. **Data Structures and Algorithms - Lecture 1** (ENDED)
   - 4 participants with complete session data
   - 90-minute duration
   - Realistic join/leave times

2. **Web Development Workshop** (ENDED)  
   - 3 participants with reconnection data
   - 90-minute duration
   - Some students reconnected during the meeting

3. **Database Design Principles** (LIVE)
   - 2 participants currently online
   - Real-time attendance tracking

## 🎯 What You'll See

### Realistic Participant Data:
- **User Profiles**: Real names, emails, avatars, organizations
- **Session Tracking**: Multiple join/leave sessions with timestamps
- **Media States**: Mic/camera on/off states for each participant
- **Hand Raise Events**: Some participants have raised hands
- **Attendance Analytics**: Real participation percentages and durations

### Meeting Analytics:
- **Total Duration**: Calculated from actual start/end times
- **Participant Counts**: Real counts of who joined/left
- **Attendance Rates**: Based on actual participation time
- **Reconnection Tracking**: Shows how many times students reconnected

## 🔍 Testing the Attendance System

1. **Login as Tutor** (john.doe@university.edu):
   - Go to dashboard
   - Click "상세" (Details) button on any meeting
   - View comprehensive attendance analytics

2. **Login as Student** (kim.student@university.edu):
   - See meetings you participated in
   - View your own attendance data

3. **Login as Admin** (admin@university.edu):
   - Access all meetings and attendance data
   - Full system overview

## 📊 Sample Data Features

### Realistic Session Patterns:
- Students join at different times (5-minute intervals)
- Some students leave early or reconnect
- Realistic participation durations
- Varied media states (mic/camera on/off)

### Comprehensive User Data:
- Korean and English names
- University email addresses
- Profile pictures from Unsplash
- Organization and department info
- Different user roles (Tutor, Student, Admin)

### Meeting Scenarios:
- **Ended Meetings**: Complete attendance data with all participants
- **Live Meetings**: Real-time tracking with current participants
- **Mixed Participation**: Some students with full attendance, others with partial

## 🧹 Cleaning Up

To remove test data and start fresh:

```bash
# Connect to MongoDB and run:
db.members.deleteMany({email: {$regex: /@university\.edu$/}})
db.meetings.deleteMany({inviteCode: {$in: ["DSALG001", "WEBDEV001", "DBDESIGN001"]}})
db.participants.deleteMany({})
```

## 🎉 Next Steps

After running the script, you can:

1. **Test the Frontend**: Navigate to the attendance pages and see real data
2. **Export Data**: Try the CSV export functionality with realistic data
3. **View Analytics**: See how the attendance percentages and durations are calculated
4. **Test Real-time**: Join the live meeting to see real-time updates

The test data provides a realistic representation of how the attendance system works with actual user participation data!
