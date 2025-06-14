import type { NextApiRequest, NextApiResponse } from 'next';

// Simple test MP3 base64 data (very short silent audio)
const TEST_MP3_BASE64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//tQxAADwAABpAAAACAAANIAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7QMQzgwAAAaQAAAAgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/0QQzgwAAAaQAAAAgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== Test Speech API (No ElevenLabs) ===');
    
    const { text } = req.body;
    console.log('Text received:', text?.substring(0, 100));

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Return test audio data without calling ElevenLabs
    console.log('Returning test MP3 data');
    
    res.status(200).json({
      audioData: TEST_MP3_BASE64,
      mimeType: 'audio/mpeg',
      size: TEST_MP3_BASE64.length,
      message: 'Test audio - no ElevenLabs call made'
    });
    
  } catch (error: any) {
    console.error('Test speech error:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
}
