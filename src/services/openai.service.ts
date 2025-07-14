import OpenAI from 'openai';
import { config } from '../config';
import { AgentError } from '../types';
import { logger } from '../utils/logger';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: config.timeout,
    });
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    context?: string
  ): Promise<string> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemMessage,
        },
      ];

      if (context) {
        messages.push({
          role: 'user',
          content: `Context: ${context}\n\nUser Input: ${userMessage}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: userMessage,
        });
      }

      const completion = await this.client.chat.completions.create({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: "json_object" },
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new AgentError(
          'No response received from OpenAI',
          'openai',
          'NO_RESPONSE'
        );
      }

      logger.info('OpenAI response generated successfully', {
        model: config.model,
        tokens: completion.usage?.total_tokens,
      });

      return response;
    } catch (error) {
      logger.error('OpenAI API error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        systemMessage: systemMessage.substring(0, 100) + '...',
      });

      if (error instanceof OpenAI.APIError) {
        throw new AgentError(
          `OpenAI API error: ${error.message}`,
          'openai',
          error.code || 'API_ERROR',
          { status: error.status, type: error.type }
        );
      }

      throw new AgentError(
        'Failed to generate response from OpenAI',
        'openai',
        'GENERATION_FAILED',
        { originalError: error }
      );
    }
  }

  async parseJsonResponse(response: string): Promise<any> {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse JSON response', {
        response: response.substring(0, 200) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new AgentError(
        'Invalid JSON response from AI agent',
        'openai',
        'INVALID_JSON',
        { response: response.substring(0, 200) }
      );
    }
  }

  async validateResponse(response: any, expectedSchema: any): Promise<boolean> {
    try {
      // Basic validation - in a real implementation, you'd use a schema validation library
      if (!response || typeof response !== 'object') {
        return false;
      }

      // Check for required fields based on schema
      const requiredFields = Object.keys(expectedSchema);
      for (const field of requiredFields) {
        if (!(field in response)) {
          logger.warn(`Missing required field in response: ${field}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Response validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async retryWithFallback(
    systemMessage: string,
    userMessage: string,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateResponse(systemMessage, userMessage);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`OpenAI attempt ${attempt} failed`, {
          attempt,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // If all retries failed, throw the last error
    throw lastError || new Error('All retry attempts failed');
  }
}

// Export singleton instance
export const openAIService = new OpenAIService(); 