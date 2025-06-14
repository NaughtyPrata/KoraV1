import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const gladiaKey = process.env.NEXT_PUBLIC_GLADIA_API_KEY;

  res.status(200).json({
    environment: 'production',
    timestamp: new Date().toISOString(),
    keys: {
      openai: {
        exists: !!openaiKey,
        length: openaiKey?.length || 0,
        prefix: openaiKey?.substring(0, 7) || 'none',
        valid_format: openaiKey?.startsWith('sk-') || false
      },
      elevenlabs: {
        exists: !!elevenLabsKey,
        length: elevenLabsKey?.length || 0,
        prefix: elevenLabsKey?.substring(0, 7) || 'none'
      },
      gladia: {
        exists: !!gladiaKey,
        length: gladiaKey?.length || 0,
        prefix: gladiaKey?.substring(0, 7) || 'none'
      }
    },
    vercel: {
      region: process.env.VERCEL_REGION,
      env: process.env.VERCEL_ENV
    }
  });
}
