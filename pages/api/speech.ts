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
    const { text, voiceId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const speechData = await generateSpeech(text, voiceId);

    // Return the audio buffer as base64 for client-side playback
    const base64Audio = Buffer.from(speechData.audioBuffer).toString('base64');

    res.status(200).json({
      audioData: base64Audio,
      mimeType: 'audio/mpeg'
    });
  } catch (error: any) {
    console.error('Speech API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate speech'
    });
  }
} 