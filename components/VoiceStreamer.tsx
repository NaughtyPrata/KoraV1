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
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const logError = useCallback((error: string) => {
    console.error('VoiceStreamer:', error);
    onError?.(error);
  }, [onError]);

  const initializeGladiaSession = useCallback(async (): Promise<GladiaSession> => {
    const config = {
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      language_config: {
        languages: ['en'],
        code_switching: false
      },
      realtime_processing: {
        words_accurate_timestamps: true,
        custom_vocabulary: false
      }
    };

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
      throw new Error(`Session initialization failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }, [apiKey]);

  const connectWebSocket = useCallback((session: GladiaSession): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(session.url);

      ws.onopen = () => {
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'transcript':
              if (data.data && data.data.utterance) {
                const utterance = data.data.utterance;
                const isFinal = data.data.is_final || false;
                const text = utterance.text || '';
                
                if (text.trim()) {
                  onTranscriptReceived(text, isFinal);
                }
              }
              break;
            case 'error':
              logError(`Gladia error: ${data.message}`);
              break;
          }
        } catch (error) {
          logError(`Error parsing WebSocket message: ${error}`);
        }
      };

      ws.onerror = (error) => {
        reject(error);
      };

      ws.onclose = (event) => {
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
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

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
  }, [float32ToPCM16]);

  const startRecording = useCallback(async () => {
    if (isRecording || !isEnabled) return;

    try {
      updateStatus('Initializing session...');
      
      // Initialize Gladia session
      const session = await initializeGladiaSession();
      sessionRef.current = session;

      updateStatus('Connecting...');

      // Connect WebSocket
      const ws = await connectWebSocket(session);
      wsRef.current = ws;

      updateStatus('Setting up audio...');

      // Setup audio processing
      await setupAudioProcessing();

      setIsRecording(true);
      updateStatus('Listening...');
      
    } catch (error) {
      logError(`Failed to start recording: ${error}`);
      updateStatus('Error');
      cleanup();
    }
  }, [isRecording, isEnabled, initializeGladiaSession, connectWebSocket, setupAudioProcessing, updateStatus, logError]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

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
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '20px',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: 1000
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: isRecording ? '#ef4444' : '#6b7280'
      }} />
      <span>Voice: {status}</span>
      {isRecording && (
        <div style={{
          width: '12px',
          height: '12px',
          background: '#ef4444',
          borderRadius: '50%',
          animation: 'pulse 2s infinite'
        }} />
      )}
    </div>
  );
}