export interface AudioChunkData {
  index: number;
  text: string;
  audioData: string; // base64
  mimeType: string;
}

export interface ChunkedAudioPlayerOptions {
  onChunkStart?: (chunk: AudioChunkData) => void;
  onChunkEnd?: (chunk: AudioChunkData) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  preloadNext?: boolean; // Whether to preload the next chunk while playing current
}

export class ChunkedAudioPlayer {
  private chunks: AudioChunkData[] = [];
  private currentChunkIndex = 0;
  private audioElements: HTMLAudioElement[] = [];
  private isPlaying = false;
  private options: ChunkedAudioPlayerOptions;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor(options: ChunkedAudioPlayerOptions = {}) {
    this.options = {
      preloadNext: true,
      ...options
    };
  }

  // Load chunks for playback
  loadChunks(chunks: AudioChunkData[]) {
    this.chunks = [...chunks].sort((a, b) => a.index - b.index);
    this.currentChunkIndex = 0;
    this.prepareAudioElements();
    console.log(`Loaded ${this.chunks.length} audio chunks for playback`);
  }

  // Prepare audio elements for all chunks
  private prepareAudioElements() {
    // Clean up existing elements
    this.audioElements.forEach(el => {
      el.src = '';
      el.remove();
    });
    this.audioElements = [];

    // Create audio elements for each chunk
    this.chunks.forEach((chunk, index) => {
      const audio = document.createElement('audio');
      audio.preload = 'none'; // We'll load on demand
      
      // Convert base64 to blob URL
      const binaryString = atob(chunk.audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: chunk.mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audio.src = audioUrl;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      this.audioElements[index] = audio;

      // Preload first chunk and next chunk if enabled
      if (index === 0 || (this.options.preloadNext && index === 1)) {
        audio.preload = 'auto';
        audio.load();
      }
    });
  }

  // Initialize Web Audio API for better control and analysis
  private async initializeWebAudio() {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Create analyser for lip sync
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.connect(this.audioContext.destination);
      }
    } catch (error) {
      console.warn('Web Audio API initialization failed:', error);
    }
  }

  // Start playing chunks sequentially
  async play(): Promise<void> {
    if (this.isPlaying || this.chunks.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.currentChunkIndex = 0;

    await this.initializeWebAudio();

    try {
      await this.playChunksSequentially();
    } catch (error) {
      console.error('Playback error:', error);
      this.options.onError?.(error as Error);
    } finally {
      this.isPlaying = false;
      this.options.onComplete?.();
    }
  }

  // Play chunks one after another
  private async playChunksSequentially(): Promise<void> {
    for (let i = 0; i < this.chunks.length; i++) {
      if (!this.isPlaying) break; // Allow stopping mid-playback

      this.currentChunkIndex = i;
      const chunk = this.chunks[i];
      const audio = this.audioElements[i];

      if (!audio) {
        console.error(`Audio element not found for chunk ${i}`);
        continue;
      }

      try {
        // Preload next chunk if enabled
        if (this.options.preloadNext && i + 1 < this.audioElements.length) {
          const nextAudio = this.audioElements[i + 1];
          if (nextAudio.preload !== 'auto') {
            nextAudio.preload = 'auto';
            nextAudio.load();
          }
        }

        console.log(`Playing chunk ${i + 1}/${this.chunks.length}: "${chunk.text}"`);
        this.options.onChunkStart?.(chunk);

        // Connect to Web Audio API if available
        if (this.audioContext && this.analyser) {
          try {
            const source = this.audioContext.createMediaElementSource(audio);
            source.connect(this.analyser);
          } catch (webAudioError) {
            // Ignore if we can't connect to Web Audio API
            console.warn('Web Audio API connection failed for chunk:', webAudioError);
          }
        }

        await this.playAudioElement(audio);
        
        this.options.onChunkEnd?.(chunk);
        
        // Small gap between chunks for natural speech flow
        if (i < this.chunks.length - 1) {
          await this.sleep(100); // 100ms gap
        }
      } catch (error) {
        console.error(`Error playing chunk ${i + 1}:`, error);
        // Continue with next chunk even if current one fails
      }
    }
  }

  // Play a single audio element with promise
  private playAudioElement(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const handleEnded = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = (e: any) => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        reject(new Error(`Audio playback error: ${e.target?.error?.message || 'Unknown error'}`));
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      audio.currentTime = 0;
      const playPromise = audio.play();
      
      if (playPromise) {
        playPromise.catch(reject);
      }
    });
  }

  // Stop playback
  stop() {
    this.isPlaying = false;
    
    // Stop all audio elements
    this.audioElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    console.log('Chunked audio playback stopped');
  }

  // Get current playing chunk info
  getCurrentChunk(): AudioChunkData | null {
    return this.chunks[this.currentChunkIndex] || null;
  }

  // Get analyser for lip sync
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Check if currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Clean up resources
  dispose() {
    this.stop();
    
    // Clean up audio elements and URLs
    this.audioElements.forEach(audio => {
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audio.remove();
    });
    this.audioElements = [];

    // Clean up Web Audio API
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }

    this.chunks = [];
  }

  // Utility method for delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for easier usage
export function createChunkedAudioPlayer(options?: ChunkedAudioPlayerOptions): ChunkedAudioPlayer {
  return new ChunkedAudioPlayer(options);
}
