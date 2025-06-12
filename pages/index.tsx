import React, { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Avatar from '@/components/Avatar';
import VoiceStreamer from '@/components/VoiceStreamer';
import { AvatarData } from '@/lib/readyplayerme';
import { ChatMessage } from '@/lib/openai';
import * as THREE from 'three';

interface ConversationState {
  messages: ChatMessage[];
  isLoading: boolean;
  isPlaying: boolean;
}

export default function Home() {
  const [conversationState, setConversationState] = useState<ConversationState>({
    messages: [],
    isLoading: false,
    isPlaying: false
  });

  const [inputText, setInputText] = useState('');
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
  const [status, setStatus] = useState('Loading avatar...');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [countdownFinished, setCountdownFinished] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  
  // Voice streaming states
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Ready');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAvatarLoaded = useCallback((data: AvatarData) => {
    setAvatarData(data);
    setAvatarLoaded(true);
    setStatus('Avatar loaded');
  }, []);

  // Start countdown immediately when component mounts
  useEffect(() => {
    let currentCount = 4;
    setCountdown(currentCount);
    
    const countdownInterval = setInterval(() => {
      currentCount -= 1;
      setCountdown(currentCount);
      
      if (currentCount <= 0) {
        clearInterval(countdownInterval);
        setCountdownFinished(true);
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  // Check if both avatar and countdown are ready
  useEffect(() => {
    if (avatarLoaded && countdownFinished) {
      setIsAvatarReady(true);
      setStatus('Ready');
    }
  }, [avatarLoaded, countdownFinished]);

  // Initialize audio context on first user interaction
  const initializeAudio = useCallback(async () => {
    if (audioEnabled || !audioRef.current) return;
    
    try {
      // Create a silent audio to test permissions
      audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmHgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioEnabled(true);
      console.log('Audio initialized successfully');
    } catch (error) {
      console.log('Audio initialization failed:', error);
    }
  }, [audioEnabled]);

  // Process message (shared between text and voice input)
  const processMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || conversationState.isLoading || !isAvatarReady) return;

    // Initialize audio on first interaction
    await initializeAudio();

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText.trim()
    };

    const newMessages = [...conversationState.messages, userMessage];

    setConversationState(prev => ({
      ...prev,
      messages: newMessages,
      isLoading: true
    }));

    setStatus('Thinking...');

    try {
      // Get AI response
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to get chat response');
      }

      const { text } = await chatResponse.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: text
      };

      setConversationState(prev => ({
        ...prev,
        messages: [...newMessages, assistantMessage],
        isLoading: false
      }));

      setStatus('Generating speech...');

      // Generate speech
      const speechResponse = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text
        }),
      });

      if (!speechResponse.ok) {
        throw new Error('Failed to generate speech');
      }

      const { audioData, mimeType } = await speechResponse.json();

      // Play audio
      if (audioRef.current) {
        const audioBlob = new Blob([
          Uint8Array.from(atob(audioData), c => c.charCodeAt(0))
        ], { type: mimeType });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current.src = audioUrl;
        
        setConversationState(prev => ({
          ...prev,
          isPlaying: true
        }));
        
        setStatus('Speaking...');
        
        try {
          await audioRef.current.play();
        } catch (error: any) {
          console.error('Audio play error:', error);
          if (error.name === 'NotAllowedError') {
            setStatus('Click anywhere to enable audio');
            setConversationState(prev => ({
              ...prev,
              isPlaying: false
            }));
          } else {
            setStatus('Audio error');
            setConversationState(prev => ({
              ...prev,
              isPlaying: false
            }));
          }
        }
      }

    } catch (error) {
      console.error('Error in conversation:', error);
      setStatus('Error occurred');
      setConversationState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  }, [conversationState, initializeAudio, isAvatarReady]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim()) return;
    await processMessage(inputText);
    setInputText('');
  }, [inputText, processMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle voice transcript
  const handleTranscriptReceived = useCallback((transcript: string, isFinal: boolean) => {
    setCurrentTranscript(transcript);
    
    if (isFinal && transcript.trim()) {
      // Process the final transcript as a message
      processMessage(transcript);
      // Clear the transcript display after a delay
      setTimeout(() => setCurrentTranscript(''), 2000);
    }
  }, [processMessage]);

  // Handle voice streamer status
  const handleVoiceStatusChange = useCallback((status: string) => {
    setVoiceStatus(status);
    setIsListening(status === 'Listening...');
  }, []);

  // Handle voice errors
  const handleVoiceError = useCallback((error: string) => {
    console.error('Voice error:', error);
    setVoiceStatus(`Error: ${error}`);
  }, []);

  // Toggle voice input
  const toggleVoice = useCallback(async () => {
    if (!voiceEnabled) {
      // Initialize audio first
      await initializeAudio();
    }
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled, initializeAudio]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      setConversationState(prev => ({
        ...prev,
        isPlaying: false
      }));
      setStatus('Ready');
    };

    const handleAudioError = () => {
      setConversationState(prev => ({
        ...prev,
        isPlaying: false
      }));
      setStatus('Audio error');
    };

    audio.addEventListener('ended', handleAudioEnd);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('ended', handleAudioEnd);
      audio.removeEventListener('error', handleAudioError);
    };
  }, []);

  return (
    <>
      <Head>
        <title>NLB Talking Avatar</title>
        <meta name="description" content="AI-powered talking avatar with ReadyPlayerMe, ElevenLabs, and OpenAI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="avatar-container" onClick={initializeAudio}>
        {/* Avatar */}
        <Avatar
          avatarId={process.env.NEXT_PUBLIC_READYPLAYERME_AVATAR_URL || "https://models.readyplayer.me/684ad1642c774db868c4d89e.glb"}
          isPlaying={conversationState.isPlaying}
          audioElement={audioRef.current}
          onAvatarLoaded={handleAvatarLoaded}
        />

        {/* Voice Streamer */}
        {isAvatarReady && (
          <VoiceStreamer
            isEnabled={voiceEnabled && !conversationState.isPlaying} // Don't listen while speaking
            apiKey={process.env.NEXT_PUBLIC_GLADIA_API_KEY || '42f4192e-55d4-4a27-830a-d62c2cb32c03'}
            onTranscriptReceived={handleTranscriptReceived}
            onStatusChange={handleVoiceStatusChange}
            onError={handleVoiceError}
          />
        )}

        {/* Hidden audio element */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        {/* Status Indicator */}
        <div className={`status-indicator ${conversationState.isPlaying ? 'speaking' : conversationState.isLoading ? 'listening' : ''}`}>
          {conversationState.isLoading && <div className="loading-spinner" />}
          {!audioEnabled && status.includes('Click') && (
            <div style={{ color: '#ff6b6b', fontWeight: 'bold' }}>🔊 </div>
          )}
          {status}
        </div>

        {/* Voice Transcript Display */}
        {currentTranscript && (
          <div style={{
            position: 'absolute',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '15px',
            fontSize: '16px',
            maxWidth: '600px',
            textAlign: 'center',
            zIndex: 1000,
            border: '1px solid rgba(239, 68, 68, 0.5)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.7, 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
              Listening...
            </div>
            <div style={{ fontWeight: '500' }}>
              "{currentTranscript}"
            </div>
          </div>
        )}



        {/* Countdown Overlay */}
        {!isAvatarReady && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            color: 'white'
          }}>
            {countdown > 0 ? (
              // Countdown state
              <>
                <div style={{
                  fontSize: '120px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 30px rgba(102, 126, 234, 0.5)',
                  animation: 'pulse 1s ease-in-out'
                }}>
                  {countdown}
                </div>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', textAlign: 'center' }}>
                  Getting Kora ready...
                </h2>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '14px', opacity: 0.8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: countdownFinished ? '#4ade80' : '#667eea' 
                    }} />
                    {countdownFinished ? 'Done' : `${countdown}s`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: avatarLoaded ? '#4ade80' : '#fbbf24' 
                    }} />
                    Avatar: {avatarLoaded ? 'Loaded' : 'Loading...'}
                  </div>
                </div>
              </>
            ) : countdownFinished && !avatarLoaded ? (
              // Waiting for avatar
              <>
                <div className="loading-spinner" style={{ 
                  width: '60px', 
                  height: '60px', 
                  marginBottom: '20px',
                  border: '4px solid rgba(255,255,255,0.3)',
                  borderTop: '4px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', textAlign: 'center' }}>
                  Waiting for Kora...
                </h2>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '16px' }}>
                  Avatar is still loading
                </p>
              </>
            ) : (
              // Ready state
              <>
                <div style={{
                  fontSize: '120px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                  color: '#4ade80',
                  textShadow: '0 0 30px rgba(74, 222, 128, 0.5)',
                  animation: 'pulse 0.5s ease-in-out'
                }}>
                  ✓
                </div>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#4ade80' }}>
                  Ready to chat!
                </h2>
                <p style={{ margin: '10px 0 0 0', opacity: 0.8, fontSize: '16px' }}>
                  Click the microphone button to start voice chat
                </p>
              </>
            )}
          </div>
        )}

        {/* Chat Input */}
        <div className="chat-input">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={!isAvatarReady ? "Loading avatar..." : voiceEnabled ? "Voice input active - or type here..." : "Type your message here..."}
              disabled={conversationState.isLoading || !isAvatarReady}
              style={{ flex: 1, margin: 0 }}
            />
            
            {/* Voice Toggle Button */}
            {isAvatarReady && (
              <button
                onClick={toggleVoice}
                disabled={conversationState.isPlaying}
                className="voice-button"
                title={voiceEnabled ? 'Stop voice input' : 'Start voice input'}
              >
                {voiceEnabled ? '🔴' : '🎤'}
              </button>
            )}
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={conversationState.isLoading || !inputText.trim() || !isAvatarReady}
          >
            {!isAvatarReady ? 'Loading...' : conversationState.isLoading ? 'Processing...' : 'Send'}
          </button>
        </div>

        {/* Avatar Info */}
        <div className="avatar-info">
          <div><strong>Status:</strong> {status}</div>
          {voiceEnabled && <div><strong>Voice:</strong> {voiceStatus}</div>}
          <div><strong>Messages:</strong> {conversationState.messages.length}</div>
          {avatarData && (
            <div><strong>Avatar:</strong> Loaded</div>
          )}
        </div>

        {/* Conversation History (Optional) */}
        {conversationState.messages.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            maxWidth: '300px',
            maxHeight: '400px',
            overflow: 'auto',
            background: 'rgba(0,0,0,0.7)',
            padding: '15px',
            borderRadius: '10px',
            fontSize: '12px',
            zIndex: 100
          }}>
            <h4>Conversation</h4>
            {conversationState.messages.slice(-6).map((msg, idx) => (
              <div key={idx} style={{ 
                margin: '8px 0', 
                padding: '5px',
                background: msg.role === 'user' ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)',
                borderRadius: '5px'
              }}>
                <strong>{msg.role === 'user' ? 'You' : 'Avatar'}:</strong> {msg.content}
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}