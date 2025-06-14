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
  
  // Refs for audio processing
  const websocketRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const logError = useCallback((error: string) => {
    console.error('VoiceStreamer:', error);
    onError?.(error);
  }, [onError]);

  // Create Gladia session
  const createGladiaSession = useCallback(async () => {
    console.log('Creating Gladia session...');
    
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
      
      // Real-time settings
      endpointing: 0.5,
      maximum_duration_without_endpointing: 8,
      
      // Pre-processing
      pre_processing: {
        audio_enhancer: true,
        speech_threshold: 0.5
      },
      
      // Message config
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

  // Connect to WebSocket
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
              console.log(`Transcript [${isFinal ? 'FINAL' : 'PARTIAL'}] (${confidence.toFixed(2)}): ${text}`);
              onTranscriptReceived(text, isFinal);
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
      };
      
      // Connection timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }, [onTranscriptReceived]);

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

  // Setup audio processing
  const setupAudioProcessing = useCallback((stream: MediaStream) => {
    console.log('Setting up audio processing...');
    
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
      
      // Calculate audio level for visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += Math.abs(inputData[i]);
      }
      const level = sum / inputData.length;
      setMicLevel(level);
      
      // Convert to 16-bit PCM and send to Gladia
      const pcmData = float32ToPCM16(inputData);
      websocketRef.current.send(pcmData);
    };
    
    // Connect audio processing chain
    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    
    console.log('Audio processing chain connected');
  }, [float32ToPCM16]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    console.log('=== STARTING RECORDING ===');
    updateStatus('Starting...');
    
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
      updateStatus('Listening...');
      
      console.log('✅ Recording started successfully');
      
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
    
    cleanup();
    setIsRecording(false);
    setMicLevel(0);
    updateStatus('Ready');
    
    console.log('✅ Recording stopped');
  }, [isRecording, updateStatus]);

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
        background: isRecording ? '#10b981' : '#6b7280',
        animation: isRecording ? 'pulse 2s infinite' : 'none'
      }} />
      <span style={{ fontWeight: '500' }}>
        🎤 {status}
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
        </div>
      )}
    </div>
  );
}
