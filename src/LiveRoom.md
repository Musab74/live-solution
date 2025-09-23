import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_MEETING_BY_ID,
  GET_PARTICIPANTS_BY_MEETING,
  GET_WAITING_PARTICIPANTS,
  GET_CHAT_HISTORY,
  GET_RAISED_HANDS,
  GET_SCREEN_SHARE_STATUS,
  GET_PARTICIPANT_STATS,
  GET_CHAT_STATS,
  START_MEETING,
  END_MEETING,
  JOIN_MEETING,
  LEAVE_MEETING,
  UPDATE_SESSION,
  FORCE_MUTE,
  FORCE_CAMERA_OFF,
  REMOVE_PARTICIPANT,
  TRANSFER_HOST,
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  ADMIT_PARTICIPANT,
  RAISE_HAND,
  LOWER_HAND,
  HOST_LOWER_HAND,
  LOWER_ALL_HANDS,
  FORCE_SCREEN_SHARE_CONTROL,
  UPDATE_SCREEN_SHARE_INFO,
  DELETE_CHAT_MESSAGE,
  LOCK_ROOM,
  UNLOCK_ROOM,
  MEETING_UPDATED,
  PARTICIPANT_JOINED,
  PARTICIPANT_LEFT,
  PARTICIPANT_UPDATED,
  CHAT_MESSAGE_ADDED,
  HAND_RAISED,
  HAND_LOWERED,
  SCREEN_SHARE_STARTED,
  SCREEN_SHARE_STOPPED,
  Meeting,
  Participant,
  ChatMessage,
  WaitingParticipant,
  ParticipantStats,
  ChatStats,
  RaisedHandsResponse,
  ScreenShareStatusResponse
} from '../LiveRoomQueries';

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string; // identify current user
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({
  meetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'waiting' | 'chat' | 'analytics' | null>(
    role === 'HOST' ? 'participants' : null
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [participantChat, setParticipantChat] = useState<{
    [key: string]: { _id: string; text: string; displayName: string; createdAt: string }[];
  }>({});
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'students'>('students');
  const [mainVideoParticipant, setMainVideoParticipant] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');

  // GraphQL Queries
  const { data: meetingData, loading: meetingLoading, error: meetingError } = useQuery<{ getMeetingById: Meeting }>(
    GET_MEETING_BY_ID,
    {
      variables: { meetingId: actualMeetingId },
      skip: !actualMeetingId,
      pollInterval: 5000, // Poll every 5 seconds
    }
  );

  const { data: participantsData, loading: participantsLoading } = useQuery<{ getParticipantsByMeeting: Participant[] }>(
    GET_PARTICIPANTS_BY_MEETING,
    {
      variables: { meetingId: actualMeetingId },
      skip: !actualMeetingId,
      pollInterval: 3000, // Poll every 3 seconds
    }
  );

  const { data: waitingParticipantsData, loading: waitingLoading } = useQuery<{ getWaitingParticipants: WaitingParticipant[] }>(
    GET_WAITING_PARTICIPANTS,
    {
      variables: { meetingId: actualMeetingId },
      skip: !actualMeetingId || role !== 'HOST',
      pollInterval: 2000, // Poll every 2 seconds
    }
  );

  const { data: chatData, loading: chatLoading } = useQuery<{ getChatHistory: { messages: ChatMessage[] } }>(
    GET_CHAT_HISTORY,
    {
      variables: { 
        input: { 
          meetingId: actualMeetingId,
          limit: 50
        } 
      },
      skip: !actualMeetingId,
      pollInterval: 1000, // Poll every 1 second
    }
  );

  const { data: raisedHandsData, loading: raisedHandsLoading } = useQuery<{ getRaisedHands: RaisedHandsResponse }>(
    GET_RAISED_HANDS,
    {
      variables: { 
        input: { meetingId: actualMeetingId } 
      },
      skip: !actualMeetingId,
      pollInterval: 2000, // Poll every 2 seconds
    }
  );

  const { data: screenShareData, loading: screenShareLoading } = useQuery<{ getScreenShareStatus: ScreenShareStatusResponse }>(
    GET_SCREEN_SHARE_STATUS,
    {
      variables: { 
        input: { meetingId: actualMeetingId } 
      },
      skip: !actualMeetingId,
      pollInterval: 2000, // Poll every 2 seconds
    }
  );

  const { data: participantStatsData, loading: statsLoading } = useQuery<{ getParticipantStats: ParticipantStats }>(
    GET_PARTICIPANT_STATS,
    {
      variables: { meetingId: actualMeetingId },
      skip: !actualMeetingId,
      pollInterval: 5000, // Poll every 5 seconds
    }
  );

  const { data: chatStatsData, loading: chatStatsLoading } = useQuery<{ getChatStats: ChatStats }>(
    GET_CHAT_STATS,
    {
      variables: { meetingId: actualMeetingId },
      skip: !actualMeetingId,
      pollInterval: 10000, // Poll every 10 seconds
    }
  );

  // GraphQL Mutations
  const [startMeeting] = useMutation(START_MEETING);
  const [endMeeting] = useMutation(END_MEETING);
  const [joinMeeting] = useMutation(JOIN_MEETING);
  const [leaveMeeting] = useMutation(LEAVE_MEETING);
  const [updateSession] = useMutation(UPDATE_SESSION);
  const [forceMute] = useMutation(FORCE_MUTE);
  const [forceCameraOff] = useMutation(FORCE_CAMERA_OFF);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);
  const [transferHost] = useMutation(TRANSFER_HOST);
  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT);
  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT);
  const [admitParticipant] = useMutation(ADMIT_PARTICIPANT);
  const [raiseHand] = useMutation(RAISE_HAND);
  const [lowerHand] = useMutation(LOWER_HAND);
  const [hostLowerHand] = useMutation(HOST_LOWER_HAND);
  const [lowerAllHands] = useMutation(LOWER_ALL_HANDS);
  const [forceScreenShareControl] = useMutation(FORCE_SCREEN_SHARE_CONTROL);
  const [updateScreenShareInfo] = useMutation(UPDATE_SCREEN_SHARE_INFO);
  const [deleteChatMessage] = useMutation(DELETE_CHAT_MESSAGE);
  const [lockRoom] = useMutation(LOCK_ROOM);
  const [unlockRoom] = useMutation(UNLOCK_ROOM);

  // Real-time subscriptions
  useSubscription(MEETING_UPDATED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Meeting updated:', data);
    }
  });

  useSubscription(PARTICIPANT_JOINED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Participant joined:', data);
    }
  });

  useSubscription(PARTICIPANT_LEFT, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Participant left:', data);
    }
  });

  useSubscription(PARTICIPANT_UPDATED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Participant updated:', data);
    }
  });

  useSubscription(CHAT_MESSAGE_ADDED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('New chat message:', data);
    }
  });

  useSubscription(HAND_RAISED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Hand raised:', data);
    }
  });

  useSubscription(HAND_LOWERED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Hand lowered:', data);
    }
  });

  useSubscription(SCREEN_SHARE_STARTED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Screen share started:', data);
    }
  });

  useSubscription(SCREEN_SHARE_STOPPED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }) => {
      console.log('Screen share stopped:', data);
    }
  });

  // Derived data
  const meeting = meetingData?.getMeetingById;
  const participants = participantsData?.getParticipantsByMeeting || [];
  const waitingParticipants = waitingParticipantsData?.getWaitingParticipants || [];
  const chatMessages = chatData?.getChatHistory?.messages || [];
  const raisedHands = raisedHandsData?.getRaisedHands?.raisedHands || [];
  const screenShareStatus = screenShareData?.getScreenShareStatus;
  const participantStats = participantStatsData?.getParticipantStats;
  const chatStats = chatStatsData?.getChatStats;

  // Check if hand is raised for current user
  const isHandRaised = raisedHands.some(hand => hand.participantId === userId);

  useEffect(() => {
    if (!meetingId && typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      if (id && id !== 'livestream') {
        setActualMeetingId(id);
      } else {
        setActualMeetingId('68cb9c9cd2d6ea30031d018a');
      }
    } else if (meetingId) {
      setActualMeetingId(meetingId);
    } else {
      setActualMeetingId('68cb9c9cd2d6ea30031d018a');
    }

    // Set loading to false after initial setup
      setLoading(false);
  }, [meetingId]);

  // Handler functions
  const handleToggleHandRaise = useCallback(async () => {
    if (!actualMeetingId || !userId) return;
    
    try {
      if (isHandRaised) {
        await lowerHand({
          variables: {
            input: {
              participantId: userId,
              meetingId: actualMeetingId,
              reason: 'User lowered hand'
            }
          }
        });
      } else {
        await raiseHand({
          variables: {
            input: {
              participantId: userId,
              meetingId: actualMeetingId,
              reason: 'User raised hand'
            }
          }
        });
      }
    } catch (error) {
      console.error('Error toggling hand raise:', error);
    }
  }, [isHandRaised, actualMeetingId, userId, lowerHand, raiseHand]);

  const handleStartMeeting = useCallback(async () => {
    if (!actualMeetingId) return;
    
    try {
      await startMeeting({
        variables: { meetingId: actualMeetingId }
      });
    } catch (error) {
      console.error('Error starting meeting:', error);
    }
  }, [actualMeetingId, startMeeting]);

  const handleEndMeeting = useCallback(async () => {
    if (!actualMeetingId) return;
    
    try {
      await endMeeting({
        variables: { meetingId: actualMeetingId }
      });
    } catch (error) {
      console.error('Error ending meeting:', error);
    }
  }, [actualMeetingId, endMeeting]);

  const handleForceMute = useCallback(async (participantId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await forceMute({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: participantId,
            track: 'MIC'
          }
        }
      });
    } catch (error) {
      console.error('Error force muting participant:', error);
    }
  }, [actualMeetingId, forceMute]);

  const handleForceCameraOff = useCallback(async (participantId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await forceCameraOff({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: participantId
          }
        }
      });
    } catch (error) {
      console.error('Error force camera off:', error);
    }
  }, [actualMeetingId, forceCameraOff]);

  const handleRemoveParticipant = useCallback(async (participantId: string) => {
    try {
      await removeParticipant({
        variables: { participantId }
      });
    } catch (error) {
      console.error('Error removing participant:', error);
    }
  }, [removeParticipant]);

  const handleApproveParticipant = useCallback(async (participantId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await approveParticipant({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: participantId
          }
        }
      });
    } catch (error) {
      console.error('Error approving participant:', error);
    }
  }, [actualMeetingId, approveParticipant]);

  const handleRejectParticipant = useCallback(async (participantId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await rejectParticipant({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: participantId,
            reason: 'Rejected by host'
          }
        }
      });
    } catch (error) {
      console.error('Error rejecting participant:', error);
    }
  }, [actualMeetingId, rejectParticipant]);

  const handleHostLowerHand = useCallback(async (participantId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await hostLowerHand({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: participantId,
            reason: 'Lowered by host'
          }
        }
      });
    } catch (error) {
      console.error('Error lowering hand:', error);
    }
  }, [actualMeetingId, hostLowerHand]);

  const handleScreenShareToggle = useCallback(async () => {
    if (!actualMeetingId || !userId) return;
    
    try {
      const newScreenState = isScreenSharing ? 'OFF' : 'ON';
      await forceScreenShareControl({
        variables: {
          input: {
            meetingId: actualMeetingId,
            participantId: userId,
            screenState: newScreenState
          }
        }
      });
      setIsScreenSharing(!isScreenSharing);
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [actualMeetingId, userId, isScreenSharing, forceScreenShareControl]);

  const handleUpdateSession = useCallback(async (micState?: string, cameraState?: string) => {
    if (!actualMeetingId || !userId) return;
    
    try {
      await updateSession({
        variables: {
          input: {
            participantId: userId,
            meetingId: actualMeetingId,
            micState: micState || (isMicOn ? 'ON' : 'OFF'),
            cameraState: cameraState || (isVideoOn ? 'ON' : 'OFF')
          }
        }
      });
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }, [actualMeetingId, userId, isMicOn, isVideoOn, updateSession]);

  const handleMicToggle = useCallback(async () => {
    const newMicState = !isMicOn;
    setIsMicOn(newMicState);
    await handleUpdateSession(newMicState ? 'ON' : 'OFF');
  }, [isMicOn, handleUpdateSession]);

  const handleVideoToggle = useCallback(async () => {
    const newVideoState = !isVideoOn;
    setIsVideoOn(newVideoState);
    await handleUpdateSession(undefined, newVideoState ? 'ON' : 'OFF');
  }, [isVideoOn, handleUpdateSession]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!actualMeetingId) return;
    
    try {
      await deleteChatMessage({
        variables: {
          input: {
            messageId: messageId,
            meetingId: actualMeetingId
          }
        }
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, [actualMeetingId, deleteChatMessage]);

  // Check if we're still loading
  const isLoading = meetingLoading || participantsLoading || chatLoading;

  if (loading || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            border: '3px solid #333',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}
        ></div>
        <p>Loading Live Stream Room...</p>
        {meetingError && (
          <p style={{ color: '#ff6b6b', marginTop: '10px' }}>
            Error loading meeting: {meetingError.message}
          </p>
        )}
      </div>
    );
  }

  if (!meeting) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <p>Meeting not found or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      color: '#2c3e50',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-right 0.3s ease',
        marginRight: ((activeTab && activeTab !== 'chat' && !selectedParticipant) || selectedParticipant) ? '320px' : '0px',
        minWidth: 0
      }}>
        {/* Top Header */}
        <div style={{
          height: '60px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e1e8ed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          minHeight: '60px',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            minWidth: 0,
            flex: 1
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <img 
                src="/logoHRDe.png" 
                alt="HRDE" 
                style={{ 
                  width: '28px', 
                  height: '28px',
                  objectFit: 'contain'
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                color: '#2c3e50', 
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {meeting.title}
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                ID: {meeting.inviteCode}
              </p>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            flexShrink: 0
          }}>
            <div style={{
              backgroundColor: meeting.status === 'LIVE' ? '#ef4444' : '#6b7280',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                position: 'relative', 
                width: '8px', 
                height: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  zIndex: 3,
                  position: 'relative'
                }}></div>
                <div style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  width: '12px',
                  height: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite 0.5s',
                  zIndex: 0
                }}></div>
              </div>
              {meeting.status === 'LIVE' ? 'Live' : meeting.status}
            </div>
            
            {role === 'HOST' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                  onClick={meeting.status === 'LIVE' ? handleEndMeeting : handleStartMeeting}
                style={{
                  padding: '6px 12px',
                    backgroundColor: meeting.status === 'LIVE' ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                  {meeting.status === 'LIVE' ? 'End Meeting' : 'Start Meeting'}
              </button>
              </div>
            )}
          </div>
        </div>

        {/* Visual Separator */}
        <div style={{
          height: '2px',
          backgroundColor: '#e2e8f0',
          margin: '0 12px',
          borderRadius: '1px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#f5f5f5',
            padding: '0 15px',
            fontSize: '10px',
            color: '#94a3b8',
            fontWeight: '500'
          }}>
            • • •
          </div>
        </div>

        {/* Participants Video Grid - Top Position */}
        <div style={{
          height: '100px',
          backgroundColor: '#f8fafc',
          margin: '20px 12px 12px 12px',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* Host Video */}
          <div 
            onClick={() => setMainVideoParticipant(null)}
            style={{
              minWidth: '80px',
              width: '80px',
              height: '80px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: mainVideoParticipant === null ? '2px solid #10b981' : '2px solid #3b82f6',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = mainVideoParticipant === null ? '#10b981' : '#3b82f6';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '3px', color: '#6c757d' }}>👨‍🏫</div>
              <p style={{ margin: 0, fontSize: '9px', color: '#333' }}>Host</p>
            </div>
            <div style={{
              position: 'absolute',
              bottom: '2px',
              left: '2px',
              backgroundColor: '#007bff',
              color: 'white',
              padding: '2px 4px',
              borderRadius: '2px',
              fontSize: '7px',
              fontWeight: 'bold'
            }}>
              HOST
            </div>
          </div>

          {/* Participant Videos */}
          {participants.map((participant) => {
            const isHandRaised = raisedHands.some(hand => hand.participantId === participant._id);
            return (
            <div 
              key={participant._id} 
              onClick={() => setMainVideoParticipant(mainVideoParticipant === participant._id ? null : participant._id)}
              style={{
                minWidth: '80px',
                width: '80px',
                height: '80px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                  border: mainVideoParticipant === participant._id ? '2px solid #3b82f6' : (isHandRaised ? '2px solid #f59e0b' : '2px solid #94a3b8'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = mainVideoParticipant === participant._id ? '#3b82f6' : (isHandRaised ? '#f59e0b' : '#94a3b8');
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', marginBottom: '3px', color: '#6c757d' }}>👤</div>
                <p style={{ margin: 0, fontSize: '8px', color: '#333' }}>
                    {participant.displayName.split(' ')[1] || participant.displayName}
                </p>
              </div>
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                display: 'flex',
                gap: '2px'
              }}>
                <span style={{ 
                    color: participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST' ? '#dc3545' : '#28a745',
                  fontSize: '8px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                    {(participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST') && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      width: '10px',
                      height: '1px',
                      backgroundColor: '#dc3545',
                      zIndex: 1
                    }}></div>
                  )}
                </span>
                <span style={{ 
                  color: participant.cameraState === 'ON' ? '#007bff' : '#dc3545',
                  fontSize: '8px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                  {participant.cameraState !== 'ON' && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      width: '10px',
                      height: '1px',
                      backgroundColor: '#dc3545',
                      zIndex: 1
                    }}></div>
                  )}
                </span>
              </div>
                {isHandRaised && (
                <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (role === 'HOST') {
                        handleHostLowerHand(participant._id);
                      }
                  }}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#ffc107',
                    color: '#212529',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                    title={role === 'HOST' ? 'Lower Hand' : 'Hand Raised'}
                >
                  ✋
                </button>
              )}
            </div>
            );
          })}
        </div>

        {/* Main Teaching Area */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          margin: '0 12px 12px 12px',
          marginRight: (activeTab && activeTab !== 'chat' && !selectedParticipant) || selectedParticipant ? '12px' : '12px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #e2e8f0',
          transition: 'margin-right 0.3s ease',
          minHeight: 0,
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          {/* Screen Share/Teaching Content */}
          <div style={{
            flex: 1,
            backgroundColor: '#1a1a1a',
            margin: '15px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: '400px',
            overflow: 'hidden'
          }}>
            {isScreenSharing ? (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                📺 Screen Sharing Content
              </div>
            ) : mainVideoParticipant ? (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative'
              }}>
                <div style={{
                  width: '200px',
                  height: '200px',
                  backgroundColor: '#495057',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  👤
                </div>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'white' }}>
                  {participants.find(p => p._id === mainVideoParticipant)?.displayName || 'Participant'}
                </h3>
                <p style={{ margin: '10px 0 0 0', fontSize: '16px', color: '#adb5bd' }}>
                  {participants.find(p => p._id === mainVideoParticipant)?.email || 'participant@demo.com'}
                </p>
                
                {/* Video Controls Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ 
                      color: participants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED' || participants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED_BY_HOST' ? '#dc3545' : '#28a745',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                      </svg>
                      {(participants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED' || participants.find(p => p._id === mainVideoParticipant)?.micState === 'MUTED_BY_HOST') && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: '14px',
                          height: '1.5px',
                          backgroundColor: '#dc3545',
                          zIndex: 1
                        }}></div>
                      )}
                    </span>
                    <span style={{ 
                      color: participants.find(p => p._id === mainVideoParticipant)?.cameraState === 'ON' ? '#007bff' : '#dc3545',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                      {participants.find(p => p._id === mainVideoParticipant)?.cameraState !== 'ON' && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: '14px',
                          height: '1.5px',
                          backgroundColor: '#dc3545',
                          zIndex: 1
                        }}></div>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2c2c2c',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative'
              }}>
                <div style={{
                  width: '200px',
                  height: '200px',
                  backgroundColor: '#495057',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  👨‍🏫
                </div>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'white' }}>Host</h3>
                <p style={{ margin: '10px 0 0 0', fontSize: '16px', color: '#adb5bd' }}>host@demo.com</p>
                
                {/* Host Controls Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ 
                      color: isMicOn ? '#28a745' : '#dc3545',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                      </svg>
                      {!isMicOn && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: '14px',
                          height: '1.5px',
                          backgroundColor: '#dc3545',
                          zIndex: 1
                        }}></div>
                      )}
                    </span>
                    <span style={{ 
                      color: isVideoOn ? '#007bff' : '#dc3545',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                      {!isVideoOn && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: '14px',
                          height: '1.5px',
                          backgroundColor: '#dc3545',
                          zIndex: 1
                        }}></div>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Status Indicator */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{ 
                position: 'relative', 
                width: '8px', 
                height: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {/* Inner dot */}
                <div style={{
                  width: '4px',
                  height: '4px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  zIndex: 3,
                  position: 'relative'
                }}></div>
                {/* Pulsing rings */}
                <div style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  width: '12px',
                  height: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite 0.5s',
                  zIndex: 0
                }}></div>
              </div>
              {isScreenSharing ? 'Screen Sharing' : (mainVideoParticipant ? 'Participant Video' : 'Host Video')}
            </div>

            {/* Raised Hands Indicator */}
            {raisedHands.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: '#ffc107',
                color: '#212529',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                ✋ {raisedHands.length} hand{raisedHands.length > 1 ? 's' : ''} raised
              </div>
            )}
          </div>

        </div>

        {/* Control Panel */}
        <div
          style={{
            height: '70px',
            backgroundColor: '#ffffff',
            margin: '0 12px 12px 12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '0 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            flexShrink: 0
          }}
        >
          {role === 'HOST' ? (
            <>
              {/* Host sees all controls */}
            {/* Participant Count */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              minWidth: '60px',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }}></div>
              <span style={{ 
                fontSize: '14px', 
                color: '#059669',
                fontWeight: '500'
              }}>
                {participantStats?.totalParticipants || participants.length + waitingParticipants.length}
              </span>
            </div>
            {/* Microphone Button */}
            <button 
              onClick={handleMicToggle}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: isMicOn ? '#f8fafc' : '#fef2f2',
                color: isMicOn ? '#64748b' : '#ef4444',
                border: isMicOn ? '1px solid #e2e8f0' : '1px solid #fecaca',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                  {/* Red cross line */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: '20px',
                    height: '2px',
                    backgroundColor: '#ef4444',
                    zIndex: 1
                  }}></div>
                </>
              )}
            </button>
            
            {/* Video Camera Button */}
            <button 
              onClick={handleVideoToggle}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: isVideoOn ? '#f8fafc' : '#fef2f2',
                color: isVideoOn ? '#64748b' : '#ef4444',
                border: isVideoOn ? '1px solid #e2e8f0' : '1px solid #fecaca',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoOn ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                  {/* Red cross line */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: '20px',
                    height: '2px',
                    backgroundColor: '#ef4444',
                    zIndex: 1
                  }}></div>
                </>
              )}
            </button>
            <button 
              onClick={handleScreenShareToggle}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: isScreenSharing ? '#ef4444' : '#f8fafc',
                color: isScreenSharing ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              🖥️
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: activeTab === 'chat' ? '#3b82f6' : '#f8fafc',
                color: activeTab === 'chat' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              💬
            </button>
            {/* Participants Panel Button */}
            <button
              onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: activeTab === 'participants' ? '#10b981' : '#f8fafc',
                color: activeTab === 'participants' ? 'white' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              👥
            </button>

            {/* End Call */}
            <button style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}>
              📞
            </button>
            </>
          ) : (
            <>
              {/* Participant only sees raise hand + mic + video */}
              <button 
                onClick={handleMicToggle}
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: isMicOn ? '#f8fafc' : '#fef2f2',
                  color: isMicOn ? '#64748b' : '#ef4444',
                  border: isMicOn ? '1px solid #e2e8f0' : '1px solid #fecaca',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isMicOn ? '🎤' : '🔇'}
              </button>
              <button 
                onClick={handleVideoToggle}
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: isVideoOn ? '#f8fafc' : '#fef2f2',
                  color: isVideoOn ? '#64748b' : '#ef4444',
                  border: isVideoOn ? '1px solid #e2e8f0' : '1px solid #fecaca',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isVideoOn ? '📹' : '🚫'}
              </button>
              <button
                onClick={handleToggleHandRaise}
                style={{
                  backgroundColor: isHandRaised ? '#f59e0b' : '#f8fafc',
                  color: isHandRaised ? 'white' : '#333',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                ✋ {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
              </button>
              <button 
                onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: activeTab === 'chat' ? '#dbeafe' : '#f8fafc',
                  color: activeTab === 'chat' ? '#2563eb' : '#64748b',
                  border: activeTab === 'chat' ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                💬
              </button>
              <button 
                style={{ 
                  backgroundColor: '#ef4444', 
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  border: '1px solid #dc2626',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
              >
                📞
              </button>
            </>
          )}
        </div>


        {/* Private Chat Panel */}
        {selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: 'white',
            borderLeft: '1px solid #e9ecef',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px'
          }}>
            {/* Private Chat Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#007bff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: 'white'
                }}>
                  👤
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#333', fontSize: '14px' }}>
                    {participants.find(p => p._id === selectedParticipant)?.displayName}
                  </h3>
                  <p style={{ margin: 0, color: '#6c757d', fontSize: '12px' }}>Private Chat</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Private Chat Messages */}
            <div style={{
              flex: 1,
              padding: '15px',
              overflowY: 'auto',
              backgroundColor: 'white'
            }}>
              {((selectedParticipant && participantChat[selectedParticipant]) || []).map((message: {_id: string; text: string; displayName: string; createdAt: string}) => (
                <div key={message._id} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#007bff' }}>
                      {message.displayName}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6c757d' }}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    lineHeight: '1.4', 
                    color: '#333',
                    backgroundColor: message.displayName === 'Host' ? '#e3f2fd' : '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                    alignSelf: message.displayName === 'Host' ? 'flex-end' : 'flex-start'
                  }}>
                    {message.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Private Chat Input */}
            <div style={{
              padding: '15px',
              borderTop: '1px solid #e9ecef',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type a private message..."
                  value={privateMessage}
                  onChange={(e) => setPrivateMessage(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    backgroundColor: 'white',
                    color: '#333',
                    fontSize: '13px'
                  }}
                />
                <button 
                  onClick={() => {
                    // TODO: Implement private message sending
                    console.log('Send private message:', privateMessage);
                    setPrivateMessage('');
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {activeTab === 'chat' && !selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
            maxWidth: '90vw'
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>💬 Chat</h3>
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Chat Content */}
            <div style={{ flex: 1, padding: '15px', overflow: 'auto', backgroundColor: 'white' }}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Chat Messages */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: '15px',
                  padding: '10px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  {chatMessages.map((message, index) => {
                    const isOwnMessage = message.userId === userId;
                    return (
                      <div key={message._id} style={{
                        display: 'flex',
                        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          maxWidth: '70%',
                          backgroundColor: isOwnMessage ? '#007bff' : '#e9ecef',
                          color: isOwnMessage ? 'white' : '#333',
                          padding: '8px 12px',
                          borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '14px',
                          position: 'relative',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {!isOwnMessage && (
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                              {message.displayName}
                            </div>
                          )}
                          <div>{message.text}</div>
                          <div style={{ fontSize: '10px', color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#999', marginTop: '2px' }}>
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </div>
                          {isOwnMessage && (
                            <button
                              onClick={() => handleDeleteMessage(message._id)}
                              style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                width: '16px',
                                height: '16px',
                                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#dc3545',
                                color: isOwnMessage ? '#dc3545' : 'white',
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Chat Input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '20px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button 
                    onClick={() => {
                      // TODO: Implement message sending
                      console.log('Send message:', newMessage);
                      setNewMessage('');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Side Panel for Participants/Waiting/Analytics */}
        {activeTab && activeTab !== 'chat' && !selectedParticipant && (
          <div style={{
            position: 'fixed',
            right: '0',
            top: '0',
            width: '320px',
            height: '100vh',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
            maxWidth: '90vw'
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>
                {activeTab === 'participants' && '👥 Participants & Waiting Room'}
                {activeTab === 'analytics' && '📊 Analytics'}
              </h3>
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs for Chat and Active Students */}
            {activeTab === 'participants' && (
              <div style={{
                display: 'flex',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => setRightPanelTab('students')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'students' ? 'white' : 'transparent',
                    color: rightPanelTab === 'students' ? '#007bff' : '#6c757d',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderBottom: rightPanelTab === 'students' ? '2px solid #007bff' : '2px solid transparent'
                  }}
                >
                  👥 Active Students ({mockParticipants.length})
                </button>
                <button
                  onClick={() => setRightPanelTab('chat')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'chat' ? 'white' : 'transparent',
                    color: rightPanelTab === 'chat' ? '#007bff' : '#6c757d',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderBottom: rightPanelTab === 'chat' ? '2px solid #007bff' : '2px solid transparent'
                  }}
                >
                  💬 Chat ({chatMessages.length})
                </button>
              </div>
            )}

            {/* Panel Content */}
            <div style={{ flex: 1, padding: '15px', overflow: 'auto', backgroundColor: 'white' }}>
              {activeTab === 'participants' && rightPanelTab === 'students' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Top Half - Active Participants */}
                  <div style={{ flex: 1, marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px', fontWeight: 'bold' }}>
                      👥 Active Participants ({participants.length})
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {participants.map((participant) => {
                        const isHandRaised = raisedHands.some(hand => hand.participantId === participant._id);
                        return (
                          <div key={participant._id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '8px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              backgroundColor: '#e9ecef',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '8px',
                              fontSize: '12px',
                              color: '#6c757d'
                            }}>
                              👤
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: '0 0 2px 0', fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                                {participant.displayName.split(' ')[1] || participant.displayName}
                              </p>
                              <p style={{ margin: 0, fontSize: '10px', color: '#6c757d' }}>
                                {participant.email || 'No email'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {/* Mic Control */}
                              <button 
                                onClick={() => handleForceMute(participant._id)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST' ? '#fef2f2' : '#f0fdf4',
                                  color: participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST' ? '#ef4444' : '#10b981',
                                  border: participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s ease'
                                }}
                                title={participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST' ? 'Unmute' : 'Force Mute'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                                </svg>
                                {(participant.micState === 'MUTED' || participant.micState === 'MUTED_BY_HOST') && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(45deg)',
                                    width: '16px',
                                    height: '2px',
                                    backgroundColor: '#dc3545',
                                    zIndex: 1
                                  }}></div>
                                )}
                              </button>
                              
                              {/* Camera Control */}
                              <button 
                                onClick={() => handleForceCameraOff(participant._id)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: participant.cameraState === 'ON' ? '#eff6ff' : '#fef2f2',
                                  color: participant.cameraState === 'ON' ? '#3b82f6' : '#ef4444',
                                  border: participant.cameraState === 'ON' ? '1px solid #bfdbfe' : '1px solid #fecaca',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s ease'
                                }}
                                title={participant.cameraState === 'ON' ? 'Camera Off' : 'Camera On'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                </svg>
                                {participant.cameraState !== 'ON' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(45deg)',
                                    width: '16px',
                                    height: '2px',
                                    backgroundColor: '#dc3545',
                                    zIndex: 1
                                  }}></div>
                                )}
                              </button>
                              
                              {/* Remove Button */}
                              <button 
                                onClick={() => handleRemoveParticipant(participant._id)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: '#fef2f2',
                                  color: '#ef4444',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Remove Participant"
                              >
                                🗑️
                              </button>
                              
                              {/* Hand Control - Only show when raised */}
                              {isHandRaised && (
                                <button 
                                  onClick={() => handleHostLowerHand(participant._id)}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    backgroundColor: '#fef3c7',
                                    color: '#d97706',
                                    border: '1px solid #fde68a',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title="Lower Hand"
                                >
                                  ✋
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enhanced Divider Line */}
                  <div style={{
                    height: '2px',
                    backgroundColor: '#e2e8f0',
                    margin: '20px 0',
                    width: '100%',
                    borderRadius: '1px',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#ffffff',
                      padding: '0 10px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      • • •
                    </div>
                  </div>

                  {/* Bottom Half - Waiting Room */}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px', fontWeight: 'bold' }}>
                      ⏳ Waiting Room ({waitingParticipants.length})
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {waitingParticipants.map((participant) => (
                        <div key={participant._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          backgroundColor: '#fff3cd',
                          borderRadius: '4px',
                          border: '1px solid #ffeaa7'
                        }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#ffc107',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '8px',
                            fontSize: '12px',
                            color: '#212529'
                          }}>
                            ⏳
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                              {participant.displayName.split(' ')[1] || participant.displayName}
                            </p>
                            <p style={{ margin: 0, fontSize: '10px', color: '#6c757d' }}>
                              {participant.email || 'No email'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              onClick={() => handleApproveParticipant(participant._id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '9px'
                              }}
                            >
                              ✅ Approve
                            </button>
                            <button 
                              onClick={() => handleRejectParticipant(participant._id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '9px'
                              }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'participants' && rightPanelTab === 'chat' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Chat Messages */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '15px',
                    padding: '10px'
                  }}>
                    {chatMessages.map((message, index) => {
                      const isOwnMessage = message.userId === userId; // Check if message is from current user
                      return (
                        <div key={message._id} style={{ 
                          marginBottom: '12px',
                          display: 'flex',
                          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
                        }}>
                          <div style={{
                            maxWidth: '70%',
                            backgroundColor: isOwnMessage ? '#007bff' : '#e9ecef',
                            color: isOwnMessage ? 'white' : '#333',
                            padding: '8px 12px',
                            borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            position: 'relative',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            {!isOwnMessage && (
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#007bff',
                                marginBottom: '4px'
                              }}>
                                {message.displayName}
                              </div>
                            )}
                            <div style={{
                              fontSize: '14px',
                              lineHeight: '1.4',
                              wordWrap: 'break-word'
                            }}>
                              {message.text}
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '4px',
                              fontSize: '10px',
                              opacity: 0.7
                            }}>
                              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                              {isOwnMessage && (
                                <button 
                                  onClick={() => handleDeleteMessage(message._id)}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    backgroundColor: 'transparent',
                                    color: 'rgba(255,255,255,0.7)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    marginLeft: '8px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                                    e.currentTarget.style.color = 'white';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                  }}
                                  title="Delete Message"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chat Input */}
                  <div style={{
                    borderTop: '1px solid #e9ecef',
                    paddingTop: '15px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #dee2e6',
                          backgroundColor: 'white',
                          color: '#333',
                          fontSize: '14px'
                        }}
                      />
                      <button 
                        onClick={() => {
                          // TODO: Implement message sending
                          console.log('Send message:', newMessage);
                          setNewMessage('');
                        }}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#007bff', fontSize: '14px' }}>Total Participants</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {participantStats?.totalParticipants || participants.length + waitingParticipants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#28a745', fontSize: '14px' }}>Active Users</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {participantStats?.activeParticipants || participants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#ffc107', fontSize: '14px' }}>Waiting</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {participantStats?.waitingParticipants || waitingParticipants.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#6f42c1', fontSize: '14px' }}>Messages</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {chatStats?.totalMessages || chatMessages.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b', fontSize: '14px' }}>Raised Hands</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {participantStats?.raisedHandsCount || raisedHands.length}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '15px',
                      textAlign: 'center',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#8b5cf6', fontSize: '14px' }}>Screen Sharing</h4>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                        {participantStats?.screenSharingCount || screenShareStatus?.currentlySharingCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.3;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfessionalLiveStreamRoom;
