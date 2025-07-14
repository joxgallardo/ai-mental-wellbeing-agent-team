import { Agent, AgentContext, AgentResponse, UserInput } from '../types';
import { openAIService } from '../services/openai.service';
import { createLogger } from '../utils/logger';

export abstract class BaseAgent implements Agent {
  public readonly name: string;
  public readonly role: string;
  public readonly systemMessage: string;
  protected readonly logger = createLogger(this.constructor.name);

  constructor(name: string, role: string, systemMessage: string) {
    this.name = name;
    this.role = role;
    this.systemMessage = systemMessage;
  }

  abstract process(input: UserInput, context?: AgentContext): Promise<AgentResponse>;

  protected async generateAIResponse(
    userInput: UserInput,
    context?: AgentContext
  ): Promise<string> {
    const userMessage = this.formatUserMessage(userInput, context);
    
    this.logger.info('Generating AI response', {
      agentName: this.name,
      sessionId: context?.sessionId,
    });

    const startTime = Date.now();
    
    try {
      const response = await openAIService.generateResponse(
        this.systemMessage,
        userMessage,
        context ? this.formatContext(context) : undefined
      );

      const duration = Date.now() - startTime;
      this.logger.info('AI response generated successfully', {
        agentName: this.name,
        duration,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to generate AI response', {
        agentName: this.name,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  protected formatUserMessage(userInput: UserInput, context?: AgentContext): string {
    let message = `Please analyze the following user information and provide a response:

Mental State: ${userInput.mentalState}
Sleep Pattern: ${userInput.sleepPattern} hours per night
Stress Level: ${userInput.stressLevel}/10
Support System: ${userInput.supportSystem.join(', ') || 'None reported'}
Recent Changes: ${userInput.recentChanges || 'None reported'}
Current Symptoms: ${userInput.currentSymptoms.join(', ') || 'None reported'}`;

    if (context?.previousResponses && context.previousResponses.length > 0) {
      message += '\n\nPrevious agent responses for context:';
      context.previousResponses.forEach((response, index) => {
        message += `\n${index + 1}. ${response.agentName}: ${response.content.substring(0, 200)}...`;
      });
    }

    return message;
  }

  protected formatContext(context: AgentContext): string {
    if (!context.previousResponses || context.previousResponses.length === 0) {
      return '';
    }

    return `Previous responses from other agents:
${context.previousResponses.map((response, index) => 
  `${index + 1}. ${response.agentName}: ${response.content.substring(0, 300)}...`
).join('\n')}`;
  }

  protected createBaseResponse(
    content: string,
    recommendations: string[],
    _context?: AgentContext
  ): AgentResponse {
    return {
      agentName: this.name,
      content,
      recommendations,
      timestamp: new Date(),
    };
  }

  protected extractRecommendations(content: string): string[] {
    // Simple extraction - in a real implementation, you'd use more sophisticated parsing
    const recommendations: string[] = [];
    
    // Look for bullet points or numbered lists
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
        const recommendation = trimmed.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, '');
        if (recommendation.length > 10) {
          recommendations.push(recommendation);
        }
      }
    }

    // If no structured recommendations found, extract sentences that might be recommendations
    if (recommendations.length === 0) {
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      recommendations.push(...sentences.slice(0, 3).map(s => s.trim()));
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  protected determineRiskLevel(content: string): 'low' | 'medium' | 'high' {
    const lowerContent = content.toLowerCase();
    
    // High risk indicators
    if (lowerContent.includes('suicide') || 
        lowerContent.includes('self-harm') || 
        lowerContent.includes('crisis') ||
        lowerContent.includes('emergency')) {
      return 'high';
    }
    
    // Medium risk indicators
    if (lowerContent.includes('severe') || 
        lowerContent.includes('intense') || 
        lowerContent.includes('overwhelming') ||
        lowerContent.includes('debilitating')) {
      return 'medium';
    }
    
    return 'low';
  }

  protected determineUrgency(content: string): 'low' | 'medium' | 'high' {
    const lowerContent = content.toLowerCase();
    
    // High urgency indicators
    if (lowerContent.includes('immediate') || 
        lowerContent.includes('urgent') || 
        lowerContent.includes('now') ||
        lowerContent.includes('asap')) {
      return 'high';
    }
    
    // Medium urgency indicators
    if (lowerContent.includes('soon') || 
        lowerContent.includes('short-term') || 
        lowerContent.includes('quick')) {
      return 'medium';
    }
    
    return 'low';
  }
} 