import type { NextApiRequest, NextApiResponse } from 'next';
import { generateResponse, ChatMessage } from '@/lib/openai';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        text: 'Hello! I\'m your AI avatar. The OpenAI API key needs to be configured for full functionality.'
      });
    }

    const text = await generateResponse(messages as ChatMessage[]);

    res.status(200).json({ text });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to generate response',
      text: `I apologize, but I encountered an error: ${errorMessage}. Please try again.`
    });
  }
} 