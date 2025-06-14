import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gladiaKey = process.env.GLADIA_API_KEY;
  const nextPublicGladiaKey = process.env.NEXT_PUBLIC_GLADIA_API_KEY;

  console.log('Environment variables check:', {
    gladiaKey: !!gladiaKey,
    nextPublicGladiaKey: !!nextPublicGladiaKey,
    gladiaKeyLength: gladiaKey?.length || 0,
    nextPublicGladiaKeyLength: nextPublicGladiaKey?.length || 0
  });

  res.status(200).json({
    environment: 'production',
    timestamp: new Date().toISOString(),
    gladia: {
      server_key_exists: !!gladiaKey,
      client_key_exists: !!nextPublicGladiaKey,
      server_key_length: gladiaKey?.length || 0,
      client_key_length: nextPublicGladiaKey?.length || 0,
      server_key_prefix: gladiaKey?.substring(0, 10) || 'none',
      client_key_prefix: nextPublicGladiaKey?.substring(0, 10) || 'none',
      keys_match: gladiaKey === nextPublicGladiaKey
    }
  });
}
