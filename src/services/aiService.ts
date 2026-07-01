const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const FREE_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-4-31b-it:free',
    'qwen/qwen3-coder:free',
    'openrouter/free'
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getAIResponse = async (messages: ChatMessage[]): Promise<string> => {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === '' || OPENROUTER_API_KEY.includes('REPLACE_WITH-YOUR-KEY') || OPENROUTER_API_KEY.includes('your_api_key_here')) {
        throw new Error('OpenRouter API key is missing or invalid. Please check your .env or .env.local file and restart the dev server.');
    }

    const errors: string[] = [];

    for (let i = 0; i < FREE_MODELS.length; i++) {
        const model = FREE_MODELS[i];
        const attempts = 2; // 1 initial attempt + 1 retry

        for (let attempt = 1; attempt <= attempts; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            try {
                const response = await fetch(OPENROUTER_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                let data: any = null;
                try {
                    data = await response.json();
                } catch (jsonErr) {
                    throw new Error(`Failed to parse response JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
                }

                if (!response.ok) {
                    const apiErrorMessage = data?.error?.message || data?.error || response.statusText || 'Unknown error';
                    const fullErrorMsg = `API Error ${response.status}: ${apiErrorMessage}`;

                    const isTemporary = response.status === 429 || response.status >= 500;
                    if (isTemporary && attempt < attempts) {
                        console.warn(`Temporary error (${fullErrorMsg}) on model ${model}. Retrying in 1s...`);
                        await delay(1000);
                        continue;
                    }

                    throw new Error(fullErrorMsg);
                }

                if (data?.error) {
                    const embeddedErrorMsg = data.error.message || JSON.stringify(data.error);
                    throw new Error(`API Error (200 OK): ${embeddedErrorMsg}`);
                }

                if (!data) {
                    throw new Error('API returned null or undefined response.');
                }

                if (!data.choices) {
                    throw new Error('API response does not contain choices field.');
                }

                if (!Array.isArray(data.choices)) {
                    throw new Error('API choices field is not an array.');
                }

                if (data.choices.length === 0) {
                    throw new Error('API choices array is empty.');
                }

                const firstChoice = data.choices[0];
                if (!firstChoice.message) {
                    throw new Error('API choice does not contain message field.');
                }

                if (typeof firstChoice.message.content !== 'string') {
                    throw new Error('API message content is not a string.');
                }

                return firstChoice.message.content;

            } catch (error: any) {
                clearTimeout(timeoutId);

                let isTimeoutOrNetwork = false;
                let message = '';

                if (error.name === 'AbortError') {
                    message = 'Request timed out after 30 seconds';
                    isTimeoutOrNetwork = true;
                } else {
                    message = error.message || String(error);
                    if (error instanceof TypeError) {
                        isTimeoutOrNetwork = true;
                    }
                }

                if (isTimeoutOrNetwork && attempt < attempts) {
                    console.warn(`Temporary connection error (${message}) on model ${model}. Retrying in 1s...`);
                    await delay(1000);
                    continue;
                }

                errors.push(`Model ${model} failed: ${message}`);
                break;
            }
        }
    }

    throw new Error(`All available free models failed. Details:\n${errors.join('\n')}`);
};

export const generateSummary = async (text: string): Promise<string> => {
    const prompt: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are an expert academic assistant. Summarize the following document text into a concise, professional paragraph that captures the core thesis and key findings.',
        },
        {
            role: 'user',
            content: text.slice(0, 10000),
        },
    ];

    return getAIResponse(prompt);
};