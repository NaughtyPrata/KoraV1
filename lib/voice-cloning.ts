import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

interface VoiceCloneOptions {
  name: string;
  description?: string;
  audioFilePath: string;
  removeBackgroundNoise?: boolean;
  labels?: string;
}

interface VoiceCloneResponse {
  voice_id: string;
  requires_verification: boolean;
}

export async function cloneVoice(options: VoiceCloneOptions): Promise<VoiceCloneResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  if (!fs.existsSync(options.audioFilePath)) {
    throw new Error(`Audio file not found: ${options.audioFilePath}`);
  }

  const formData = new FormData();
  formData.append('name', options.name);
  
  if (options.description) {
    formData.append('description', options.description);
  }
  
  if (options.labels) {
    formData.append('labels', options.labels);
  }
  
  formData.append('remove_background_noise', options.removeBackgroundNoise ? 'true' : 'false');
  formData.append('files', fs.createReadStream(options.audioFilePath));

  try {
    const response = await axios.post('https://api.elevenlabs.io/v1/voices/add', formData, {
      headers: {
        'xi-api-key': apiKey,
        ...formData.getHeaders(),
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Voice cloning error:', error.response?.data || error.message);
    throw new Error(`Voice cloning failed: ${error.response?.status} - ${error.response?.data || error.message}`);
  }
}

// Example usage function
export async function cloneVoiceExample() {
  try {
    const result = await cloneVoice({
      name: 'My Custom Voice',
      description: 'A voice cloned from my audio sample',
      audioFilePath: './audio-samples/my-voice.mp3',
      removeBackgroundNoise: true,
    });

    console.log('Voice cloned successfully!');
    console.log('Voice ID:', result.voice_id);
    console.log('Requires verification:', result.requires_verification);
    
    return result;
  } catch (error) {
    console.error('Failed to clone voice:', error);
    throw error;
  }
} 