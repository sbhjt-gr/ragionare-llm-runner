type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  thinking?: string;
  stats?: {
    duration: number;
    tokens: number;
  };
};

export interface ClaudeRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
}

export class ClaudeService {
  private apiKeyProvider: (provider: string) => Promise<string | null>;

  constructor(apiKeyProvider: (provider: string) => Promise<string | null>) {
    this.apiKeyProvider = apiKeyProvider;
  }

  async generateResponse(
    messages: ChatMessage[],
    options: ClaudeRequestOptions = {},
    onToken?: (token: string) => boolean | void
  ): Promise<{
    fullResponse: string;
    tokenCount: number;
    startTime: number;
  }> {
    const startTime = Date.now();
    let tokenCount = 0;
    let fullResponse = '';

    try {
      const apiKey = await this.apiKeyProvider('claude');
      if (!apiKey) {
        throw new Error('Claude API key not found. Please set it in Settings.');
      }

      const temperature = options.temperature ?? 0.7;
      const maxTokens = options.maxTokens ?? 1024;
      const topP = options.topP ?? 0.9;
      const model = options.model ?? 'claude-3-7-sonnet-20250219';
      console.log(`Using Claude model: ${model}`);

      let systemMessage: string | undefined;
      const userAssistantMessages = messages.filter(msg => {
        if (msg.role === 'system') {
          systemMessage = msg.content;
          return false;
        }
        return true;
      });

      const formattedMessages = userAssistantMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const requestBody: Record<string, any> = {
        model,
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
      };

      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      console.log(`Claude API request: ${formattedMessages.length} messages, ${systemMessage ? 'with' : 'without'} system message`);

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };

      console.log('Making request to Claude API...');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log(`Claude API response status: ${response.status}`);
      
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const jsonResponse = await response.json();
      console.log('Claude response received and parsed successfully');
      
      if (jsonResponse.content && jsonResponse.content.length > 0) {
        let text = '';
        
        for (const block of jsonResponse.content) {
          if (block.type === 'text' && block.text) {
            text += block.text;
          }
        }
        
        fullResponse = text;
        tokenCount = jsonResponse.usage?.output_tokens || text.split(/\s+/).length;
        
        if (onToken) {
          await this.simulateStreaming(text, onToken);
        }
        
        return {
          fullResponse: text,
          tokenCount,
          startTime
        };
      }
      
      console.error("Unexpected response format:", JSON.stringify(jsonResponse).substring(0, 200) + "...");
      throw new Error('Failed to extract content from Claude API response');
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorText = await response.text();
    console.error(`Claude API error (${response.status}): ${errorText}`);
    
    if (response.status === 429 || errorText.includes("quota") || errorText.includes("rate_limit")) {
      throw new Error("QUOTA_EXCEEDED: Your Claude API quota has been exceeded. Please try again later or upgrade your API plan.");
    }
    
    if (response.status === 400) {
      if (errorText.includes("invalid")) {
        throw new Error("INVALID_REQUEST: The request to Claude API was invalid. Please check your input and try again.");
      }
      if (errorText.includes("content_policy") || errorText.includes("filtered") || errorText.includes("harmful")) {
        throw new Error("CONTENT_FILTERED: Your request was filtered due to content policy violations.");
      }
      if (errorText.includes("context_length_exceeded") || errorText.includes("too long")) {
        throw new Error("CONTEXT_LENGTH_EXCEEDED: Your message is too long for the model's context window. Please shorten your input.");
      }
    }
    
    if (response.status === 401) {
      throw new Error("AUTHENTICATION_ERROR: Invalid API key or authentication error. Please check your API key in Settings.");
    }
    
    if (response.status === 403) {
      throw new Error("PERMISSION_DENIED: You don't have permission to access this model or feature.");
    }
    
    if (response.status === 404) {
      throw new Error("NOT_FOUND: The requested model or resource was not found. It may be deprecated or unavailable.");
    }
    
    if (response.status === 500 || response.status === 503) {
      throw new Error("SERVER_ERROR: Claude API is experiencing issues. Please try again later.");
    }
    
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  private async simulateStreaming(text: string, onToken: (token: string) => boolean | void): Promise<boolean> {
    const words = text.split(/(\s+|[,.!?;:"])/);
    let currentText = '';
    
    for (const word of words) {
      currentText += word;
      
      const shouldContinue = onToken(currentText);
      if (shouldContinue === false) {
        return false;
      }
      
      if (word.trim().length > 0) {
        if (/[.!?]/.test(word)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        else if (/[,;:]/.test(word)) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        else {
          const baseDelay = 25;
          const randomFactor = Math.random() * 20;
          await new Promise(resolve => setTimeout(resolve, baseDelay + randomFactor));
        }
      }
    }
    
    return true;
  }
} 