import type { NextApiRequest, NextApiResponse } from 'next';
import { testOpenAI } from '@/lib/test-openai';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== OpenAI Debug Test ===');
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('- OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('- OPENAI_API_KEY prefix:', process.env.OPENAI_API_KEY?.substring(0, 7));
    
    const result = await testOpenAI();
    
    res.status(200).json({ 
      success: true,
      response: result,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length || 0
    });
  } catch (error: any) {
    console.error('OpenAI test failed:', error);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      details: {
        status: error.status,
        code: error.code,
        type: error.type
      }
    });
  }
}
