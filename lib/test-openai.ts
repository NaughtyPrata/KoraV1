import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function testOpenAI() {
  try {
    console.log('Testing OpenAI API...');
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('API Key starts with:', process.env.OPENAI_API_KEY?.substring(0, 10));
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one word.' }
      ],
      max_tokens: 10,
      temperature: 0.7,
    });

    console.log('OpenAI Response:', completion.choices[0]?.message?.content);
    return completion.choices[0]?.message?.content || 'No response';
  } catch (error) {
    console.error('OpenAI Test Error:', error);
    throw error;
  }
}
