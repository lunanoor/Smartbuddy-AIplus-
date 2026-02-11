const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export const getAIResponse = async (messages: ChatMessage[]): Promise<string> => {
    try {
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('REPLACE_WITH-YOUR-KEY')) {
            const e = new Error('OpenRouter API key is missing or invalid. Please check your .env file and restart the dev server.');
            console.error('AI Service Config Error:', e);
            throw e;
        }
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://smartbuddy.ai', // Optional
                'X-Title': 'SmartBuddy', // Optional
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001', // Fast and reliable
                messages: messages,
            }),
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            console.error('Unexpected AI API Response:', data);
            throw new Error('AI API returned an empty or unexpected response.');
        }
    } catch (error) {
        console.error('AI Chat Error:', error);
        throw error;
    }
};

export const generateSummary = async (text: string): Promise<string> => {
    const prompt: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are an expert academic assistant. Summarize the following document text into a concise, professional paragraph that captures the core thesis and key findings.',
        },
        {
            role: 'user',
            content: text.slice(0, 10000), // Limit context for summary
        },
    ];

    return getAIResponse(prompt);
};
