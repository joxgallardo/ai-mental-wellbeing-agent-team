import { BaseAgent } from './base-agent';
import { ActionResponse, AgentContext, UserInput } from '../types/index';
import { agentSystemMessages, crisisResources } from '../config/index';

export class ActionAgent extends BaseAgent {
  constructor() {
    super(
      'action_agent',
      'Crisis Intervention and Resource Specialist',
      agentSystemMessages.action
    );
  }

  async process(input: UserInput, context?: AgentContext): Promise<ActionResponse> {
    this.logger.info('Starting action plan generation', {
      sessionId: context?.sessionId,
    });

    try {
      const aiResponse = await this.generateAIResponse(input, context);
      const parsedResponse = await this.parseActionResponse(aiResponse);
      
      const response: ActionResponse = {
        ...this.createBaseResponse(
          parsedResponse.content || aiResponse,
          parsedResponse.recommendations || this.extractRecommendations(aiResponse)
        ),
        immediateActions: parsedResponse.immediateActions || this.generateImmediateActions(input),
        resources: parsedResponse.resources || this.generateResources(input, aiResponse),
        urgency: parsedResponse.urgency || this.determineUrgency(aiResponse),
      };

      // Add crisis resources if high urgency
      if (response.urgency === 'high') {
        response.resources.unshift(...this.getCrisisResources());
      }

      this.logger.info('Action plan completed successfully', {
        sessionId: context?.sessionId,
        urgency: response.urgency,
        actionsCount: response.immediateActions.length,
        resourcesCount: response.resources.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Action plan generation failed', {
        sessionId: context?.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async parseActionResponse(response: string): Promise<any> {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content,
        recommendations: parsed.recommendations,
        immediateActions: parsed.immediateActions,
        resources: parsed.resources,
        urgency: parsed.urgency,
      };
    } catch (error) {
      this.logger.warn('Failed to parse action response as JSON, using fallback parsing', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  private generateImmediateActions(input: UserInput): ActionResponse['immediateActions'] {
    const actions: ActionResponse['immediateActions'] = [];

    // High stress level actions
    if (input.stressLevel >= 8) {
      actions.push({
        title: 'Deep Breathing Exercise',
        description: 'Take 5 deep breaths: inhale for 4 counts, hold for 4, exhale for 6',
        priority: 'high' as const,
        estimatedTime: '2 minutes',
      });
    }

    // Sleep-related actions
    if (input.sleepPattern < 6) {
      actions.push({
        title: 'Sleep Hygiene Practice',
        description: 'Create a calming bedtime routine and avoid screens 1 hour before sleep',
        priority: 'medium' as const,
        estimatedTime: '30 minutes',
      });
    }

    // Anxiety symptoms
    if (input.currentSymptoms.includes('Anxiety')) {
      actions.push({
        title: 'Grounding Technique',
        description: 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste',
        priority: 'high' as const,
        estimatedTime: '3 minutes',
      });
    }

    // Depression symptoms
    if (input.currentSymptoms.includes('Depression')) {
      actions.push({
        title: 'Small Achievement Goal',
        description: 'Set one small, achievable goal for today (e.g., take a shower, go for a 10-minute walk)',
        priority: 'medium' as const,
        estimatedTime: '15 minutes',
      });
    }

    // Limited support system
    if (input.supportSystem.length === 0) {
      actions.push({
        title: 'Reach Out to Someone',
        description: 'Send a text or call one person you trust, even if just to say hello',
        priority: 'medium' as const,
        estimatedTime: '5 minutes',
      });
    }

    // Add general wellness action
    actions.push({
      title: 'Hydration Check',
      description: 'Drink a glass of water and take a moment to check in with yourself',
      priority: 'low' as const,
      estimatedTime: '1 minute',
    });

    return actions.slice(0, 5); // Limit to 5 actions
  }

  private generateResources(_input: UserInput, _content: string): ActionResponse['resources'] {
    const resources: ActionResponse['resources'] = [];

    // Mental health apps
    resources.push({
      type: 'app' as const,
      name: 'Calm',
      description: 'Meditation and sleep app with guided sessions',
      url: 'https://www.calm.com',
    });

    resources.push({
      type: 'app' as const,
      name: 'Headspace',
      description: 'Mindfulness and meditation app',
      url: 'https://www.headspace.com',
    });

    // Online communities
    resources.push({
      type: 'community' as const,
      name: '7 Cups',
      description: 'Online therapy and peer support community',
      url: 'https://www.7cups.com',
    });

    // Educational resources
    resources.push({
      type: 'website' as const,
      name: 'MentalHealth.gov',
      description: 'Government resource for mental health information',
      url: 'https://www.mentalhealth.gov',
    });

    // Crisis resources (always include)
    resources.push(...this.getCrisisResources());

    return resources;
  }

  private getCrisisResources(): ActionResponse['resources'] {
    const resources: ActionResponse['resources'] = [];
    
    if (crisisResources.hotlines.length > 0) {
      resources.push({
        type: 'hotline' as const,
        name: crisisResources.hotlines[0]?.name || 'National Crisis Hotline',
        description: crisisResources.hotlines[0]?.description || '24/7 crisis support',
        phone: crisisResources.hotlines[0]?.phone || '988',
      });
    }
    
    if (crisisResources.hotlines.length > 1) {
      resources.push({
        type: 'hotline' as const,
        name: crisisResources.hotlines[1]?.name || 'Crisis Text Line',
        description: crisisResources.hotlines[1]?.description || 'Text-based crisis support',
        phone: crisisResources.hotlines[1]?.phone || '741741',
      });
    }
    
    return resources;
  }

  protected override determineUrgency(content: string): 'low' | 'medium' | 'high' {
    const lowerContent = content.toLowerCase();
    
    // High urgency indicators
    if (lowerContent.includes('suicide') || 
        lowerContent.includes('self-harm') || 
        lowerContent.includes('crisis') ||
        lowerContent.includes('emergency') ||
        lowerContent.includes('immediate')) {
      return 'high';
    }
    
    // Medium urgency indicators
    if (lowerContent.includes('severe') || 
        lowerContent.includes('intense') || 
        lowerContent.includes('overwhelming') ||
        lowerContent.includes('debilitating') ||
        lowerContent.includes('urgent')) {
      return 'medium';
    }
    
    return 'low';
  }
} 