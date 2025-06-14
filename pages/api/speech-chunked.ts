import type { NextApiRequest, NextApiResponse } from 'next';
import { generateChunkedSpeech, generateChunkedSpeechStream } from '@/lib/elevenlabs-chunked';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voiceId, streaming = false, maxSentencesPerChunk = 2 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`Processing ${streaming ? 'streaming' : 'batch'} chunked speech request:`, {
      textLength: text.length,
      maxSentencesPerChunk,
      textPreview: text.substring(0, 100) + '...'
    });

    if (streaming) {
      // Set up server-sent events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      try {
        let chunkIndex = 0;
        for await (const audioChunk of generateChunkedSpeechStream(text, voiceId, maxSentencesPerChunk)) {
          const base64Audio = Buffer.from(audioChunk.audioBuffer).toString('base64');
          
          const eventData = {
            chunk: chunkIndex,
            totalChunks: -1, // Unknown in streaming mode
            audioData: base64Audio,
            text: audioChunk.text,
            mimeType: 'audio/mpeg'
          };

          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          chunkIndex++;
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ complete: true, totalChunks: chunkIndex })}\n\n`);
        res.end();
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown streaming error';
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    } else {
      // Batch mode - generate all chunks and return them
      const speechData = await generateChunkedSpeech(text, voiceId, maxSentencesPerChunk);

      const response = {
        chunks: speechData.chunks.map(chunk => ({
          index: chunk.index,
          text: chunk.text,
          audioData: Buffer.from(chunk.audioBuffer).toString('base64'),
          mimeType: 'audio/mpeg'
        })),
        totalChunks: speechData.totalChunks,
        textLength: text.length
      };

      console.log(`Returning ${response.totalChunks} chunks in batch mode`);
      res.status(200).json(response);
    }
  } catch (error: any) {
    console.error('Chunked speech API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate chunked speech'
    });
  }
}
