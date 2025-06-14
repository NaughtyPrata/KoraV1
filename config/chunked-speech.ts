// Configuration for chunked speech functionality
export const CHUNKED_SPEECH_CONFIG = {
  // How many sentences per chunk (default: 2)
  maxSentencesPerChunk: 2,
  
  // How many chunks to generate in parallel (default: 3)
  maxConcurrentChunks: 3,
  
  // Gap between chunks in milliseconds (default: 150ms)
  gapBetweenChunks: 150,
  
  // Minimum text length to trigger chunking (default: 100 characters)
  minTextLengthForChunking: 100,
  
  // ElevenLabs voice settings
  voiceSettings: {
    stability: 0.6,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true
  },
  
  // API timeout settings
  apiTimeout: 30000, // 30 seconds
  warmupTimeout: 10000, // 10 seconds
  
  // Audio quality settings
  audioFormat: 'audio/mpeg',
  enableWebAudio: true, // Use Web Audio API when available
  
  // Fallback settings
  enableBrowserTTSFallback: true,
  browserTTSSettings: {
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0
  }
};

// Development/debugging flags
export const DEBUG_CONFIG = {
  logChunkGeneration: true,
  logAudioPlayback: true,
  logAPIWarming: true,
  showProgressIndicator: true
};
