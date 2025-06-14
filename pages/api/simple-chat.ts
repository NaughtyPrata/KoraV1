import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== SIMPLE CHAT TEST ===');
    console.log('Environment variables check:');
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-') || false);
    
    // Simple hardcoded test
    const testResponse = {
      text: "Hello! I'm KORA, your AI assistant. This is a simple test response to verify the API is working. If you're seeing this, the basic functionality is operational!"
    };
    
    console.log('Returning test response:', testResponse);
    res.status(200).json(testResponse);
    
  } catch (error: any) {
    console.error('Simple chat test error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      text: 'Simple test failed: ' + error.message
    });
  }
}
