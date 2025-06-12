import { AvatarData, VISEME_MAPPING, updateMorphTargets } from '@/lib/readyplayerme';

export interface LipSyncData {
  time: number;
  viseme: string;
  intensity: number;
}

export class LipSyncController {
  private avatarData: AvatarData;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private isActive: boolean = false;
  private currentAudioSource: MediaElementAudioSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;

  constructor(avatarData: AvatarData) {
    this.avatarData = avatarData;
  }

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  startLipSync(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser || !this.dataArray) {
      console.error('LipSync not initialized');
      return;
    }

    try {
      // Check if we need to create a new audio source
      if (this.currentAudioElement !== audioElement || !this.currentAudioSource) {
        // Disconnect previous source if it exists
        if (this.currentAudioSource) {
          this.currentAudioSource.disconnect();
        }
        
        // Create new source for the new audio element
        this.currentAudioSource = this.audioContext.createMediaElementSource(audioElement);
        this.currentAudioElement = audioElement;
        
        // Connect the new source
        this.currentAudioSource.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      this.isActive = true;
      this.animate();
    } catch (error) {
      console.error('Error starting lip sync:', error);
      // If we get the "already associated" error, try to continue with existing source
      if (error instanceof DOMException && error.name === 'InvalidStateError' && this.currentAudioSource) {
        console.log('Reusing existing audio source');
        this.isActive = true;
        this.animate();
      }
    }
  }

  stopLipSync(): void {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Reset mouth to neutral position
    this.resetMouth();
  }

  private animate(): void {
    if (!this.isActive || !this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average amplitude
    const average = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;
    const normalizedAmplitude = average / 255;

    // Simple lip sync based on amplitude
    this.updateMouthShape(normalizedAmplitude);

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private updateMouthShape(amplitude: number): void {
    const morphTargets: { [key: string]: number } = {};

    if (amplitude > 0.1) {
      // Open mouth based on amplitude
      const openAmount = Math.min(amplitude * 2, 1);
      
      // Primary mouth opening visemes
      morphTargets['viseme_aa'] = openAmount * 0.7;
      morphTargets['viseme_E'] = openAmount * 0.3;
      
      // Add some variation based on frequency content
      if (this.dataArray) {
        const lowFreq = this.dataArray.slice(0, 10).reduce((sum, val) => sum + val, 0) / 10;
        const midFreq = this.dataArray.slice(10, 30).reduce((sum, val) => sum + val, 0) / 20;
        const highFreq = this.dataArray.slice(30, 60).reduce((sum, val) => sum + val, 0) / 30;

        // Adjust visemes based on frequency content
        if (lowFreq > midFreq) {
          morphTargets['viseme_O'] = (lowFreq / 255) * openAmount * 0.5;
          morphTargets['viseme_U'] = (lowFreq / 255) * openAmount * 0.3;
        }
        
        if (highFreq > midFreq) {
          morphTargets['viseme_I'] = (highFreq / 255) * openAmount * 0.4;
          morphTargets['viseme_E'] = (highFreq / 255) * openAmount * 0.6;
        }
      }
    } else {
      // Close mouth
      morphTargets['viseme_sil'] = 1;
    }

    // For fallback avatar, animate mouth and head movement
    const avatarParts = (this.avatarData.scene as any).avatarParts;
    if (avatarParts && amplitude > 0.1) {
      const openAmount = Math.min(amplitude * 3, 1);
      
      // Animate mouth opening
      if (avatarParts.mouth) {
        avatarParts.mouth.scale.y = 0.5 + (openAmount * 1.5);
        avatarParts.mouth.scale.x = 1.5 + (openAmount * 0.5);
      }
      
      // Subtle head movement while speaking
      if (this.avatarData.head) {
        const time = Date.now() * 0.01;
        this.avatarData.head.rotation.y = Math.sin(time) * 0.02 * amplitude;
        this.avatarData.head.rotation.x = Math.sin(time * 0.7) * 0.01 * amplitude;
      }
      
             // Arm gestures during speech
       if (avatarParts.leftUpperArm && avatarParts.rightUpperArm) {
         const gestureAmount = amplitude * 0.3;
         const time = Date.now() * 0.01;
         avatarParts.leftUpperArm.rotation.z = (Math.PI / 8) + (Math.sin(time * 0.5) * gestureAmount);
         avatarParts.rightUpperArm.rotation.z = (-Math.PI / 8) + (Math.sin(time * 0.3) * gestureAmount);
       }
    } else if (avatarParts) {
      // Reset to neutral position
      if (avatarParts.mouth) {
        avatarParts.mouth.scale.set(1.5, 0.5, 0.5);
      }
      if (this.avatarData.head) {
        this.avatarData.head.rotation.set(0, 0, 0);
      }
      if (avatarParts.leftUpperArm && avatarParts.rightUpperArm) {
        avatarParts.leftUpperArm.rotation.z = Math.PI / 8;
        avatarParts.rightUpperArm.rotation.z = -Math.PI / 8;
      }
    }

    updateMorphTargets(this.avatarData, morphTargets);
  }

  private resetMouth(): void {
    const morphTargets: { [key: string]: number } = {};
    
    // Reset all visemes to 0
    Object.values(VISEME_MAPPING).flat().forEach(viseme => {
      morphTargets[viseme] = 0;
    });
    
    // Set neutral mouth position
    morphTargets['viseme_sil'] = 1;
    
    updateMorphTargets(this.avatarData, morphTargets);
  }

  // Advanced lip sync with phoneme timing
  playLipSyncSequence(sequence: LipSyncData[]): void {
    let currentIndex = 0;
    const startTime = Date.now();

    const playSequence = () => {
      if (currentIndex >= sequence.length) {
        this.resetMouth();
        return;
      }

      const currentTime = Date.now() - startTime;
      const currentFrame = sequence[currentIndex];

      if (currentTime >= currentFrame.time) {
        this.playViseme(currentFrame.viseme, currentFrame.intensity);
        currentIndex++;
      }

      requestAnimationFrame(playSequence);
    };

    playSequence();
  }

  private playViseme(viseme: string, intensity: number): void {
    const morphTargets: { [key: string]: number } = {};
    
    // Reset all visemes
    Object.values(VISEME_MAPPING).flat().forEach(v => {
      morphTargets[v] = 0;
    });

    // Set the target viseme
    const visemeTargets = VISEME_MAPPING[viseme.toUpperCase()];
    if (visemeTargets) {
      visemeTargets.forEach(target => {
        morphTargets[target] = intensity;
      });
    }

    updateMorphTargets(this.avatarData, morphTargets);
  }

  dispose(): void {
    this.stopLipSync();
    
    // Disconnect audio source
    if (this.currentAudioSource) {
      this.currentAudioSource.disconnect();
      this.currentAudioSource = null;
    }
    
    this.currentAudioElement = null;
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
  }
}

// Text-to-phoneme conversion (simplified)
export function textToPhonemes(text: string): LipSyncData[] {
  const words = text.toLowerCase().split(' ');
  const sequence: LipSyncData[] = [];
  let currentTime = 0;
  const averageWordDuration = 500; // ms per word

  words.forEach((word, wordIndex) => {
    const letters = word.split('');
    const letterDuration = averageWordDuration / letters.length;

    letters.forEach((letter, letterIndex) => {
      const viseme = getVisemeForLetter(letter);
      const intensity = 0.7 + Math.random() * 0.3; // Add some variation

      sequence.push({
        time: currentTime + (letterIndex * letterDuration),
        viseme: viseme,
        intensity: intensity
      });
    });

    currentTime += averageWordDuration + 100; // Add pause between words
  });

  return sequence;
}

function getVisemeForLetter(letter: string): string {
  const letterToViseme: { [key: string]: string } = {
    'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
    'b': 'B', 'p': 'P', 'm': 'M',
    'f': 'F', 'v': 'V',
    'd': 'D', 't': 'T', 'n': 'N', 'l': 'L',
    'r': 'R',
    's': 'S', 'z': 'Z',
    'k': 'K', 'g': 'G', 'c': 'C',
    'w': 'W',
    'y': 'Y',
    'h': 'H'
  };

  return letterToViseme[letter] || 'A';
}

// Create lip sync data from audio buffer analysis
export function createLipSyncFromAudio(audioBuffer: ArrayBuffer, duration: number): LipSyncData[] {
  const samples = new Int16Array(audioBuffer);
  const sequence: LipSyncData[] = [];
  const frameRate = 30; // 30 FPS
  const samplesPerFrame = Math.floor(samples.length / (duration * frameRate));

  for (let frame = 0; frame < duration * frameRate; frame++) {
    const startSample = frame * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, samples.length);
    
    // Calculate RMS amplitude for this frame
    let sum = 0;
    for (let i = startSample; i < endSample; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / (endSample - startSample));
    const normalizedAmplitude = Math.min(rms / 32768, 1);

    if (normalizedAmplitude > 0.01) {
      sequence.push({
        time: (frame / frameRate) * 1000,
        viseme: normalizedAmplitude > 0.5 ? 'A' : 'E',
        intensity: normalizedAmplitude
      });
    }
  }

  return sequence;
} 