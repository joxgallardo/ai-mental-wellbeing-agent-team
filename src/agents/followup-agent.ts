import { EnhancedBaseAgent } from './enhanced-base-agent';
import { FollowUpResponse, AgentContext, UserInput } from '../types/index';
import { agentSystemMessages } from '../config/index';

export class FollowUpAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'followup_agent',
      'Mental Health Recovery Planner',
      agentSystemMessages.followUp,
            {
        ragEnabled: true, 
        hybridSearchEnabled: true,
        focusArea: 'followup'
      }
    );
  }

  /**
   * Customize RAG context for follow-up and recovery planning
   */
  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    const recoveryStage = this.determineRecoveryStage(input, context);
    const planningTimeframe = this.determinePlanningTimeframe(input);
    
    return {
      ...ragContext,
      preferredCategories: ['best_practices', 'methodologies', 'long_term_strategies', 'monitoring'],
      focusAreas: ['recovery_planning', 'long_term_wellness', 'relapse_prevention', 'self_monitoring'],
      complexityLevel: 'intermediate',
      recoveryStage,
      planningTimeframe,
      timeframe: 'long_term',
      evidenceLevel: 'research-based',
      practiceArea: 'follow_up_care',
    };
  }

  /**
   * Filter knowledge specifically for follow-up and recovery role
   */
  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => {
      const content = result.content.toLowerCase();
      const category = result.document?.category || '';
      
      // Prioritize follow-up and recovery content
      return (
        category === 'best_practices' ||
        category === 'methodologies' ||
        category === 'long_term_strategies' ||
        content.includes('follow-up') ||
        content.includes('recovery') ||
        content.includes('long-term') ||
        content.includes('monitoring') ||
        content.includes('maintenance') ||
        content.includes('sustainability') ||
        content.includes('relapse prevention') ||
        content.includes('progress tracking') ||
        content.includes('self-care') ||
        content.includes('habit formation') ||
        content.includes('wellness plan')
      );
    }).slice(0, 8); // Focus on most relevant recovery strategies
  }

  /**
   * Determine recovery stage for contextualized planning
   */
  private determineRecoveryStage(input: UserInput, context?: AgentContext): string {
    const hasHistory = context?.previousResponses && context.previousResponses.length > 0;
    const stressLevel = input.stressLevel;
    const symptomsCount = input.currentSymptoms.length;
    
    if (!hasHistory && (stressLevel >= 8 || symptomsCount >= 4)) {
      return 'crisis_stabilization';
    }
    if (hasHistory && stressLevel >= 6) {
      return 'active_recovery';
    }
    if (stressLevel <= 5 && symptomsCount <= 2) {
      return 'maintenance';
    }
    return 'recovery_building';
  }

  /**
   * Determine appropriate planning timeframe
   */
  private determinePlanningTimeframe(input: UserInput): string {
    const stressLevel = input.stressLevel;
    const symptomsCount = input.currentSymptoms.length;
    
    if (stressLevel >= 8 || symptomsCount >= 4) {
      return 'short_term'; // 2-4 weeks
    }
    if (stressLevel >= 6 || symptomsCount >= 2) {
      return 'medium_term'; // 1-3 months
    }
    return 'long_term'; // 3-12 months
  }

  override async process(input: UserInput, context?: AgentContext): Promise<FollowUpResponse> {
    this.logger.info('Starting follow-up strategy generation', {
      sessionId: context?.sessionId,
    });

    try {
      const aiResponse = await this.generateAIResponse(input, context);
      const parsedResponse = await this.parseFollowUpResponse(aiResponse);
      
      const response: FollowUpResponse = {
        ...this.createBaseResponse(
          parsedResponse.content || aiResponse,
          parsedResponse.recommendations || this.extractRecommendations(aiResponse)
        ),
        longTermStrategies: parsedResponse.longTermStrategies || this.generateLongTermStrategies(input, aiResponse),
        monitoringPlan: parsedResponse.monitoringPlan || this.generateMonitoringPlan(input, aiResponse),
      };

      this.logger.info('Follow-up strategy completed successfully', {
        sessionId: context?.sessionId,
        strategiesCount: response.longTermStrategies.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Follow-up strategy generation failed', {
        sessionId: context?.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async parseFollowUpResponse(response: string): Promise<any> {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content,
        recommendations: parsed.recommendations,
        longTermStrategies: parsed.longTermStrategies,
        monitoringPlan: parsed.monitoringPlan,
      };
    } catch (error) {
      this.logger.warn('Failed to parse follow-up response as JSON, using fallback parsing', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  private generateLongTermStrategies(input: UserInput, _content: string): FollowUpResponse['longTermStrategies'] {
    const strategies: FollowUpResponse['longTermStrategies'] = [];

    // Sleep improvement strategy
    if (input.sleepPattern < 7) {
      strategies.push({
        category: 'Sleep Hygiene',
        strategies: [
          'Establish consistent bedtime routine',
          'Create a sleep-conducive environment',
          'Limit caffeine and screen time before bed',
          'Practice relaxation techniques',
          'Consider sleep tracking to identify patterns'
        ],
        timeline: '2-4 weeks',
      });
    }

    // Stress management strategy
    if (input.stressLevel >= 7) {
      strategies.push({
        category: 'Stress Management',
        strategies: [
          'Learn and practice mindfulness meditation',
          'Develop healthy coping mechanisms',
          'Set boundaries in work and personal life',
          'Engage in regular physical activity',
          'Consider stress management workshops'
        ],
        timeline: '1-3 months',
      });
    }

    // Social support strategy
    if (input.supportSystem.length < 2) {
      strategies.push({
        category: 'Social Support',
        strategies: [
          'Join support groups or communities',
          'Reconnect with old friends',
          'Participate in group activities or hobbies',
          'Consider therapy or counseling',
          'Build relationships with colleagues or neighbors'
        ],
        timeline: '3-6 months',
      });
    }

    // Mental health maintenance strategy
    strategies.push({
      category: 'Mental Health Maintenance',
      strategies: [
        'Regular self-assessment and mood tracking',
        'Develop a self-care routine',
        'Learn about mental health and wellness',
        'Practice gratitude and positive thinking',
        'Maintain work-life balance'
      ],
      timeline: 'Ongoing',
    });

    // Symptom-specific strategies
    if (input.currentSymptoms.includes('Anxiety')) {
      strategies.push({
        category: 'Anxiety Management',
        strategies: [
          'Learn breathing and grounding techniques',
          'Identify and challenge anxious thoughts',
          'Gradual exposure to anxiety triggers',
          'Consider cognitive behavioral therapy (CBT)',
          'Practice progressive muscle relaxation'
        ],
        timeline: '2-6 months',
      });
    }

    if (input.currentSymptoms.includes('Depression')) {
      strategies.push({
        category: 'Depression Recovery',
        strategies: [
          'Establish daily routines and structure',
          'Set small, achievable goals',
          'Engage in activities that bring joy',
          'Consider professional therapy',
          'Build a support network'
        ],
        timeline: '3-12 months',
      });
    }

    return strategies.slice(0, 6); // Limit to 6 strategies
  }

  private generateMonitoringPlan(input: UserInput, _content: string): FollowUpResponse['monitoringPlan'] {
    const monitoringPlan: FollowUpResponse['monitoringPlan'] = {
      frequency: this.determineMonitoringFrequency(input),
      metrics: this.generateMetrics(input),
      checkInQuestions: this.generateCheckInQuestions(input),
    };

    return monitoringPlan;
  }

  private determineMonitoringFrequency(input: UserInput): string {
    // High risk or high stress = more frequent monitoring
    if (input.stressLevel >= 8 || input.currentSymptoms.includes('Depression')) {
      return 'daily';
    }
    
    if (input.stressLevel >= 6 || input.currentSymptoms.length >= 3) {
      return 'every 2-3 days';
    }
    
    return 'weekly';
  }

  private generateMetrics(input: UserInput): string[] {
    const metrics: string[] = [
      'Mood level (1-10 scale)',
      'Stress level (1-10 scale)',
      'Sleep quality (1-10 scale)',
      'Energy level (1-10 scale)',
    ];

    // Add symptom-specific metrics
    if (input.currentSymptoms.includes('Anxiety')) {
      metrics.push('Anxiety intensity (1-10 scale)');
      metrics.push('Number of anxiety episodes');
    }

    if (input.currentSymptoms.includes('Depression')) {
      metrics.push('Depression severity (1-10 scale)');
      metrics.push('Interest in activities (1-10 scale)');
    }

    if (input.sleepPattern < 7) {
      metrics.push('Hours of sleep');
      metrics.push('Sleep quality rating');
    }

    return metrics;
  }

  private generateCheckInQuestions(input: UserInput): string[] {
    const questions: string[] = [
      'How are you feeling today overall?',
      'What was the highlight of your day?',
      'What was the most challenging part of your day?',
      'Did you practice any self-care activities?',
      'How well did you sleep last night?',
    ];

    // Add symptom-specific questions
    if (input.currentSymptoms.includes('Anxiety')) {
      questions.push('Did you experience any anxiety today? If so, what triggered it?');
      questions.push('What coping strategies did you use?');
    }

    if (input.currentSymptoms.includes('Depression')) {
      questions.push('Did you accomplish any goals today, no matter how small?');
      questions.push('What brought you a moment of joy or satisfaction?');
    }

    if (input.supportSystem.length === 0) {
      questions.push('Did you connect with anyone today?');
      questions.push('How can you reach out to someone tomorrow?');
    }

    return questions.slice(0, 8); // Limit to 8 questions
  }
} 