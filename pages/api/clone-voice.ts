import { NextApiRequest, NextApiResponse } from 'next';
import { cloneVoice } from '../../lib/voice-cloning';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      uploadDir: './tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    // Ensure tmp directory exists
    if (!fs.existsSync('./tmp')) {
      fs.mkdirSync('./tmp', { recursive: true });
    }

    const [fields, files] = await form.parse(req);
    
    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
    const removeBackgroundNoise = Array.isArray(fields.removeBackgroundNoise) 
      ? fields.removeBackgroundNoise[0] === 'true' 
      : fields.removeBackgroundNoise === 'true';

    if (!name) {
      return res.status(400).json({ error: 'Voice name is required' });
    }

    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Clone the voice
    const result = await cloneVoice({
      name,
      description: description || undefined,
      audioFilePath: audioFile.filepath,
      removeBackgroundNoise,
    });

    // Clean up uploaded file
    fs.unlinkSync(audioFile.filepath);

    res.status(200).json({
      success: true,
      voice_id: result.voice_id,
      requires_verification: result.requires_verification,
      message: 'Voice cloned successfully!',
    });

  } catch (error: any) {
    console.error('Voice cloning API error:', error);
    res.status(500).json({ 
      error: 'Failed to clone voice', 
      details: error.message 
    });
  }
} 