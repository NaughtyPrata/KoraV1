import React, { useRef, useCallback, useEffect, useState } from 'react';

export interface VoiceStreamerProps {
  onTranscriptReceived: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
  isEnabled: boolean;
  apiKey: string;
}

interface GladiaSession {
  id: string;
  url: string;
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
  
  // Refs for audio processing
  const wsRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<GladiaSession | null>(null);

  const updateStatus = useCallback((newStatus: string) => {
    console.log('VoiceStreamer status:', newStatus);
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const logError = useCallback((error: string) => {
    console.error('VoiceStreamer error:', error);
    onError?.(error);
    updateStatus(`Error: ${error}`);
  }, [onError, updateStatus]);

  const initializeGladiaSession = useCallback(async (): Promise<GladiaSession> => {
    console.log('Initializing Gladia session...');
    console.log('API Key available:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key prefix:', apiKey?.substring(0, 10) || 'none');

    if (!apiKey) {
      throw new Error('No Gladia API key provided');
    }

    const config = {
      // Simplified configuration to avoid issues
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      
      // Language configuration
      language_config: {
        languages: ['en']
      },
      
      // Basic pre-processing 
      pre_processing: {
        audio_enhancer: true,
        speech_threshold: 0.5
      },
      
      // Real-time processing
      realtime_processing: {
        words_accurate_timestamps: true,
        custom_vocabulary: true,
        custom_vocabulary_config: {
          vocabulary: [
            { value: "books", pronunciations: ["bucks", "box", "booboo"], intensity: 0.8 },
            { value: "look", pronunciations: ["took", "loot"], intensity: 0.7 },
            { value: "hello", pronunciations: ["halo", "hull"], intensity: 0.8 },
            { value: "avatar", pronunciations: ["avator"], intensity: 0.9 },
            { value: "voice", pronunciations: ["boys", "noise"], intensity: 0.8 }
          ],
          default_intensity: 0.6
        }
      }
    };

    console.log('Gladia config:', config);

    try {
      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': apiKey
        },
        body: JSON.stringify(config)
      });

      console.log('Gladia response status:', response.status);
      console.log('Gladia response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gladia error response:', errorText);
        throw new Error(`Session initialization failed: ${response.status} - ${errorText}`);
      }

      const session = await response.json();
      console.log('Gladia session created:', session);
      return session;
    } catch (error) {
      console.error('Gladia initialization error:', error);
      throw error;
    }
  }, [apiKey]);

  const connectWebSocket = useCallback((session: GladiaSession): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      console.log('Connecting to WebSocket:', session.url);
      const ws = new WebSocket(session.url);

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          switch (data.type) {
            case 'transcript':
              if (data.data && data.data.utterance) {
                const utterance = data.data.utterance;
                const isFinal = data.data.is_final || false;
                const text = utterance.text || '';
                const confidence = utterance.confidence || 0;
                
                console.log('Transcript:', { text, isFinal, confidence });
                
                if (text.trim()) {
                  onTranscriptReceived(text, isFinal);
                }
              }
              break;
            case 'error':
              console.error('Gladia WebSocket error:', data);
              logError(`Gladia error: ${data.message}`);
              break;
            default:
              console.log('Unhandled message type:', data.type);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          logError(`Error parsing WebSocket message: ${error}`);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code === 1000) {
          updateStatus('Session completed');
        } else {
          updateStatus('Disconnected');
        }
      };
    });
  }, [onTranscriptReceived, logError, updateStatus]);

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

  const setupAudioProcessing = useCallback(async (): Promise<void> => {
    console.log('Setting up audio processing...');
    
    try {
      // Get microphone access with basic constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Audio stream acquired');
      audioStreamRef.current = stream;

      // Create AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      audioContextRef.current = audioContext;

      // Create media stream source
      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = mediaStreamSource;

      // Create script processor
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Convert to 16-bit PCM
          const pcmData = float32ToPCM16(inputData);

          // Send as binary data
          wsRef.current.send(pcmData);
        }
      };

      // Connect the audio processing chain
      mediaStreamSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      console.log('Audio processing chain established');
    } catch (error) {
      console.error('Audio setup error:', error);
      throw error;
    }
  }, [float32ToPCM16]);

  const startRecording = useCallback(async () => {
    if (isRecording || !isEnabled) return;

    console.log('Starting recording...');

    try {
      updateStatus('Checking API key...');
      
      if (!apiKey) {
        throw new Error('No API key provided');
      }

      updateStatus('Initializing session...');
      
      // Initialize Gladia session
      const session = await initializeGladiaSession();
      sessionRef.current = session;

      updateStatus('Connecting to Gladia...');

      // Connect WebSocket
      const ws = await connectWebSocket(session);
      wsRef.current = ws;

      updateStatus('Setting up audio...');

      // Setup audio processing
      await setupAudioProcessing();

      setIsRecording(true);
      updateStatus('Listening...');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      logError(`Failed to start: ${error}`);
      cleanup();
    }
  }, [isRecording, isEnabled, apiKey, initializeGladiaSession, connectWebSocket, setupAudioProcessing, updateStatus, logError]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    console.log('Stopping recording...');
    updateStatus('Stopping...');

    // Send stop message to Gladia
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stop_recording'
      }));
    }

    setIsRecording(false);
    cleanup();
    updateStatus('Ready');
  }, [isRecording, updateStatus]);

  const cleanup = useCallback(() => {
    console.log('Cleaning up audio resources...');
    
    // Clean up audio processing
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

    // Clean up media stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // WebSocket will close naturally
    wsRef.current = null;
    sessionRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Auto-manage recording based on isEnabled
  useEffect(() => {
    if (isEnabled && !isRecording) {
      startRecording();
    } else if (!isEnabled && isRecording) {
      stopRecording();
    }
  }, [isEnabled, isRecording, startRecording, stopRecording]);

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
          background: 'rgba(16,185,129,0.2)',
          padding: '2px 8px',
          borderRadius: '10px',
          color: '#10b981'
        }}>
          Debug Mode
        </div>
      )}
    </div>
  );
}
