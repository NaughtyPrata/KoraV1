import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Default voice ID (Yi - custom cloned voice)
const DEFAULT_VOICE_ID = 'Nq705LUoPRICK1U4GVme';

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsResponse {
  audioUrl: string;
  audioBuffer: ArrayBuffer;
}

export async function generateSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<ElevenLabsResponse> {
  try {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key is not configured');
    }
    const voiceSettings: VoiceSettings = {
      stability: 0.6,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true
    };

    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: voiceSettings
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert ArrayBuffer to blob URL for audio playback
    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      audioBuffer: response.data
    };
  } catch (error: any) {
    console.error('ElevenLabs API error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      voiceId: voiceId
    });
    throw new Error(`Failed to generate speech: ${error.response?.data?.detail || error.message}`);
  }
}

export async function getAvailableVoices() {
  try {
    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    return response.data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [];
  }
}

export async function validateVoiceId(voiceId: string): Promise<boolean> {
  try {
    const voices = await getAvailableVoices();
    return voices.some((voice: any) => voice.voice_id === voiceId);
  } catch (error) {
    console.error('Error validating voice ID:', error);
    return false;
  }
}

// Audio analysis for lip sync (basic implementation)
export function analyzeAudioForLipSync(audioBuffer: ArrayBuffer): number[] {
  // This is a simplified version - in production you'd use Web Audio API
  // to analyze frequency data for more accurate lip sync
  const dataView = new DataView(audioBuffer);
  const samples: number[] = [];
  
  // Sample every 100th byte for basic amplitude analysis
  for (let i = 0; i < dataView.byteLength; i += 100) {
    const sample = dataView.getInt16(i, true) / 32768; // Normalize to -1 to 1
    samples.push(Math.abs(sample));
  }
  
  return samples;
} 