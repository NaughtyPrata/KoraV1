import type { NextApiRequest, NextApiResponse } from 'next';
import { getAvailableVoices, validateVoiceId } from '@/lib/elevenlabs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testVoiceId = 'Nq705LUoPRICK1U4GVme';
    
    // Check if API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        error: 'ElevenLabs API key not configured',
        apiKeyConfigured: false
      });
    }

    // Get available voices
    const voices = await getAvailableVoices();
    
    // Validate the specific voice ID
    const isValidVoice = await validateVoiceId(testVoiceId);
    
    res.status(200).json({
      apiKeyConfigured: true,
      totalVoices: voices.length,
      testVoiceId: testVoiceId,
      isValidVoice: isValidVoice,
      availableVoices: voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category
      }))
    });
  } catch (error: any) {
    console.error('Voice test error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to test voice configuration',
      details: error.response?.data
    });
  }
} 