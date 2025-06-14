import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ElevenLabs Diagnostic ===');
    
    const apiKey = process.env.ELEVENLABS_API_KEY;
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ElevenLabs API key not found',
        hasKey: false
      });
    }

    // Test 1: Check API key validity by fetching user info
    console.log('Testing API key validity...');
    try {
      const userResponse = await axios.get('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 10000
      });
      
      console.log('User API response:', userResponse.status);
      
      // Test 2: Fetch available voices
      console.log('Fetching available voices...');
      const voicesResponse = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 10000
      });
      
      console.log('Voices API response:', voicesResponse.status);
      const voices = voicesResponse.data.voices || [];
      
      // Test 3: Try a simple TTS request
      console.log('Testing text-to-speech...');
      const testVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Rachel
      
      const ttsResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${testVoiceId}`,
        {
          text: 'Hello, this is a test.',
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );
      
      console.log('TTS response:', ttsResponse.status, 'Size:', ttsResponse.data.byteLength);
      
      res.status(200).json({
        success: true,
        message: 'All ElevenLabs tests passed!',
        results: {
          apiKeyValid: true,
          userInfo: {
            status: userResponse.status
          },
          voices: {
            count: voices.length,
            available: voices.slice(0, 3).map((v: any) => ({ name: v.name, voice_id: v.voice_id }))
          },
          tts: {
            status: ttsResponse.status,
            audioSize: ttsResponse.data.byteLength
          }
        }
      });
      
    } catch (apiError: any) {
      console.error('ElevenLabs API test failed:', apiError);
      
      res.status(500).json({
        success: false,
        error: 'ElevenLabs API test failed',
        details: {
          message: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        },
        hasKey: !!apiKey,
        keyLength: apiKey?.length || 0
      });
    }
    
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message
    });
  }
}
