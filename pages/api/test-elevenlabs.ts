import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ElevenLabs Simple Test ===');
    
    // Check environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key starts correctly:', apiKey?.startsWith('sk_') || 'unknown format');
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ElevenLabs API key not found',
        debug: {
          hasKey: false,
          keyLength: 0
        }
      });
    }

    // Test with a very simple request
    const testResponse = {
      success: true,
      message: 'ElevenLabs API key is configured',
      debug: {
        hasKey: !!apiKey,
        keyLength: apiKey.length,
        keyFormat: apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3)
      }
    };

    res.status(200).json(testResponse);
    
  } catch (error: any) {
    console.error('ElevenLabs test error:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
      debug: {
        hasKey: !!process.env.ELEVENLABS_API_KEY
      }
    });
  }
}
