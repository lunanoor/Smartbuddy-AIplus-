const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export const getAIResponse = async (messages: ChatMessage[]): Promise<string> => {
    try {
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('REPLACE_WITH-YOUR-KEY')) {
            throw new Error('OpenRouter API key is missing or invalid. Please check your .env file and restart the dev server.');
        }

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://smartbuddy.ai',
                'X-Title': 'SmartBuddy',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: messages,
            }),
        });

        // Parse JSON first so we can read the error body if the request failed
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            // OpenRouter returns error details in data.error.message
            const reason = data?.error?.message || response.statusText || 'Unknown error';
            const hint =
                response.status === 401
                    ? ' — API key is invalid or expired. Update it in your Vercel environment variables.'
                    : response.status === 402
                    ? ' — Account has no credits. Top up your OpenRouter balance.'
                    : response.status === 429
                    ? ' — Rate limit hit. Try again in a moment.'
                    : '';
            throw new Error(`API Error ${response.status}: ${reason}${hint}`);
        }

        if (data?.choices && data.choices.length > 0) {
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