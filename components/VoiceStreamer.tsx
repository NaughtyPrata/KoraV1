import React, { useRef, useCallback, useEffect, useState } from 'react';

export interface VoiceStreamerProps {
  onTranscriptReceived: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
  isEnabled: boolean;
  apiKey: string;
}

export default function VoiceStreamer({ 
  onTranscriptReceived, 
  onError, 
  onStatusChange,
  isEnabled,
  apiKey 
}: VoiceStreamerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [micLevel, setMicLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Refs for audio processing
  const websocketRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Speech detection and buffering
  const lastSpeechTimeRef = useRef<number>(0);
  const speechLevelBufferRef = useRef<number[]>([]);
  const transcriptBufferRef = useRef<string>('');
  const lastTranscriptTimeRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const speechThreshold = 0.008; // Lower threshold for better detection
  const silenceRequiredMs = 2500; // 2.5 seconds of silence before sending final
  const maxTranscriptAge = 1000; // Reset buffer if no transcript for 1 second

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const logError = useCallback((error: string) => {
    console.error('VoiceStreamer:', error);
    onError?.(error);
  }, [onError]);

  // Send accumulated transcript when user stops speaking
  const sendAccumulatedTranscript = useCallback(() => {
    if (transcriptBufferRef.current.trim()) {
      console.log('🟢 Sending accumulated transcript:', transcriptBufferRef.current);
      onTranscriptReceived(transcriptBufferRef.current.trim(), true);
      transcriptBufferRef.current = '';
    }
  }, [onTranscriptReceived]);

  // Detect if user is currently speaking
  const detectSpeech = useCallback((audioLevel: number) => {
    const now = Date.now();
    
    // Add to rolling buffer (keep last 20 samples for smoother detection)
    speechLevelBufferRef.current.push(audioLevel);
    if (speechLevelBufferRef.current.length > 20) {
      speechLevelBufferRef.current.shift();
    }
    
    // Calculate average level with recent bias
    const weights = speechLevelBufferRef.current.map((_, i) => i + 1);
    const weightedSum = speechLevelBufferRef.current.reduce((sum, level, i) => sum + level * weights[i], 0);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const avgLevel = weightedSum / weightSum;
    
    // Determine if speaking
    const currentlySpeaking = avgLevel > speechThreshold;
    
    if (currentlySpeaking) {
      lastSpeechTimeRef.current = now;
      setIsSpeaking(true);
      
      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } else {
      // Check if enough silence has passed
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
      if (timeSinceLastSpeech > silenceRequiredMs) {
        if (isSpeaking) {
          console.log('🔇 Silence detected, stopping speech detection');
          setIsSpeaking(false);
          
          // Set timeout to send accumulated transcript
          silenceTimeoutRef.current = setTimeout(() => {
            sendAccumulatedTranscript();
          }, 500); // Small delay to ensure we're really done
        }
      }
    }
    
    return currentlySpeaking;
  }, [speechThreshold, silenceRequiredMs, isSpeaking, sendAccumulatedTranscript]);

  // Create Gladia session with minimal endpointing
  const createGladiaSession = useCallback(async () => {
    console.log('Creating Gladia session with continuous listening...');
    
    const config = {
      // Audio settings
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      
      // Model
      model: 'solaria-1',
      
      // Language
      language_config: {
        languages: ['en'],
        code_switching: false
      },
      
      // Real-time settings - Minimal endpointing, let our logic handle it
      endpointing: 1.5, // Still some endpointing but much less aggressive
      maximum_duration_without_endpointing: 30, // Allow very long speech
      
      // Pre-processing
      pre_processing: {
        audio_enhancer: true,
        speech_threshold: 0.2 // Lower threshold
      },
      
      // Message config - Focus on partials, handle finals ourselves
      messages_config: {
        receive_partial_transcripts: true,
        receive_final_transcripts: true,
        receive_speech_events: false,
        receive_pre_processing_events: false,
        receive_realtime_processing_events: false,
        receive_post_processing_events: false,
        receive_acknowledgments: false,
        receive_lifecycle_events: false
      }
    };
    
    try {
      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': apiKey
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gladia API error: ${errorText}`);
      }
      
      const session = await response.json();
      console.log('Gladia session created:', session);
      return session;
      
    } catch (error) {
      console.error('Failed to create Gladia session:', error);
      throw error;
    }
  }, [apiKey]);

  // Connect to WebSocket with smart transcript handling
  const connectWebSocket = useCallback((session: any) => {
    return new Promise<WebSocket>((resolve, reject) => {
      console.log('Connecting to WebSocket:', session.url);
      
      const ws = new WebSocket(session.url);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        resolve(ws);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transcript' && data.data && data.data.utterance) {
            const utterance = data.data.utterance;
            const text = utterance.text || '';
            const isFinal = data.data.is_final || false;
            const confidence = utterance.confidence || 0;
            
            if (text.trim()) {
              const now = Date.now();
              lastTranscriptTimeRef.current = now;
              
              console.log(`📝 Transcript [${isFinal ? 'FINAL' : 'PARTIAL'}] (${confidence.toFixed(2)}): ${text}`);
              
              if (isFinal) {
                // Add to buffer instead of sending immediately
                if (transcriptBufferRef.current) {
                  // Check if this is a continuation or new sentence
                  const lastChar = transcriptBufferRef.current.slice(-1);
                  const needsSpace = lastChar !== '' && lastChar !== ' ' && !text.startsWith(' ');
                  transcriptBufferRef.current += (needsSpace ? ' ' : '') + text;
                } else {
                  transcriptBufferRef.current = text;
                }
                
                console.log('📦 Buffered transcript:', transcriptBufferRef.current);
                
                // Only send if we're not currently speaking
                if (!isSpeaking) {
                  // Small delay to check if more speech is coming
                  setTimeout(() => {
                    if (!isSpeaking && Date.now() - lastSpeechTimeRef.current > 1000) {
                      sendAccumulatedTranscript();
                    }
                  }, 800);
                }
              } else {
                // Send partial transcripts for real-time feedback
                const displayText = transcriptBufferRef.current + (transcriptBufferRef.current ? ' ' : '') + text;
                onTranscriptReceived(displayText, false);
              }
            }
          }
          
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        // Send any remaining buffered transcript
        if (transcriptBufferRef.current.trim()) {
          sendAccumulatedTranscript();
        }
      };
      
      // Connection timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }, [onTranscriptReceived, isSpeaking, sendAccumulatedTranscript]);

  // Get microphone access
  const getMicrophoneAccess = useCallback(async () => {
    console.log('Requesting microphone access...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Microphone access granted');
      return stream;
      
    } catch (error) {
      console.error('❌ Microphone access failed:', error);
      throw error;
    }
  }, []);

  // Convert Float32 to PCM16
  const float32ToPCM16 = useCallback((float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true); // little endian
    }
    
    return buffer;
  }, []);

  // Setup audio processing with enhanced speech detection
  const setupAudioProcessing = useCallback((stream: MediaStream) => {
    console.log('Setting up audio processing with enhanced speech detection...');
    
    // Create AudioContext
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000
    });
    
    audioContextRef.current = audioContext;
    console.log('AudioContext created:', audioContext.state);
    
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('AudioContext resumed');
      });
    }
    
    // Create media stream source
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    mediaStreamSourceRef.current = mediaStreamSource;
    console.log('MediaStreamSource created');
    
    // Create script processor
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = scriptProcessor;
    console.log('ScriptProcessor created');
    
    // Process audio data
    scriptProcessor.onaudioprocess = (event) => {
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Calculate RMS (Root Mean Square) for better level detection
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      setMicLevel(rms);
      
      // Detect speech patterns
      detectSpeech(rms);
      
      // Convert to 16-bit PCM and send to Gladia
      const pcmData = float32ToPCM16(inputData);
      websocketRef.current.send(pcmData);
    };
    
    // Connect audio processing chain
    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    
    console.log('Audio processing chain connected');
  }, [float32ToPCM16, detectSpeech]);

  // Periodic cleanup of old transcript buffer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (transcriptBufferRef.current && now - lastTranscriptTimeRef.current > maxTranscriptAge) {
        console.log('🧹 Cleaning old transcript buffer');
        if (transcriptBufferRef.current.trim()) {
          sendAccumulatedTranscript();
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sendAccumulatedTranscript, maxTranscriptAge]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    console.log('=== STARTING CONTINUOUS RECORDING ===');
    updateStatus('Starting...');
    
    // Reset buffers
    transcriptBufferRef.current = '';
    lastTranscriptTimeRef.current = 0;
    lastSpeechTimeRef.current = 0;
    speechLevelBufferRef.current = [];
    
    try {
      // Step 1: Create Gladia session
      updateStatus('Creating session...');
      const session = await createGladiaSession();
      
      // Step 2: Connect WebSocket
      updateStatus('Connecting...');
      const ws = await connectWebSocket(session);
      websocketRef.current = ws;
      
      // Step 3: Get microphone
      updateStatus('Getting microphone...');
      const stream = await getMicrophoneAccess();
      audioStreamRef.current = stream;
      
      // Step 4: Setup audio processing
      updateStatus('Setting up audio...');
      setupAudioProcessing(stream);
      
      // Update state
      setIsRecording(true);
      updateStatus('Continuous Listening...');
      
      console.log('✅ Continuous recording started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      logError(`Failed to start: ${error instanceof Error ? error.message : String(error)}`);
      updateStatus('Failed to start');
      cleanup();
    }
  }, [isRecording, createGladiaSession, connectWebSocket, getMicrophoneAccess, setupAudioProcessing, updateStatus, logError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    
    console.log('=== STOPPING RECORDING ===');
    updateStatus('Stopping...');
    
    // Send any remaining buffered transcript
    if (transcriptBufferRef.current.trim()) {
      sendAccumulatedTranscript();
    }
    
    // Clear timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    cleanup();
    setIsRecording(false);
    setMicLevel(0);
    setIsSpeaking(false);
    updateStatus('Ready');
    
    console.log('✅ Recording stopped');
  }, [isRecording, updateStatus, sendAccumulatedTranscript]);

  // Cleanup resources
  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (websocketRef.current) {
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
      websocketRef.current = null;
    }
    
    // Reset all refs
    lastSpeechTimeRef.current = 0;
    speechLevelBufferRef.current = [];
    transcriptBufferRef.current = '';
    lastTranscriptTimeRef.current = 0;
  }, []);

  // Handle isEnabled changes
  useEffect(() => {
    if (isEnabled && !isRecording) {
      startRecording();
    } else if (!isEnabled && isRecording) {
      stopRecording();
    }
  }, [isEnabled, isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      cleanup();
    };
  }, [cleanup]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '12px 18px',
      borderRadius: '25px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1000,
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: isRecording ? (isSpeaking ? '#ef4444' : '#10b981') : '#6b7280',
        animation: isRecording ? 'pulse 2s infinite' : 'none'
      }} />
      <span style={{ fontWeight: '500' }}>
        🎤 {status} {isSpeaking && isRecording ? '(Speaking)' : ''}
      </span>
      {isRecording && (
        <div style={{
          fontSize: '10px',
          opacity: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Level: {micLevel.toFixed(3)}</span>
          {transcriptBufferRef.current && (
            <span>| Buffered: {transcriptBufferRef.current.length} chars</span>
          )}
        </div>
      )}
    </div>
  );
}
