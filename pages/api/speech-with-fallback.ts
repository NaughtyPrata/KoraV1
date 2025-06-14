import type { NextApiRequest, NextApiResponse } from 'next';
import { generateSpeech } from '@/lib/elevenlabs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== Speech API with Fallback ===');
    
    const { text, voiceId } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required and cannot be empty' });
    }

    console.log('Text length:', text.length);

    // Check if ElevenLabs API key is available
    if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.trim() === '') {
      console.log('ElevenLabs API key not found, using fallback');
      return res.status(200).json({ 
        error: 'ElevenLabs API key not configured',
        audioData: null,
        mimeType: 'audio/mpeg',
        fallback: true,
        message: 'Using browser text-to-speech fallback'
      });
    }

    try {
      console.log('Attempting ElevenLabs generation...');
      const speechData = await generateSpeech(text.trim(), voiceId);
      
      if (!speechData.audioBuffer || speechData.audioBuffer.byteLength === 0) {
        throw new Error('No audio data received from ElevenLabs');
      }

      const buffer = Buffer.from(speechData.audioBuffer);
      const base64Audio = buffer.toString('base64');

      if (!base64Audio || base64Audio.length === 0) {
        throw new Error('Failed to convert audio to base64');
      }

      console.log('ElevenLabs success:', {
        bufferSize: buffer.length,
        base64Length: base64Audio.length
      });

      res.status(200).json({
        audioData: base64Audio,
        mimeType: 'audio/mpeg',
        size: buffer.length,
        source: 'elevenlabs'
      });

    } catch (elevenLabsError: any) {
      console.error('ElevenLabs failed, using fallback:', elevenLabsError.message);
      
      // Return fallback response - client will use browser TTS
      res.status(200).json({
        audioData: null,
        mimeType: 'audio/mpeg',
        fallback: true,
        message: 'ElevenLabs failed, using browser text-to-speech',
        error: elevenLabsError.message
      });
    }
    
  } catch (error: any) {
    console.error('Speech API error:', error);
    
    res.status(500).json({ 
      error: error.message || 'Failed to generate speech',
      audioData: null,
      mimeType: 'audio/mpeg',
      fallback: true
    });
  }
}
