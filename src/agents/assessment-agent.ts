import { BaseAgent } from './base-agent';
import { AssessmentResponse, AgentContext, UserInput } from '../types';
import { agentSystemMessages } from '../config';

export class AssessmentAgent extends BaseAgent {
  constructor() {
    super(
      'assessment_agent',
      'Mental Health Assessment Specialist',
      agentSystemMessages.assessment
    );
  }

  async process(input: UserInput, context?: AgentContext): Promise<AssessmentResponse> {
    this.logger.info('Starting assessment process', {
      sessionId: context?.sessionId,
    });

    try {
      const aiResponse = await this.generateAIResponse(input, context);
      const parsedResponse = await this.parseAssessmentResponse(aiResponse);
      
      const response: AssessmentResponse = {
        ...this.createBaseResponse(
          parsedResponse.content || aiResponse,
          parsedResponse.recommendations || this.extractRecommendations(aiResponse),
          context
        ),
        emotionalAnalysis: {
          primaryEmotions: parsedResponse.emotionalAnalysis?.primaryEmotions || this.extractEmotions(aiResponse),
          intensity: parsedResponse.emotionalAnalysis?.intensity || this.assessIntensity(input),
          patterns: parsedResponse.emotionalAnalysis?.patterns || this.extractPatterns(aiResponse),
        },
        riskFactors: parsedResponse.riskFactors || this.identifyRiskFactors(input, aiResponse),
        protectiveFactors: parsedResponse.protectiveFactors || this.identifyProtectiveFactors(input, aiResponse),
        riskLevel: parsedResponse.riskLevel || this.determineRiskLevel(aiResponse),
      };

      this.logger.info('Assessment completed successfully', {
        sessionId: context?.sessionId,
        riskLevel: response.riskLevel,
        emotionsCount: response.emotionalAnalysis.primaryEmotions.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Assessment process failed', {
        sessionId: context?.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async parseAssessmentResponse(response: string): Promise<any> {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content,
        recommendations: parsed.recommendations,
        emotionalAnalysis: parsed.emotionalAnalysis,
        riskFactors: parsed.riskFactors,
        protectiveFactors: parsed.protectiveFactors,
        riskLevel: parsed.riskLevel,
      };
    } catch (error) {
      this.logger.warn('Failed to parse assessment response as JSON, using fallback parsing', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  private extractEmotions(content: string): string[] {
    const emotions = [
      'anxiety', 'depression', 'anger', 'fear', 'sadness', 'happiness', 
      'joy', 'excitement', 'worry', 'stress', 'calm', 'peaceful',
      'overwhelmed', 'hopeless', 'hopeful', 'confused', 'clear',
      'frustrated', 'satisfied', 'lonely', 'connected'
    ];

    const foundEmotions: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const emotion of emotions) {
      if (lowerContent.includes(emotion)) {
        foundEmotions.push(emotion);
      }
    }

    return foundEmotions.slice(0, 5); // Limit to 5 emotions
  }

  private assessIntensity(input: UserInput): number {
    // Base intensity on stress level and symptoms
    let intensity = input.stressLevel;

    // Adjust based on symptoms
    const highIntensitySymptoms = ['anxiety', 'depression', 'mood swings'];
    const mediumIntensitySymptoms = ['fatigue', 'insomnia', 'difficulty concentrating'];
    
    const highIntensityCount = input.currentSymptoms.filter(s => 
      highIntensitySymptoms.includes(s.toLowerCase())
    ).length;
    
    const mediumIntensityCount = input.currentSymptoms.filter(s => 
      mediumIntensitySymptoms.includes(s.toLowerCase())
    ).length;

    intensity += highIntensityCount * 1.5;
    intensity += mediumIntensityCount * 0.5;

    // Normalize to 1-10 scale
    return Math.min(10, Math.max(1, Math.round(intensity)));
  }

  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    const lowerContent = content.toLowerCase();

    // Look for common patterns
    if (lowerContent.includes('sleep') && lowerContent.includes('pattern')) {
      patterns.push('Sleep pattern disruption');
    }
    if (lowerContent.includes('stress') && lowerContent.includes('work')) {
      patterns.push('Work-related stress');
    }
    if (lowerContent.includes('social') && lowerContent.includes('withdrawal')) {
      patterns.push('Social withdrawal');
    }
    if (lowerContent.includes('mood') && lowerContent.includes('swing')) {
      patterns.push('Mood instability');
    }
    if (lowerContent.includes('anxiety') && lowerContent.includes('constant')) {
      patterns.push('Persistent anxiety');
    }

    return patterns;
  }

  private identifyRiskFactors(input: UserInput, content: string): string[] {
    const riskFactors: string[] = [];
    const lowerContent = content.toLowerCase();

    // Based on input
    if (input.stressLevel >= 8) {
      riskFactors.push('High stress level');
    }
    if (input.sleepPattern < 6) {
      riskFactors.push('Insufficient sleep');
    }
    if (input.supportSystem.length === 0) {
      riskFactors.push('Limited support system');
    }
    if (input.currentSymptoms.includes('Depression')) {
      riskFactors.push('Depressive symptoms');
    }
    if (input.currentSymptoms.includes('Anxiety')) {
      riskFactors.push('Anxiety symptoms');
    }

    // Based on content analysis
    if (lowerContent.includes('suicide') || lowerContent.includes('self-harm')) {
      riskFactors.push('Self-harm risk');
    }
    if (lowerContent.includes('isolation') || lowerContent.includes('lonely')) {
      riskFactors.push('Social isolation');
    }
    if (lowerContent.includes('hopeless') || lowerContent.includes('despair')) {
      riskFactors.push('Feelings of hopelessness');
    }

    return riskFactors;
  }

  private identifyProtectiveFactors(input: UserInput, content: string): string[] {
    const protectiveFactors: string[] = [];

    // Based on input
    if (input.supportSystem.includes('Family')) {
      protectiveFactors.push('Family support available');
    }
    if (input.supportSystem.includes('Friends')) {
      protectiveFactors.push('Friendship network');
    }
    if (input.supportSystem.includes('Therapist')) {
      protectiveFactors.push('Professional support');
    }
    if (input.sleepPattern >= 7) {
      protectiveFactors.push('Adequate sleep pattern');
    }
    if (input.stressLevel <= 5) {
      protectiveFactors.push('Moderate stress level');
    }

    // Based on content analysis
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('hope') || lowerContent.includes('positive')) {
      protectiveFactors.push('Positive outlook');
    }
    if (lowerContent.includes('coping') || lowerContent.includes('strategy')) {
      protectiveFactors.push('Coping strategies identified');
    }
    if (lowerContent.includes('support') || lowerContent.includes('help')) {
      protectiveFactors.push('Willingness to seek help');
    }

    return protectiveFactors;
  }
} 