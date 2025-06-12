import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Read system prompt from file
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'prompt.md');
    const promptContent = fs.readFileSync(promptPath, 'utf-8');
    // Remove markdown formatting and return clean text
    return promptContent
      .replace(/^#.*$/gm, '') // Remove headers
      .replace(/^-.*$/gm, '') // Remove bullet points
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\n\s*\n/g, '\n') // Remove extra line breaks
      .trim();
  } catch (error) {
    console.error('Error reading prompt.md:', error);
    // Fallback prompt
    return 'You are a helpful and friendly AI assistant with a warm, conversational personality. Keep responses natural and concise.';
  }
}

export async function generateChatResponse(messages: ChatMessage[]): Promise<string> {
  try {
    const systemPrompt = getSystemPrompt();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate chat response');
  }
}

// Simplified response function - no more automatic emotions
export async function generateResponse(messages: ChatMessage[]): Promise<string> {
  return generateChatResponse(messages);
} 