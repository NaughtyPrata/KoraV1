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

export interface AudioChunk {
  audioBuffer: ArrayBuffer;
  text: string;
  index: number;
}

export interface ChunkedSpeechResponse {
  chunks: AudioChunk[];
  totalChunks: number;
}

// Function to split text into chunks of complete sentences
export function splitTextIntoChunks(text: string, maxSentencesPerChunk: number = 2): string[] {
  // Split by sentence endings, keeping the punctuation
  const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
  const chunks: string[] = [];
  
  for (let i = 0; i < sentences.length; i += maxSentencesPerChunk) {
    const chunk = sentences.slice(i, i + maxSentencesPerChunk).join(' ').trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }
  
  // If no sentences were found (no punctuation), split by length
  if (chunks.length === 0 && text.length > 0) {
    const words = text.split(' ');
    const wordsPerChunk = Math.max(10, Math.floor(words.length / Math.ceil(words.length / 20)));
    
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ').trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }
  }
  
  return chunks.length > 0 ? chunks : [text];
}

// Generate speech for a single chunk
export async function generateSpeechChunk(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  index: number = 0
): Promise<AudioChunk> {
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

    console.log(`Generating speech chunk ${index + 1} for text: "${text.substring(0, 50)}..."`);

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
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout per chunk
      }
    );

    console.log(`Chunk ${index + 1} generated successfully, size: ${response.data.byteLength} bytes`);

    return {
      audioBuffer: response.data,
      text: text,
      index: index
    };
  } catch (error: any) {
    console.error(`ElevenLabs API error for chunk ${index + 1}:`, error);
    throw new Error(`Failed to generate speech chunk ${index + 1}: ${error.response?.data?.detail || error.message}`);
  }
}

// Generate speech for all chunks in parallel with controlled concurrency
export async function generateChunkedSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  maxSentencesPerChunk: number = 2,
  maxConcurrency: number = 3
): Promise<ChunkedSpeechResponse> {
  try {
    const chunks = splitTextIntoChunks(text, maxSentencesPerChunk);
    console.log(`Split text into ${chunks.length} chunks:`, chunks.map(c => c.substring(0, 30) + '...'));

    const audioChunks: AudioChunk[] = [];
    
    // Process chunks in batches to avoid overwhelming the API
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const batch = chunks.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((chunkText, batchIndex) => 
        generateSpeechChunk(chunkText, voiceId, i + batchIndex)
      );
      
      console.log(`Processing batch ${Math.floor(i / maxConcurrency) + 1} with ${batch.length} chunks`);
      const batchResults = await Promise.all(batchPromises);
      audioChunks.push(...batchResults);
      
      // Small delay between batches to be respectful to the API
      if (i + maxConcurrency < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort chunks to ensure correct order
    audioChunks.sort((a, b) => a.index - b.index);

    console.log(`Generated ${audioChunks.length} audio chunks successfully`);

    return {
      chunks: audioChunks,
      totalChunks: audioChunks.length
    };
  } catch (error: any) {
    console.error('Chunked speech generation error:', error);
    throw new Error(`Failed to generate chunked speech: ${error.message}`);
  }
}

// Stream chunks as they become available (for real-time playback)
export async function* generateChunkedSpeechStream(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  maxSentencesPerChunk: number = 2
): AsyncGenerator<AudioChunk, void, unknown> {
  try {
    const chunks = splitTextIntoChunks(text, maxSentencesPerChunk);
    console.log(`Streaming ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      try {
        const audioChunk = await generateSpeechChunk(chunks[i], voiceId, i);
        console.log(`Yielding chunk ${i + 1}/${chunks.length}`);
        yield audioChunk;
      } catch (error) {
        console.error(`Error generating chunk ${i + 1}:`, error);
        // Continue with other chunks even if one fails
      }
    }
  } catch (error: any) {
    console.error('Chunked speech streaming error:', error);
    throw new Error(`Failed to stream chunked speech: ${error.message}`);
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
