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
  const [micLevel, setMicLevel] = useState(0);
  const [gateStatus, setGateStatus] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // Refs for audio processing
  const wsRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<GladiaSession | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseGateRef = useRef<{ threshold: number; lastVolume: number; gateOpen: boolean }>({
    threshold: 0.008, // MUCH lower threshold - more sensitive to voice
    lastVolume: 0,
    gateOpen: false
  });
  
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
    console.log('Initializing Gladia session...');
    console.log('API Key available:', !!apiKey);
    
    if (!apiKey) {
      throw new Error('Gladia API key is required');
    }

    const config = {
      // Audio settings optimized for real-time processing
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      
      // Model selection - Solaria is the latest and most accurate
      model: 'solaria-1',
      
      // Endpointing configuration - moderately conservative
      endpointing: 0.6, // Reduced from 0.8 to 0.6 seconds - more responsive but still filtered
      maximum_duration_without_endpointing: 10, // Keep at 10 seconds
      
      // Language configuration
      language_config: {
        languages: ['en'], // Specify English for better accuracy
        code_switching: false // Disable since we're only using English
      },
      
      // Pre-processing enhancements - BALANCED SENSITIVITY
      pre_processing: {
        audio_enhancer: true, // Keep audio enhancement for noise reduction
        speech_threshold: 0.4 // MORE SENSITIVE: 0.4 - easier to trigger voice detection
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

    console.log('Gladia session config:', JSON.stringify(config, null, 2));

    try {
      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': apiKey
        },
        body: JSON.stringify(config)
      });

      console.log('Gladia API response status:', response.status);
      console.log('Gladia API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gladia API error response:', errorText);
        throw new Error(`Gladia API failed (${response.status}): ${errorText}`);
      }

      const session = await response.json();
      console.log('Gladia session created successfully:', session);
      return session;
    } catch (error) {
      console.error('Gladia session initialization error:', error);
      throw new Error(`Failed to initialize Gladia session: ${error}`);
    }
  }, [apiKey]);

  const connectWebSocket = useCallback((session: GladiaSession): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      console.log('Connecting to WebSocket:', session.url);
      const ws = new WebSocket(session.url);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
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
                
                // More permissive confidence filtering to catch your voice
                if (text.trim() && confidence > 0.45) { // LOWERED to 0.45 - more sensitive to speech
                  console.log('Transcript received:', { text, isFinal, confidence });
                  onTranscriptReceived(text, isFinal);
                } else if (text.trim()) {
                  console.log('Transcript filtered (low confidence):', { text, confidence });
                }
              }
              break;
            case 'error':
              console.error('Gladia WebSocket error:', data);
              logError(`Gladia error: ${data.message || 'Unknown error'}`);
              break;
            case 'speech_event':
              // Handle speech events if needed
              break;
            default:
              // Ignore other message types
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          logError(`Error parsing WebSocket message: ${error}`);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error event:', error);
        const errorMessage = error instanceof Error ? error.message : 'WebSocket connection failed';
        reject(new Error(errorMessage));
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code === 1000) {
          updateStatus('Session completed');
        } else {
          updateStatus('Connection lost - Ready to retry');
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

  // Enhanced noise gate function
  const applyNoiseGate = useCallback((inputData: Float32Array): Float32Array => {
    const outputData = new Float32Array(inputData.length);
    const gate = noiseGateRef.current;
    
    // Calculate RMS (Root Mean Square) volume
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);
    
    // Smooth the volume reading
    gate.lastVolume = gate.lastVolume * 0.9 + rms * 0.1;
    
    // Gate logic with hysteresis to avoid chattering
    if (gate.lastVolume > gate.threshold) {
      gate.gateOpen = true;
    } else if (gate.lastVolume < gate.threshold * 0.7) { // Lower threshold for closing
      gate.gateOpen = false;
    }
    
    // Apply gate
    if (gate.gateOpen) {
      // Gate is open - pass audio through with slight gain
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * 1.2; // Slight boost for intentional speech
      }
    } else {
      // Gate is closed - silence the audio
      outputData.fill(0);
    }
    
    // Update UI with current levels for debugging
    setMicLevel(Math.round(gate.lastVolume * 1000) / 1000);
    setGateStatus(gate.gateOpen);
    
    return outputData;
  }, []);

  const setupAudioProcessing = useCallback(async (): Promise<void> => {
    // Reuse existing audio context if available and not closed
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('Reusing existing AudioContext');
      return;
    }

    // Get microphone access with ENHANCED noise suppression constraints
    if (!audioStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          // AGGRESSIVE noise suppression settings
          echoCancellation: true,
          noiseSuppression: true, 
          autoGainControl: true,
          // Browser-specific advanced constraints
          ...({
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googNoiseSuppression2: true,
            googEchoCancellation2: true,
            googAutoGainControl2: true,
            googDucking: false,
            // Additional noise suppression settings
            googAudioMirroring: false,
            googDAEchoCancellation: true,
            googNoiseReduction: true
          } as any)
        }
      });

      audioStreamRef.current = stream;
      console.log('Audio stream acquired with enhanced noise suppression:', stream.getAudioTracks()[0].getSettings());
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
      gainNode.gain.value = 1.8; // INCREASED to 1.8 - more amplification for better voice pickup
      gainNodeRef.current = gainNode;
    }

    // Create script processor with optimized buffer size
    if (!scriptProcessorRef.current) {
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1); // Larger buffer for stability
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isRecording) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Apply noise gate BEFORE other processing
          const gatedData = applyNoiseGate(inputData);
          
          // Apply high-pass filter to remove low-frequency noise (rumble, HVAC, etc.)
          const filteredData = new Float32Array(gatedData.length);
          let lastSample = 0;
          const alpha = 0.95; // LESS aggressive high-pass filtering - preserve more voice
          
          for (let i = 0; i < gatedData.length; i++) {
            filteredData[i] = alpha * (filteredData[i - 1] || 0) + alpha * (gatedData[i] - lastSample);
            lastSample = gatedData[i];
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
      if (mediaStreamSourceRef.current && gainNodeRef.current && scriptProcessorRef.current) {
        // Disconnect any existing connections
        try {
          mediaStreamSourceRef.current.disconnect();
          gainNodeRef.current.disconnect();
          scriptProcessorRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }

        // Reconnect with simplified chain (no compressor to avoid background amplification)
        mediaStreamSourceRef.current
          .connect(gainNodeRef.current)
          .connect(scriptProcessorRef.current)
          .connect(audioContextRef.current.destination);

        console.log('Audio processing chain established with noise reduction');
      }
    } catch (error) {
      console.error('Error setting up audio processing chain:', error);
      throw error;
    }
  }, [float32ToPCM16, isRecording, applyNoiseGate]);

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
    if (isRecording) {
      console.log('Already recording, skipping start request');
      return;
    }

    console.log('Starting recording process...');

    try {
      lastEnabledTimeRef.current = Date.now();
      
      // Quick reconnection if we have existing infrastructure
      if (isInitializedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('Using quick resume with existing connection');
        updateStatus('Quick resume...');
        await resumeAudioProcessing();
        setIsRecording(true);
        updateStatus('Listening (resumed)...');
        return;
      }

      updateStatus('Checking API key...');
      if (!apiKey) {
        throw new Error('No Gladia API key provided');
      }

      updateStatus('Initializing session...');
      
      // Initialize Gladia session (always create new to avoid stale sessions)
      console.log('Creating new Gladia session...');
      const session = await initializeGladiaSession();
      sessionRef.current = session;
      console.log('Session created, connecting WebSocket...');

      updateStatus('Connecting to Gladia...');

      // Connect WebSocket with the new session
      const ws = await connectWebSocket(session);
      wsRef.current = ws;
      console.log('WebSocket connected successfully');

      updateStatus('Setting up audio processing...');

      // Setup audio processing
      await setupAudioProcessing();
      await resumeAudioProcessing();
      console.log('Audio processing setup complete');

      setIsRecording(true);
      isInitializedRef.current = true;
      updateStatus('Listening (balanced)...');
      console.log('Voice recording started successfully');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`Failed to start: ${errorMessage}`);
      updateStatus('Connection failed - Retrying...');
      
      // Clean up any partial state
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      sessionRef.current = null;
      isInitializedRef.current = false;
      setIsRecording(false);
      
      // Retry after delay if still enabled
      setTimeout(() => {
        if (isEnabled) {
          console.log('Retrying voice recording start...');
          startRecording();
        }
      }, 2000); // 2 second delay for retry
    }
  }, [isRecording, isEnabled, apiKey, initializeGladiaSession, connectWebSocket, setupAudioProcessing, resumeAudioProcessing, updateStatus, logError]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    updateStatus('Pausing...');

    // Pause audio processing but keep infrastructure alive
    pauseAudioProcessing();

    setIsRecording(false);
    updateStatus('Ready (balanced filtering)');
  }, [isRecording, pauseAudioProcessing, updateStatus]);

  const fullCleanup = useCallback(() => {
    console.log('Performing full cleanup');
    
    // Clean up audio processing nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
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
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Level: {micLevel.toFixed(3)}</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: gateStatus ? '#10b981' : '#ef4444'
          }} />
        </div>
      )}
      {isRecording && (
        <div style={{
          fontSize: '10px',
          opacity: 0.8,
          background: 'rgba(16,185,129,0.2)',
          padding: '2px 8px',
          borderRadius: '10px',
          color: '#10b981'
        }}>
          Filtered
        </div>
      )}
      
      {/* Sensitivity Controls */}
      <button
        onClick={() => setShowControls(!showControls)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '12px',
          opacity: 0.7
        }}
      >
        ⚙️
      </button>
      
      {showControls && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          background: 'rgba(0,0,0,0.95)',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '10px',
          minWidth: '200px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ fontSize: '11px', marginBottom: '8px', color: '#10b981' }}>Sensitivity Controls</div>
          <div style={{ fontSize: '10px', marginBottom: '5px' }}>Threshold: {noiseGateRef.current.threshold.toFixed(3)}</div>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            <button
              onClick={() => {
                noiseGateRef.current.threshold = Math.max(0.001, noiseGateRef.current.threshold - 0.002);
              }}
              style={{
                background: '#10b981',
                border: 'none',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer'
              }}
            >
              More Sensitive
            </button>
            <button
              onClick={() => {
                noiseGateRef.current.threshold = Math.min(0.05, noiseGateRef.current.threshold + 0.002);
              }}
              style={{
                background: '#ef4444',
                border: 'none',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer'
              }}
            >
              Less Sensitive
            </button>
          </div>
          <div style={{ fontSize: '9px', opacity: 0.7 }}>Green dot = mic active</div>
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
