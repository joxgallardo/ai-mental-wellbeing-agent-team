/**
 * Mental Health LangGraph Workflow
 * 
 * Advanced workflow orchestration using LangGraph for enhanced mental health agent coordination.
 * Integrates RAG context, domain detection, and intelligent routing for optimal user experience.
 */

import { UserInput, AgentContext, AgentResponse } from '../types/index';
import { EnhancedBaseAgent } from '../agents/enhanced-base-agent';
import { ragFoundationService } from '../services/rag/rag-foundation.service';
import { featureFlagService } from '../services/feature-flag.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('MentalHealthWorkflow');

/**
 * Workflow State Interface
 */
export interface WorkflowState {
  // Input
  userInput: UserInput;
  context?: AgentContext;
  
  // Processing state
  domainDetected?: string;
  ragContext?: any;
  knowledgeResults?: any[];
  
  // Agent responses
  assessmentResponse?: AgentResponse;
  actionResponse?: AgentResponse;
  followUpResponse?: AgentResponse;
  
  // Output
  finalResponse?: {
    sessionId: string;
    assessment: AgentResponse;
    action: AgentResponse;
    followUp: AgentResponse;
    metadata: {
      workflowVersion: string;
      ragEnabled: boolean;
      processingTime: number;
      qualityScore?: number;
    };
  };
  
  // Workflow metadata
  startTime?: Date;
  currentAgent?: string;
  error?: string;
  retryCount?: number;
}

/**
 * Enhanced Assessment Agent for LangGraph
 */
class WorkflowAssessmentAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'WorkflowAssessmentAgent',
      'Mental Health Assessment Specialist',
      `You are a mental health assessment specialist. Your role is to:
      1. Evaluate the user's current mental state comprehensively
      2. Identify key concerns, patterns, and risk factors
      3. Provide evidence-based initial recommendations
      4. Determine appropriate next steps for action planning
      5. Use available knowledge base to enhance assessment accuracy`,
      { ragEnabled: true, hybridSearchEnabled: true, performanceMonitoring: true }
    );
  }

  override async process(input: UserInput, context?: AgentContext): Promise<AgentResponse> {
    return await this.processStandard(input, context);
  }

  protected override customizeRAGContext(ragContext: any, input: UserInput, _context?: AgentContext): any {
    return {
      ...ragContext,
      preferredMethodology: 'Life Wheel Assessment',
      focusArea: 'comprehensive_assessment',
      complexityLevel: this.detectComplexityLevel(input),
      urgencyLevel: this.detectUrgencyLevel(input),
    };
  }

  protected override filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'assessment_tools' ||
      result.document.category === 'methodologies' ||
      result.content.toLowerCase().includes('assessment') ||
      result.content.toLowerCase().includes('evaluation')
    );
  }

  override detectComplexityLevel(input: UserInput): 'beginner' | 'intermediate' | 'advanced' {
    const symptoms = input.currentSymptoms?.length || 0;
    const stressLevel = input.stressLevel || 0;
    
    if (symptoms >= 5 || stressLevel >= 8) return 'advanced';
    if (symptoms >= 3 || stressLevel >= 6) return 'intermediate';
    return 'beginner';
  }

  private detectUrgencyLevel(input: UserInput): string {
    const stressLevel = input.stressLevel || 0;
    const sleepPattern = input.sleepPattern || 8;
    
    if (stressLevel >= 9 || sleepPattern <= 3) return 'high';
    if (stressLevel >= 7 || sleepPattern <= 5) return 'medium';
    return 'low';
  }
}

/**
 * Enhanced Action Agent for LangGraph
 */
class WorkflowActionAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'WorkflowActionAgent',
      'Action Planning Specialist',
      `You are an action planning specialist. Your role is to:
      1. Create specific, actionable plans based on assessment findings
      2. Provide SMART goals and measurable steps
      3. Consider user's capabilities, constraints, and preferences
      4. Set realistic timelines and milestones
      5. Integrate evidence-based interventions from knowledge base`,
      { ragEnabled: true, hybridSearchEnabled: true, performanceMonitoring: true }
    );
  }

  override async process(input: UserInput, context?: AgentContext): Promise<AgentResponse> {
    return await this.processStandard(input, context);
  }

  protected override customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    // Extract insights from assessment if available
    const assessmentInsights = this.extractAssessmentInsights(context);
    
    return {
      ...ragContext,
      preferredMethodology: 'GROW Model',
      focusArea: 'action_planning',
      goalType: this.detectGoalType(input),
      timeframe: this.detectTimeframe(input),
      assessmentInsights,
    };
  }

  protected override filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'best_practices' ||
      result.document.category === 'methodologies' ||
      result.content.toLowerCase().includes('action') ||
      result.content.toLowerCase().includes('goal') ||
      result.content.toLowerCase().includes('plan')
    );
  }

  private extractAssessmentInsights(context?: AgentContext): any {
    if (!context?.previousResponses?.length) return null;
    
    const assessmentResponse = context.previousResponses[0];
    if (!assessmentResponse) return null;
    
    return {
      mainConcerns: this.extractMainConcerns(assessmentResponse.content),
      recommendedFocus: this.extractRecommendedFocus(assessmentResponse.recommendations),
    };
  }

  private extractMainConcerns(content: string): string[] {
    // Simple extraction logic - in production, use more sophisticated NLP
    const concerns = [];
    if (content.toLowerCase().includes('stress')) concerns.push('stress_management');
    if (content.toLowerCase().includes('anxiety')) concerns.push('anxiety_reduction');
    if (content.toLowerCase().includes('sleep')) concerns.push('sleep_improvement');
    if (content.toLowerCase().includes('work')) concerns.push('work_life_balance');
    return concerns;
  }

  private extractRecommendedFocus(recommendations: string[]): string[] {
    return recommendations.map(rec => rec.toLowerCase().replace(/[^a-z\s]/g, ''))
      .filter(rec => rec.length > 5);
  }

  private detectGoalType(input: UserInput): string {
    if (input.mentalState.toLowerCase().includes('career') || input.mentalState.toLowerCase().includes('work')) {
      return 'career';
    }
    if (input.mentalState.toLowerCase().includes('relationship')) {
      return 'relationship';
    }
    if (input.mentalState.toLowerCase().includes('health')) {
      return 'health';
    }
    return 'personal_growth';
  }

  private detectTimeframe(input: UserInput): string {
    if (input.mentalState.toLowerCase().includes('urgent') || input.mentalState.toLowerCase().includes('immediate')) {
      return 'immediate';
    }
    if (input.mentalState.toLowerCase().includes('short') || input.mentalState.toLowerCase().includes('week')) {
      return 'short_term';
    }
    if (input.mentalState.toLowerCase().includes('long') || input.mentalState.toLowerCase().includes('month')) {
      return 'long_term';
    }
    return 'medium_term';
  }
}

/**
 * Enhanced Follow-Up Agent for LangGraph
 */
class WorkflowFollowUpAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'WorkflowFollowUpAgent',
      'Follow-Up Planning Specialist',
      `You are a follow-up planning specialist. Your role is to:
      1. Create sustainable long-term strategies for mental wellness
      2. Design maintenance and prevention plans
      3. Establish support systems and accountability mechanisms
      4. Provide relapse prevention strategies
      5. Integrate ongoing monitoring and adjustment recommendations`,
      { ragEnabled: true, hybridSearchEnabled: true, performanceMonitoring: true }
    );
  }

  override async process(input: UserInput, context?: AgentContext): Promise<AgentResponse> {
    return await this.processStandard(input, context);
  }

  protected override customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    // Extract insights from previous responses
    const actionInsights = this.extractActionInsights(context);
    
    return {
      ...ragContext,
      preferredMethodology: 'Maintenance Planning',
      focusArea: 'follow_up_planning',
      supportType: this.detectSupportType(input),
      maintenanceStrategy: this.detectMaintenanceStrategy(input),
      actionInsights,
    };
  }

  protected override filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'resources' ||
      result.document.category === 'templates' ||
      result.content.toLowerCase().includes('maintenance') ||
      result.content.toLowerCase().includes('follow') ||
      result.content.toLowerCase().includes('support')
    );
  }

  private extractActionInsights(context?: AgentContext): any {
    if (!context?.previousResponses?.length) return null;
    
    const actionResponse = context.previousResponses[1]; // Second response is action
    if (!actionResponse) return null;
    
    return {
      plannedActions: this.extractPlannedActions(actionResponse.content),
      timeline: this.extractTimeline(actionResponse.content),
    };
  }

  private extractPlannedActions(content: string): string[] {
    // Simple extraction - in production, use more sophisticated parsing
    const actions = [];
    if (content.toLowerCase().includes('exercise')) actions.push('physical_activity');
    if (content.toLowerCase().includes('meditation')) actions.push('mindfulness_practice');
    if (content.toLowerCase().includes('therapy')) actions.push('professional_support');
    if (content.toLowerCase().includes('journal')) actions.push('self_reflection');
    return actions;
  }

  private extractTimeline(content: string): string {
    if (content.toLowerCase().includes('daily')) return 'daily';
    if (content.toLowerCase().includes('weekly')) return 'weekly';
    if (content.toLowerCase().includes('monthly')) return 'monthly';
    return 'flexible';
  }

  private detectSupportType(input: UserInput): string {
    const supportSystem = input.supportSystem || [];
    if (supportSystem.includes('professional')) return 'professional';
    if (supportSystem.includes('family')) return 'family';
    if (supportSystem.includes('friends')) return 'peer';
    return 'self_directed';
  }

  private detectMaintenanceStrategy(input: UserInput): string {
    if (input.mentalState.toLowerCase().includes('prevent')) return 'preventive';
    if (input.mentalState.toLowerCase().includes('maintain')) return 'maintenance';
    if (input.mentalState.toLowerCase().includes('improve')) return 'improvement';
    return 'balanced';
  }
}

/**
 * Simplified Mental Health Workflow
 * 
 * Note: This is a simplified version that doesn't use LangGraph's complex state management.
 * For production use, consider implementing a proper state machine or workflow engine.
 */
export class MentalHealthWorkflow {
  private assessmentAgent = new WorkflowAssessmentAgent();
  private actionAgent = new WorkflowActionAgent();
  private followUpAgent = new WorkflowFollowUpAgent();

  constructor() {
    logger.info('Mental Health Workflow initialized');
  }

  /**
   * Execute the complete mental health workflow
   */
  async execute(userInput: UserInput, context?: AgentContext): Promise<any> {
    const startTime = new Date();
    logger.info('Starting mental health workflow', {
      sessionId: context?.sessionId,
      userId: context?.userId,
    });

    try {
      // Step 1: Detect domain
      const domainDetected = this.detectDomain(userInput);
      logger.info('Domain detected', { domain: domainDetected });

      // Step 2: Build RAG context
      const ragContext = await this.buildRAGContext(userInput, context, domainDetected);
      logger.info('RAG context built', { enabled: ragContext.enabled });

      // Step 3: Assessment
      const assessmentResponse = await this.assessmentAgent.process(userInput, context);
      logger.info('Assessment completed');

      // Step 4: Action planning
      const actionContext = {
        ...context,
        sessionId: context?.sessionId || 'default-session',
        previousResponses: [assessmentResponse],
      };
      const actionResponse = await this.actionAgent.process(userInput, actionContext);
      logger.info('Action planning completed');

      // Step 5: Follow-up planning
      const followUpContext = {
        ...context,
        sessionId: context?.sessionId || 'default-session',
        previousResponses: [assessmentResponse, actionResponse],
      };
      const followUpResponse = await this.followUpAgent.process(userInput, followUpContext);
      logger.info('Follow-up planning completed');

      // Step 6: Synthesize final response
      const processingTime = Date.now() - startTime.getTime();
      const qualityScore = this.calculateQualityScore({
        assessmentResponse,
        actionResponse,
        followUpResponse,
        ragContext,
      });

      const finalResponse = {
        sessionId: context?.sessionId || 'unknown',
        assessment: assessmentResponse,
        action: actionResponse,
        followUp: followUpResponse,
        metadata: {
          workflowVersion: '1.0.0',
          ragEnabled: ragContext.enabled,
          processingTime,
          qualityScore,
          domainDetected,
        },
      };

      logger.info('Workflow completed successfully', {
        sessionId: finalResponse.sessionId,
        processingTime,
        qualityScore,
      });

      return finalResponse;

    } catch (error) {
      logger.error('Workflow execution failed', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: context?.sessionId,
      });

      // Return fallback response
      return await this.generateFallbackResponse(userInput, context, error);
    }
  }

  /**
   * Detect domain for specialized processing
   */
  private detectDomain(userInput: UserInput): string {
    const content = userInput.mentalState.toLowerCase();
    
    if (content.includes('career') || content.includes('job') || content.includes('work')) {
      return 'career_coaching';
    }
    if (content.includes('relationship') || content.includes('partner') || content.includes('communication')) {
      return 'relationship_coaching';
    }
    if (content.includes('health') || content.includes('fitness') || content.includes('wellness')) {
      return 'wellness_coaching';
    }
    
    return 'life_coaching'; // Default domain
  }

  /**
   * Build RAG context for enhanced responses
   */
  private async buildRAGContext(userInput: UserInput, context?: AgentContext, domainDetected?: string): Promise<any> {
    try {
      // Check if RAG is enabled
      const ragEnabled = ragFoundationService.isEnabled() && ragFoundationService.isReady();
      const featureEnabled = await featureFlagService.isEnabled('rag_enhancement', {
        userId: context?.userId,
        sessionId: context?.sessionId,
      });

      if (!ragEnabled || !featureEnabled) {
        return { enabled: false, reason: 'RAG not available' };
      }

      // Build comprehensive RAG context
      return {
        enabled: true,
        domainId: domainDetected || 'life_coaching',
        sessionId: context?.sessionId,
        userId: context?.userId,
        userProfile: this.buildUserProfile(userInput),
        contextualFactors: this.extractContextualFactors(userInput),
        priorityAreas: this.identifyPriorityAreas(userInput),
      };

    } catch (error) {
      logger.error('Error building RAG context', { error: error instanceof Error ? error.message : String(error) });
      return { enabled: false, reason: 'RAG context building failed' };
    }
  }

  /**
   * Build user profile from input
   */
  private buildUserProfile(userInput: UserInput): any {
    return {
      stressLevel: userInput.stressLevel,
      sleepPattern: userInput.sleepPattern,
      supportSystem: userInput.supportSystem,
      currentSymptoms: userInput.currentSymptoms,
      recentChanges: userInput.recentChanges,
    };
  }

  /**
   * Extract contextual factors from user input
   */
  private extractContextualFactors(userInput: UserInput): string[] {
    const factors = [];
    
    if (userInput.stressLevel && userInput.stressLevel > 7) factors.push('high_stress');
    if (userInput.sleepPattern && userInput.sleepPattern < 6) factors.push('sleep_issues');
    if (userInput.supportSystem && userInput.supportSystem.length === 0) factors.push('limited_support');
    if (userInput.currentSymptoms && userInput.currentSymptoms.length > 3) factors.push('multiple_symptoms');
    
    return factors;
  }

  /**
   * Identify priority areas for intervention
   */
  private identifyPriorityAreas(userInput: UserInput): string[] {
    const areas = [];
    
    if (userInput.stressLevel && userInput.stressLevel > 8) areas.push('stress_management');
    if (userInput.sleepPattern && userInput.sleepPattern < 5) areas.push('sleep_improvement');
    if (userInput.currentSymptoms?.includes('anxiety')) areas.push('anxiety_reduction');
    if (userInput.currentSymptoms?.includes('depression')) areas.push('mood_improvement');
    
    return areas;
  }

  /**
   * Calculate quality score for the workflow response
   */
  private calculateQualityScore(state: {
    assessmentResponse: AgentResponse;
    actionResponse: AgentResponse;
    followUpResponse: AgentResponse;
    ragContext: any;
  }): number {
    let score = 0.5; // Base score

    // Content quality checks
    if (state.assessmentResponse.content.length > 100) score += 0.1;
    if (state.actionResponse.content.length > 100) score += 0.1;
    if (state.followUpResponse.content.length > 100) score += 0.1;

    // RAG enhancement bonus
    if (state.ragContext.enabled) score += 0.2;

    // Recommendation quality
    if (state.assessmentResponse.recommendations.length > 0) score += 0.1;
    if (state.actionResponse.recommendations.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Generate fallback response when workflow fails
   */
  private async generateFallbackResponse(userInput: UserInput, context?: AgentContext, error?: any): Promise<any> {
    logger.warn('Generating fallback response', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: context?.sessionId,
    });

    const fallbackAssessment = {
      content: 'I understand you\'re going through a challenging time. Let me help you assess your current situation and provide some initial guidance.',
      recommendations: ['Consider speaking with a mental health professional', 'Practice self-care activities', 'Reach out to your support network'],
      confidence: 0.7,
      metadata: { fallback: true },
    };

    const fallbackAction = {
      content: 'Based on your situation, I recommend starting with small, manageable steps to improve your mental wellbeing.',
      recommendations: ['Start with 5-10 minutes of daily meditation', 'Establish a regular sleep schedule', 'Engage in physical activity you enjoy'],
      confidence: 0.6,
      metadata: { fallback: true },
    };

    const fallbackFollowUp = {
      content: 'Remember that progress takes time and it\'s okay to seek professional help when needed.',
      recommendations: ['Monitor your progress regularly', 'Adjust strategies as needed', 'Don\'t hesitate to seek professional support'],
      confidence: 0.5,
      metadata: { fallback: true },
    };

    return {
      sessionId: context?.sessionId || 'unknown',
      assessment: fallbackAssessment,
      action: fallbackAction,
      followUp: fallbackFollowUp,
      metadata: {
        workflowVersion: '1.0.0',
        ragEnabled: false,
        processingTime: 0,
        qualityScore: 0.3,
        error: error instanceof Error ? error.message : String(error),
        fallback: true,
      },
    };
  }
}