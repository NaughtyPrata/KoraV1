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
  const [isPersistentMode, setIsPersistentMode] = useState(false);
  
  // Refs for audio processing
  const wsRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<GladiaSession | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const dynamicsCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  // Recovery optimization refs
  const lastEnabledTimeRef = useRef<number>(0);
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

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
      // Audio settings optimized for real-time processing
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      
      // Model selection - Solaria is the latest and most accurate
      model: 'solaria-1',
      
      // Endpointing configuration (in seconds, not milliseconds)
      endpointing: 0.3, // 300ms - more conservative to avoid cutting off words
      maximum_duration_without_endpointing: 8, // Allow longer utterances
      
      // Language configuration
      language_config: {
        languages: ['en'], // Specify English for better accuracy
        code_switching: false // Disable since we're only using English
      },
      
      // Pre-processing enhancements
      pre_processing: {
        audio_enhancer: true, // Enable audio enhancement for noise reduction
        speech_threshold: 0.4 // Lower threshold to catch quieter speech (0.4 vs default 0.6)
      },
      
      // Real-time processing configuration
      realtime_processing: {
        words_accurate_timestamps: true, // Enable word-level timestamps
        custom_vocabulary: true, // Enable custom vocabulary
        custom_vocabulary_config: {
          vocabulary: [
            // Common tech/conversation words that might be misheard
            { value: "books", pronunciations: ["bucks", "box", "booboo"], intensity: 0.8 },
            { value: "look", pronunciations: ["took", "loot"], intensity: 0.7 },
            { value: "looks", pronunciations: ["lucks", "loops"], intensity: 0.7 },
            { value: "hello", pronunciations: ["halo", "hull"], intensity: 0.8 },
            { value: "avatar", pronunciations: ["avator"], intensity: 0.9 },
            { value: "voice", pronunciations: ["boys", "noise"], intensity: 0.8 },
            { value: "chat", pronunciations: ["cat", "that"], intensity: 0.7 },
            { value: "talk", pronunciations: ["took", "walk"], intensity: 0.7 },
            { value: "speak", pronunciations: ["speak", "spike"], intensity: 0.8 },
            { value: "say", pronunciations: ["stay", "way"], intensity: 0.7 },
            { value: "tell", pronunciations: ["well", "hell"], intensity: 0.7 },
            { value: "ask", pronunciations: ["ask", "ax"], intensity: 0.8 },
            { value: "kora", pronunciations: ["core", "coral", "korea"], intensity: 0.9 },
            { value: "AI", pronunciations: ["I", "eye"], intensity: 0.8 },
            { value: "help", pronunciations: ["kelp", "yelp"], intensity: 0.8 },
            { value: "can", pronunciations: ["can", "ken"], intensity: 0.7 },
            { value: "could", pronunciations: ["good", "would"], intensity: 0.7 },
            { value: "should", pronunciations: ["should", "wood"], intensity: 0.7 },
            { value: "would", pronunciations: ["would", "wood"], intensity: 0.7 },
            { value: "please", pronunciations: ["please", "place"], intensity: 0.8 },
            { value: "thank", pronunciations: ["tank", "think"], intensity: 0.8 },
            { value: "thanks", pronunciations: ["tanks", "thinks"], intensity: 0.8 }
          ],
          default_intensity: 0.6 // Default intensity for vocabulary matching
        }
      },
      
      // Message configuration - optimize for real-time feedback
      messages_config: {
        receive_partial_transcripts: true, // Show partial results for immediate feedback
        receive_final_transcripts: true, // Also get final, more accurate results
        receive_speech_events: false, // Disable to reduce noise
        receive_pre_processing_events: false,
        receive_realtime_processing_events: false,
        receive_post_processing_events: false,
        receive_acknowledgments: false,
        receive_lifecycle_events: false
      }
    };

    console.log('Initializing Gladia session with enhanced config:', config);

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
        console.log('WebSocket connected successfully');
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
                const confidence = utterance.confidence || 0;
                
                // Only process high-confidence transcripts to reduce noise
                if (text.trim() && confidence > 0.5) {
                  console.log('Transcript received:', { text, isFinal, confidence });
                  onTranscriptReceived(text, isFinal);
                }
              }
              break;
            case 'error':
              logError(`Gladia error: ${data.message}`);
              break;
            case 'speech_event':
              // Handle speech events if needed
              break;
            default:
              // Ignore other message types
              break;
          }
        } catch (error) {
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
          updateStatus('Disconnected - Ready to reconnect');
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
    // Reuse existing audio context if available and not closed
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('Reusing existing AudioContext');
      return;
    }

    // Get microphone access with enhanced audio constraints
    if (!audioStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true, // Enable echo cancellation
          noiseSuppression: true, // Enable noise suppression
          autoGainControl: true, // Enable automatic gain control
          // Additional constraints for better audio quality (cast to any for browser-specific)
          ...({
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googNoiseSuppression2: true,
            googEchoCancellation2: true,
            googAutoGainControl2: true,
            googDucking: false // Disable ducking to avoid volume changes
          } as any)
        }
      });

      audioStreamRef.current = stream;
      console.log('Audio stream acquired with constraints:', stream.getAudioTracks()[0].getSettings());
    }

    // Create AudioContext with optimal settings (reuse if possible)
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive' // Optimize for low latency
      });

      audioContextRef.current = audioContext;
    }

    // Resume context if suspended
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Create media stream source (reuse if possible)
    if (!mediaStreamSourceRef.current && audioStreamRef.current) {
      const mediaStreamSource = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
      mediaStreamSourceRef.current = mediaStreamSource;
    }

    // Create gain node for volume control (reuse if possible)
    if (!gainNodeRef.current) {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 2.0; // Boost volume slightly
      gainNodeRef.current = gainNode;
    }

    // Create dynamics compressor for consistent volume (reuse if possible)
    if (!dynamicsCompressorRef.current) {
      const compressor = audioContextRef.current.createDynamicsCompressor();
      compressor.threshold.value = -24; // Compression threshold
      compressor.knee.value = 30; // Soft knee
      compressor.ratio.value = 12; // Compression ratio
      compressor.attack.value = 0.003; // Fast attack
      compressor.release.value = 0.25; // Medium release
      dynamicsCompressorRef.current = compressor;
    }

    // Create script processor with smaller buffer for lower latency
    if (!scriptProcessorRef.current) {
      const scriptProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isRecording) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Apply simple high-pass filter to reduce low-frequency noise
          const filteredData = new Float32Array(inputData.length);
          let lastSample = 0;
          const alpha = 0.95; // High-pass filter coefficient
          
          for (let i = 0; i < inputData.length; i++) {
            filteredData[i] = alpha * (filteredData[i - 1] || 0) + alpha * (inputData[i] - lastSample);
            lastSample = inputData[i];
          }

          // Convert to 16-bit PCM
          const pcmData = float32ToPCM16(filteredData);

          // Send as binary data
          wsRef.current.send(pcmData);
        }
      };
    }

    // Connect the audio processing chain (disconnect first to avoid duplicates)
    try {
      if (mediaStreamSourceRef.current && gainNodeRef.current && dynamicsCompressorRef.current && scriptProcessorRef.current) {
        // Disconnect any existing connections
        try {
          mediaStreamSourceRef.current.disconnect();
          gainNodeRef.current.disconnect();
          dynamicsCompressorRef.current.disconnect();
          scriptProcessorRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }

        // Reconnect
        mediaStreamSourceRef.current
          .connect(gainNodeRef.current)
          .connect(dynamicsCompressorRef.current)
          .connect(scriptProcessorRef.current)
          .connect(audioContextRef.current.destination);

        console.log('Audio processing chain established/reestablished');
      }
    } catch (error) {
      console.error('Error setting up audio processing chain:', error);
      throw error;
    }
  }, [float32ToPCM16, isRecording]);

  const pauseAudioProcessing = useCallback(() => {
    // Pause by disconnecting the script processor from sending data
    if (scriptProcessorRef.current) {
      console.log('Pausing audio processing (keeping context alive)');
      // We keep the context alive but stop processing audio in the callback
    }
  }, []);

  const resumeAudioProcessing = useCallback(async () => {
    // Resume by reconnecting and ensuring context is running
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    console.log('Resuming audio processing');
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      lastEnabledTimeRef.current = Date.now();
      
      // Quick reconnection if we have existing infrastructure
      if (isInitializedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        updateStatus('Quick resume...');
        await resumeAudioProcessing();
        setIsRecording(true);
        updateStatus('Listening (resumed)...');
        return;
      }

      updateStatus('Initializing session...');
      
      // Initialize Gladia session (reuse if recent)
      if (!sessionRef.current || (Date.now() - lastEnabledTimeRef.current) > 30000) {
        const session = await initializeGladiaSession();
        sessionRef.current = session;
      }

      updateStatus('Connecting...');

      // Connect WebSocket (or reuse if still open)
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const ws = await connectWebSocket(sessionRef.current);
        wsRef.current = ws;
      }

      updateStatus('Setting up audio...');

      // Setup audio processing (reuse existing if possible)
      await setupAudioProcessing();
      await resumeAudioProcessing();

      setIsRecording(true);
      isInitializedRef.current = true;
      updateStatus('Listening (enhanced)...');
      
    } catch (error) {
      logError(`Failed to start recording: ${error}`);
      updateStatus('Error - Retrying...');
      
      // Clean up and retry after short delay
      setTimeout(() => {
        if (isEnabled) {
          startRecording();
        }
      }, 1000);
    }
  }, [isRecording, isEnabled, initializeGladiaSession, connectWebSocket, setupAudioProcessing, resumeAudioProcessing, updateStatus, logError]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    updateStatus('Pausing...');

    // Pause audio processing but keep infrastructure alive
    pauseAudioProcessing();

    setIsRecording(false);
    updateStatus('Ready (quick resume available)');
  }, [isRecording, pauseAudioProcessing, updateStatus]);

  const fullCleanup = useCallback(() => {
    console.log('Performing full cleanup');
    
    // Clean up audio processing nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (dynamicsCompressorRef.current) {
      dynamicsCompressorRef.current.disconnect();
      dynamicsCompressorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
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

    // Clean up WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop_recording' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    sessionRef.current = null;
    isInitializedRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fullCleanup();
    };
  }, [fullCleanup]);

  // Intelligent management based on isEnabled
  useEffect(() => {
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }

    if (isEnabled && !isRecording) {
      // Immediate start or quick resume
      startRecording();
    } else if (!isEnabled && isRecording) {
      // Pause instead of full stop for quick recovery
      stopRecording();
      
      // Schedule full cleanup after 30 seconds of inactivity
      reconnectionTimeoutRef.current = setTimeout(() => {
        if (!isEnabled) {
          fullCleanup();
          updateStatus('Ready');
        }
      }, 30000);
    }
  }, [isEnabled, isRecording, startRecording, stopRecording, fullCleanup, updateStatus]);

  // Enable persistent mode after first successful connection
  useEffect(() => {
    if (isRecording && !isPersistentMode) {
      setIsPersistentMode(true);
      console.log('Persistent mode enabled for faster recovery');
    }
  }, [isRecording, isPersistentMode]);

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
        background: isRecording ? '#10b981' : isPersistentMode ? '#f59e0b' : '#6b7280',
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
          Enhanced
        </div>
      )}
      {isPersistentMode && !isRecording && (
        <div style={{
          fontSize: '10px',
          opacity: 0.8,
          background: 'rgba(245,158,11,0.2)',
          padding: '2px 8px',
          borderRadius: '10px',
          color: '#f59e0b'
        }}>
          Quick Resume
        </div>
      )}
    </div>
  );
}
