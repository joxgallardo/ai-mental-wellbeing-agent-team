import { EnhancedBaseAgent } from './enhanced-base-agent';
import { AssessmentResponse, AgentContext, UserInput } from '../types/index';
import { agentSystemMessages } from '../config/index';

export class AssessmentAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'assessment_agent',
      'Mental Health Assessment Specialist',
      agentSystemMessages.assessment,
            {
        ragEnabled: true, 
        hybridSearchEnabled: true,
        focusArea: 'assessment'
      }
    );
  }

  /**
   * Customize RAG context for assessment-specific needs
   */
  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    return {
      ...ragContext,
      preferredCategories: ['assessment_tools', 'risk_evaluation', 'methodologies'],
      focusAreas: ['mental_health_assessment', 'risk_factors', 'protective_factors'],
      complexityLevel: 'intermediate',
      assessmentType: this.detectAssessmentType(input),
      riskLevel: this.determineInitialRiskLevel(input),
      emotionalContext: this.extractEmotionalContext(input),
    };
  }

  /**
   * Filter knowledge specifically for assessment role
   */
  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => {
      const content = result.content.toLowerCase();
      const category = result.document?.category || '';
      
      // Prioritize assessment-specific content
      return (
        category === 'assessment_tools' ||
        category === 'methodologies' ||
        content.includes('assessment') ||
        content.includes('evaluation') ||
        content.includes('risk') ||
        content.includes('screening') ||
        content.includes('protective factors') ||
        content.includes('mental health indicators') ||
        content.includes('emotional analysis')
      );
    }).slice(0, 8); // Limit to most relevant results
  }

  /**
   * Detect the type of assessment needed
   */
  private detectAssessmentType(input: UserInput): string {
    const content = input.mentalState.toLowerCase();
    const symptoms = input.currentSymptoms.map(s => s.toLowerCase());
    
    if (symptoms.some(s => s.includes('depression') || s.includes('mood'))) {
      return 'mood_assessment';
    }
    if (symptoms.some(s => s.includes('anxiety') || s.includes('panic'))) {
      return 'anxiety_assessment';
    }
    if (input.stressLevel >= 8) {
      return 'stress_assessment';
    }
    if (content.includes('trauma') || content.includes('ptsd')) {
      return 'trauma_assessment';
    }
    return 'general_assessment';
  }

  /**
   * Determine initial risk level for RAG context
   */
  private determineInitialRiskLevel(input: UserInput): string {
    const content = input.mentalState.toLowerCase();
    const riskIndicators = [
      'suicide', 'self-harm', 'kill myself', 'end it all',
      'hopeless', 'worthless', 'better off dead'
    ];
    
    if (riskIndicators.some(indicator => content.includes(indicator))) {
      return 'high';
    }
    if (input.stressLevel >= 8 || input.sleepPattern <= 4) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Extract emotional context for RAG enhancement
   */
  private extractEmotionalContext(input: UserInput): string[] {
    const emotions = this.extractEmotions(input.mentalState);
    const symptomsEmotions = input.currentSymptoms.flatMap(s => this.extractEmotions(s));
    return [...new Set([...emotions, ...symptomsEmotions])];
  }

  override async process(input: UserInput, context?: AgentContext): Promise<AssessmentResponse> {
    this.logger.info('Starting assessment process', {
      sessionId: context?.sessionId,
    });

    try {
      const aiResponse = await this.generateAIResponse(input, context);
      const parsedResponse = await this.parseAssessmentResponse(aiResponse);
      
      const response: AssessmentResponse = {
        ...this.createBaseResponse(
          parsedResponse.content || aiResponse,
          parsedResponse.recommendations || this.extractRecommendations(aiResponse)
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