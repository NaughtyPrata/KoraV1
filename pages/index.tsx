import React, { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Avatar from '@/components/Avatar';
import VoiceStreamer from '@/components/VoiceStreamer';
import { AvatarData } from '@/lib/readyplayerme';
import { ChatMessage } from '@/lib/openai';
import { LipSyncController } from '@/utils/lipSync';
import { ChunkedAudioPlayer, createChunkedAudioPlayer, AudioChunkData } from '@/utils/chunkedAudioPlayer';

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
  
  // Voice states
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [gladiaStatus, setGladiaStatus] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lipSyncRef = useRef<LipSyncController | null>(null);
  const chunkedPlayerRef = useRef<ChunkedAudioPlayer | null>(null);
  const [currentChunkText, setCurrentChunkText] = useState<string>('');

  const handleAvatarLoaded = useCallback(async (data: AvatarData) => {
    setAvatarData(data);
    setAvatarLoaded(true);
    setStatus('Avatar loaded');
    
    // Initialize lip sync controller
    if (!lipSyncRef.current) {
      lipSyncRef.current = new LipSyncController(data);
      await lipSyncRef.current.initialize();
      console.log('LipSyncController initialized');
    }

    // Initialize chunked audio player
    if (!chunkedPlayerRef.current) {
      chunkedPlayerRef.current = createChunkedAudioPlayer({
        onChunkStart: (chunk: AudioChunkData) => {
          console.log(`Starting chunk ${chunk.index + 1}: "${chunk.text}"`);
          setCurrentChunkText(chunk.text);
          
          // Start lip sync for this chunk
          if (lipSyncRef.current) {
            // We'll need to get the current audio element from the player
            const analyser = chunkedPlayerRef.current?.getAnalyser();
            if (analyser) {
              lipSyncRef.current.startLipSyncWithAnalyser(analyser);
            }
          }
        },
        onChunkEnd: (chunk: AudioChunkData) => {
          console.log(`Finished chunk ${chunk.index + 1}`);
          setCurrentChunkText('');
        },
        onComplete: () => {
          console.log('All chunks completed');
          setConversationState(prev => ({
            ...prev,
            isPlaying: false
          }));
          setStatus('Ready');
          setCurrentChunkText('');
          
          // Stop lip sync
          if (lipSyncRef.current) {
            lipSyncRef.current.stopLipSync();
          }
        },
        onError: (error: Error) => {
          console.error('Chunked playback error:', error);
          setStatus(`Audio error: ${error.message}`);
          setConversationState(prev => ({
            ...prev,
            isPlaying: false
          }));
          setCurrentChunkText('');
        },
        preloadNext: true
      });
      console.log('ChunkedAudioPlayer initialized');
    }
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
      // Chrome-specific: Initialize AudioContext if needed
      if (typeof window !== 'undefined' && window.AudioContext) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('AudioContext resumed for Chrome');
        }
      }
      
      // Create a silent audio to test permissions
      audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmHgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
      
      // Chrome-specific: Set audio element properties
      audioRef.current.preload = 'auto';
      audioRef.current.muted = false;
      
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioEnabled(true);
      console.log('Audio initialized successfully');
    } catch (error) {
      console.log('Audio initialization failed:', error);
    }
  }, [audioEnabled]);

  // Process message
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

      setStatus('Generating chunked speech...');

      // Generate chunked speech
      const speechResponse = await fetch('/api/speech-chunked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          maxSentencesPerChunk: 2,
          streaming: false // Use batch mode for now
        }),
      });

      if (!speechResponse.ok) {
        throw new Error('Failed to generate chunked speech');
      }

      const { chunks, totalChunks } = await speechResponse.json();
      console.log(`Received ${totalChunks} speech chunks`);

      // Load chunks into the chunked player
      if (chunkedPlayerRef.current) {
        setConversationState(prev => ({
          ...prev,
          isPlaying: true
        }));
        
        setStatus('Speaking...');
        
        // Convert the chunks to the format expected by ChunkedAudioPlayer
        const audioChunks: AudioChunkData[] = chunks.map((chunk: any) => ({
          index: chunk.index,
          text: chunk.text,
          audioData: chunk.audioData,
          mimeType: chunk.mimeType
        }));

        chunkedPlayerRef.current.loadChunks(audioChunks);
        await chunkedPlayerRef.current.play();
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

  // Voice handlers
  const handleTranscriptReceived = useCallback((transcript: string, isFinal: boolean) => {
    setCurrentTranscript(transcript);
    
    if (isFinal && transcript.trim()) {
      // Process the final transcript as a message
      processMessage(transcript);
      // Clear the transcript display after a delay
      setTimeout(() => setCurrentTranscript(''), 2000);
    }
  }, [processMessage]);

  const handleVoiceError = useCallback((error: string) => {
    console.error('Voice error:', error);
  }, []);

  // Toggle voice input
  const toggleVoice = useCallback(async () => {
    if (!voiceEnabled) {
      // Initialize audio first
      await initializeAudio();
    }
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled, initializeAudio]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup chunked audio player
      if (chunkedPlayerRef.current) {
        chunkedPlayerRef.current.dispose();
        chunkedPlayerRef.current = null;
      }
      
      // Cleanup lip sync controller
      if (lipSyncRef.current) {
        lipSyncRef.current.dispose();
        lipSyncRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <Head>
        <title>NLB Talking Avatar</title>
        <meta name="description" content="AI-powered talking avatar with ReadyPlayerMe, ElevenLabs, and OpenAI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* Lucide Icons CDN */}
        <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
      </Head>

      <main className="avatar-container" onClick={initializeAudio}>
        {/* Avatar */}
        <Avatar
          avatarId={process.env.READYPLAYERME_AVATAR_URL}
          isPlaying={conversationState.isPlaying}
          audioElement={audioRef.current}
          onAvatarLoaded={handleAvatarLoaded}
        />

        {/* Voice Streamer */}
        {isAvatarReady && (
          <VoiceStreamer
            isEnabled={voiceEnabled && !conversationState.isPlaying}
            apiKey={process.env.GLADIA_API_KEY || '42f4192e-55d4-4a27-830a-d62c2cb32c03'}
            onTranscriptReceived={handleTranscriptReceived}
            onError={handleVoiceError}
            onStatusChange={setGladiaStatus}
          />
        )}

        {/* Hidden audio element */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        {/* Voice Transcript Display */}
        {currentTranscript && (
          <div style={{
            position: 'absolute',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '15px',
            fontSize: '16px',
            maxWidth: '600px',
            textAlign: 'center',
            zIndex: 200,
            border: '1px solid rgba(59, 130, 246, 0.5)',
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
                background: '#3b82f6',
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

        {/* Chat Input - New Horizontal Layout */}
        <div className="chat-input-container">
          {/* Status Indicator integrated into input area */}
          {isAvatarReady && voiceEnabled && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              background: gladiaStatus === 'Continuous Listening...' ? 'rgba(59, 130, 246, 0.9)' : conversationState.isPlaying ? 'rgba(34, 197, 94, 0.9)' : 'rgba(251, 191, 36, 0.9)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              whiteSpace: 'nowrap',
              zIndex: 200
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#ffffff',
                borderRadius: '50%',
                animation: (gladiaStatus === 'Continuous Listening...' || conversationState.isPlaying) ? 'pulse 1.5s infinite' : 'none'
              }} />
              {conversationState.isPlaying ? (
                '🗣️ Kora is speaking...'
              ) : gladiaStatus === 'Continuous Listening...' ? (
                '🎤 Listening - speak now'
              ) : gladiaStatus === 'Starting...' ? (
                '⏳ Getting ready...'
              ) : gladiaStatus === 'Creating session...' ? (
                '🔄 Connecting...'
              ) : gladiaStatus === 'Connecting...' ? (
                '🔌 Establishing...'
              ) : gladiaStatus === 'Getting microphone...' ? (
                '🎤 Accessing mic...'
              ) : gladiaStatus === 'Setting up audio...' ? (
                '🔧 Setting up...'
              ) : (
                `⚠️ ${gladiaStatus || 'Preparing...'}`
              )}
            </div>
          )}
          
          <div className="chat-input-form">
            {/* Mic Button */}
            {isAvatarReady && (
              <button
                onClick={toggleVoice}
                disabled={conversationState.isPlaying}
                className={`input-icon-button mic-button ${voiceEnabled ? 'recording' : ''}`}
                title={voiceEnabled ? 'Stop voice input' : 'Start voice input'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {voiceEnabled ? (
                    // Stop/Recording icon
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  ) : (
                    // Microphone icon
                    <>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </>
                  )}
                </svg>
              </button>
            )}
            
            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !isAvatarReady ? "Loading avatar..." : 
                conversationState.isPlaying ? "Kora is speaking..." :
                voiceEnabled ? (
                  gladiaStatus === 'Continuous Listening...' ? "🎤 Listening... or type here" :
                  gladiaStatus ? `${gladiaStatus}...` : "Getting ready..."
                ) : "Type your message here..."
              }
              disabled={conversationState.isLoading || !isAvatarReady}
              className="main-text-input"
            />
            
            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={conversationState.isLoading || !inputText.trim() || !isAvatarReady}
              className="input-icon-button send-button"
              title="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22,2 15,22 11,13 2,9"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Current Chunk Display */}
        {currentChunkText && (
          <div style={{
            position: 'absolute',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(34, 197, 94, 0.9)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '15px',
            fontSize: '16px',
            maxWidth: '600px',
            textAlign: 'center',
            zIndex: 1000,
            border: '1px solid rgba(34, 197, 94, 0.5)',
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
                background: '#ffffff',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }} />
              Speaking...
            </div>
            <div style={{ fontWeight: '500' }}>
              "{currentChunkText}"
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
