/**
 * Mental Health LangGraph Workflow
 * 
 * Advanced workflow orchestration using LangGraph for enhanced mental health agent coordination.
 * Integrates RAG context, domain detection, and intelligent routing for optimal user experience.
 */

import { StateGraph, END, CompiledStateGraph } from '@langchain/langgraph';
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

  override detectComplexityLevel(input: UserInput): string {
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
    const stressLevel = input.stressLevel || 0;
    if (stressLevel >= 8) return 'immediate'; // 1-2 weeks
    if (stressLevel >= 6) return 'short_term'; // 1-2 months
    return 'medium_term'; // 3-6 months
  }
}

/**
 * Enhanced Follow-Up Agent for LangGraph
 */
class WorkflowFollowUpAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'WorkflowFollowUpAgent',
      'Follow-up and Support Specialist',
      `You are a follow-up and support specialist. Your role is to:
      1. Create comprehensive long-term support strategies
      2. Provide ongoing motivation and accountability systems
      3. Suggest resources, tools, and community support
      4. Plan check-ins and progress review schedules
      5. Ensure sustainable habit formation and maintenance`,
      { ragEnabled: true, hybridSearchEnabled: true, performanceMonitoring: true }
    );
  }

  protected override customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    const actionInsights = this.extractActionInsights(context);
    
    return {
      ...ragContext,
      preferredMethodology: 'Values Clarification',
      focusArea: 'long_term_support',
      supportType: this.detectSupportType(input),
      maintenanceStrategy: this.detectMaintenanceStrategy(input),
      actionInsights,
    };
  }

  protected override filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'best_practices' ||
      result.content.toLowerCase().includes('support') ||
      result.content.toLowerCase().includes('follow') ||
      result.content.toLowerCase().includes('maintain') ||
      result.content.toLowerCase().includes('habit') ||
      result.content.toLowerCase().includes('accountability')
    );
  }

  private extractActionInsights(context?: AgentContext): any {
    if (!context?.previousResponses || context.previousResponses.length < 2) return null;
    
    const actionResponse = context.previousResponses[1];
    if (!actionResponse) return null;
    
    return {
      plannedActions: this.extractPlannedActions(actionResponse.content),
      timeline: this.extractTimeline(actionResponse.content),
    };
  }

  private extractPlannedActions(content: string): string[] {
    // Extract action items from the action agent's response
    const actions = [];
    if (content.toLowerCase().includes('exercise')) actions.push('regular_exercise');
    if (content.toLowerCase().includes('meditation')) actions.push('mindfulness_practice');
    if (content.toLowerCase().includes('sleep')) actions.push('sleep_hygiene');
    if (content.toLowerCase().includes('boundary')) actions.push('boundary_setting');
    return actions;
  }

  private extractTimeline(content: string): string {
    if (content.toLowerCase().includes('week')) return 'weekly';
    if (content.toLowerCase().includes('month')) return 'monthly';
    return 'flexible';
  }

  private detectSupportType(input: UserInput): string {
    const supportSystem = input.supportSystem || [];
    if (supportSystem.length >= 3) return 'community_based';
    if (supportSystem.length >= 1) return 'relationship_based';
    return 'self_directed';
  }

  private detectMaintenanceStrategy(input: UserInput): string {
    const stressLevel = input.stressLevel || 0;
    if (stressLevel >= 8) return 'intensive_monitoring';
    if (stressLevel >= 6) return 'regular_checkins';
    return 'milestone_based';
  }
}

/**
 * Mental Health LangGraph Workflow
 */
export class MentalHealthWorkflow {
  private workflow: CompiledStateGraph<WorkflowState, Partial<WorkflowState>, "domainDetection" | "assessment" | "action" | "followUp" | "__end__">;
  private assessmentAgent = new WorkflowAssessmentAgent();
  private actionAgent = new WorkflowActionAgent();
  private followUpAgent = new WorkflowFollowUpAgent();

  constructor() {
    this.workflow = this.createWorkflow();
  }

  /**
   * Create the LangGraph workflow
   */
  private createWorkflow(): CompiledStateGraph<WorkflowState, Partial<WorkflowState>, "domainDetection" | "assessment" | "action" | "followUp" | "__end__"> {
    const workflow = new StateGraph<WorkflowState>({
      channels: {
        userInput: null,
        context: null,
        domainDetected: null,
        ragContext: null,
        knowledgeResults: null,
        assessmentResponse: null,
        actionResponse: null,
        followUpResponse: null,
        finalResponse: null,
        startTime: null,
        currentAgent: null,
        error: null,
        retryCount: null,
      },
    });

    // Add nodes
    workflow.addNode('initialize', this.initializeNode.bind(this));
    workflow.addNode('domain_detection', this.domainDetectionNode.bind(this));
    workflow.addNode('rag_context_building', this.ragContextBuildingNode.bind(this));
    workflow.addNode('enhanced_assessment', this.enhancedAssessmentNode.bind(this));
    workflow.addNode('enhanced_action', this.enhancedActionNode.bind(this));
    workflow.addNode('enhanced_followup', this.enhancedFollowUpNode.bind(this));
    workflow.addNode('response_synthesis', this.responseSynthesisNode.bind(this));
    workflow.addNode('error_handling', this.errorHandlingNode.bind(this));

    // Add edges
    workflow.setEntryPoint('initialize');
    
    workflow.addEdge('initialize', 'domain_detection');
    workflow.addEdge('domain_detection', 'rag_context_building');
    workflow.addEdge('rag_context_building', 'enhanced_assessment');
    workflow.addEdge('enhanced_assessment', 'enhanced_action');
    workflow.addEdge('enhanced_action', 'enhanced_followup');
    workflow.addEdge('enhanced_followup', 'response_synthesis');
    workflow.addEdge('response_synthesis', END);
    
    // Error handling edges
    workflow.addConditionalEdges('enhanced_assessment', this.checkForErrors, {
      'continue': 'enhanced_action',
      'error': 'error_handling',
    });
    
    workflow.addConditionalEdges('enhanced_action', this.checkForErrors, {
      'continue': 'enhanced_followup',
      'error': 'error_handling',
    });
    
    workflow.addConditionalEdges('enhanced_followup', this.checkForErrors, {
      'continue': 'response_synthesis',
      'error': 'error_handling',
    });
    
    workflow.addEdge('error_handling', 'response_synthesis');

    return workflow.compile();
  }

  /**
   * Initialize workflow state
   */
  private async initializeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Initializing mental health workflow', {
      sessionId: state.context?.sessionId,
      userId: state.context?.userId,
    });

    return {
      startTime: new Date(),
      currentAgent: 'initializing',
      retryCount: 0,
    };
  }

  /**
   * Detect domain for specialized processing
   */
  private async domainDetectionNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Detecting domain for specialized processing');

    // Analyze user input to determine domain
    const domain = this.detectDomain(state.userInput);
    
    return {
      domainDetected: domain,
      currentAgent: 'domain_detection',
    };
  }

  /**
   * Build RAG context for enhanced responses
   */
  private async ragContextBuildingNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Building RAG context');

    try {
      // Check if RAG is enabled
      const ragEnabled = ragFoundationService.isEnabled() && ragFoundationService.isReady();
      const featureEnabled = await featureFlagService.isEnabled('rag_enhancement', {
        userId: state.context?.userId,
        sessionId: state.context?.sessionId,
      });

      if (!ragEnabled || !featureEnabled) {
        return {
          ragContext: { enabled: false, reason: 'RAG not available' },
          currentAgent: 'rag_context_building',
        };
      }

      // Build comprehensive RAG context
      const ragContext = {
        enabled: true,
        domainId: state.domainDetected || 'life_coaching',
        sessionId: state.context?.sessionId,
        userId: state.context?.userId,
        userProfile: this.buildUserProfile(state.userInput),
        contextualFactors: this.extractContextualFactors(state.userInput),
        priorityAreas: this.identifyPriorityAreas(state.userInput),
      };

      return {
        ragContext,
        currentAgent: 'rag_context_building',
      };

    } catch (error) {
      logger.error('Error building RAG context', { error: error.message });
      return {
        ragContext: { enabled: false, reason: 'RAG context building failed' },
        currentAgent: 'rag_context_building',
      };
    }
  }

  /**
   * Enhanced assessment with RAG integration
   */
  private async enhancedAssessmentNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Performing enhanced assessment');

    try {
      const response = await this.assessmentAgent.process(state.userInput, state.context);
      
      return {
        assessmentResponse: response,
        currentAgent: 'enhanced_assessment',
      };

    } catch (error) {
      logger.error('Error in enhanced assessment', { error: error.message });
      return {
        error: `Assessment failed: ${error.message}`,
        currentAgent: 'enhanced_assessment',
      };
    }
  }

  /**
   * Enhanced action planning with RAG integration
   */
  private async enhancedActionNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Performing enhanced action planning');

    try {
      const actionContext = {
        ...state.context,
        previousResponses: [state.assessmentResponse!],
      };

      const response = await this.actionAgent.process(state.userInput, actionContext);
      
      return {
        actionResponse: response,
        currentAgent: 'enhanced_action',
      };

    } catch (error) {
      logger.error('Error in enhanced action planning', { error: error.message });
      return {
        error: `Action planning failed: ${error.message}`,
        currentAgent: 'enhanced_action',
      };
    }
  }

  /**
   * Enhanced follow-up planning with RAG integration
   */
  private async enhancedFollowUpNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Performing enhanced follow-up planning');

    try {
      const followUpContext = {
        ...state.context,
        previousResponses: [state.assessmentResponse!, state.actionResponse!],
      };

      const response = await this.followUpAgent.process(state.userInput, followUpContext);
      
      return {
        followUpResponse: response,
        currentAgent: 'enhanced_followup',
      };

    } catch (error) {
      logger.error('Error in enhanced follow-up planning', { error: error.message });
      return {
        error: `Follow-up planning failed: ${error.message}`,
        currentAgent: 'enhanced_followup',
      };
    }
  }

  /**
   * Synthesize final response
   */
  private async responseSynthesisNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.info('Synthesizing final response');

    const processingTime = state.startTime ? Date.now() - state.startTime.getTime() : 0;
    
    // Handle error case
    if (state.error || !state.assessmentResponse || !state.actionResponse || !state.followUpResponse) {
      const fallbackResponse = await this.generateFallbackResponse(state);
      return { finalResponse: fallbackResponse };
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(state);

    const finalResponse = {
      sessionId: state.context?.sessionId || 'unknown',
      assessment: state.assessmentResponse,
      action: state.actionResponse,
      followUp: state.followUpResponse,
      metadata: {
        workflowVersion: '1.0.0',
        ragEnabled: state.ragContext?.enabled || false,
        processingTime,
        qualityScore,
      },
    };

    logger.info('Workflow completed successfully', {
      sessionId: finalResponse.sessionId,
      processingTime,
      qualityScore,
      ragEnabled: finalResponse.metadata.ragEnabled,
    });

    return { finalResponse };
  }

  /**
   * Error handling node
   */
  private async errorHandlingNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    logger.error('Handling workflow error', { 
      error: state.error, 
      currentAgent: state.currentAgent,
      retryCount: state.retryCount,
    });

    const retryCount = (state.retryCount || 0) + 1;
    
    if (retryCount >= 3) {
      logger.error('Maximum retries reached, generating fallback response');
      const fallbackResponse = await this.generateFallbackResponse(state);
      return { 
        finalResponse: fallbackResponse,
        retryCount,
      };
    }

    // For now, proceed to synthesis with partial results
    return { 
      retryCount,
      error: undefined, // Clear error to proceed
    };
  }

  /**
   * Check for errors in agent responses
   */
  private checkForErrors(state: WorkflowState): string {
    return state.error ? 'error' : 'continue';
  }

  /**
   * Detect domain from user input
   */
  private detectDomain(userInput: UserInput): string {
    // Simple domain detection - in production, use more sophisticated NLP
    const content = (userInput.mentalState + ' ' + (userInput.currentSymptoms?.join(' ') || '')).toLowerCase();
    
    if (content.includes('career') || content.includes('work') || content.includes('job')) {
      return 'career_coaching';
    }
    if (content.includes('relationship') || content.includes('family') || content.includes('partner')) {
      return 'relationship_coaching';
    }
    if (content.includes('health') || content.includes('fitness') || content.includes('wellness')) {
      return 'wellness_coaching';
    }
    
    return 'life_coaching'; // Default domain
  }

  /**
   * Build user profile for RAG context
   */
  private buildUserProfile(userInput: UserInput): any {
    return {
      stressLevel: userInput.stressLevel,
      sleepPattern: userInput.sleepPattern,
      supportSystemSize: userInput.supportSystem?.length || 0,
      symptomsCount: userInput.currentSymptoms?.length || 0,
      hasRecentChanges: !!userInput.recentChanges,
    };
  }

  /**
   * Extract contextual factors
   */
  private extractContextualFactors(userInput: UserInput): string[] {
    const factors = [];
    
    if (userInput.stressLevel && userInput.stressLevel >= 7) factors.push('high_stress');
    if (userInput.sleepPattern && userInput.sleepPattern <= 5) factors.push('sleep_deprivation');
    if (userInput.supportSystem && userInput.supportSystem.length === 0) factors.push('limited_support');
    if (userInput.recentChanges) factors.push('recent_life_changes');
    
    return factors;
  }

  /**
   * Identify priority areas
   */
  private identifyPriorityAreas(userInput: UserInput): string[] {
    const priorities = [];
    
    if (userInput.stressLevel && userInput.stressLevel >= 8) priorities.push('stress_management');
    if (userInput.sleepPattern && userInput.sleepPattern <= 4) priorities.push('sleep_improvement');
    if (userInput.currentSymptoms?.includes('anxiety')) priorities.push('anxiety_reduction');
    if (userInput.mentalState.toLowerCase().includes('overwhelm')) priorities.push('workload_management');
    
    return priorities;
  }

  /**
   * Calculate quality score for the workflow results
   */
  private calculateQualityScore(state: WorkflowState): number {
    let score = 0.5; // Base score
    
    // Add points for RAG usage
    if (state.ragContext?.enabled) score += 0.2;
    
    // Add points for complete agent responses
    if (state.assessmentResponse?.ragMetadata?.useRag) score += 0.1;
    if (state.actionResponse?.ragMetadata?.useRag) score += 0.1;
    if (state.followUpResponse?.ragMetadata?.useRag) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Generate fallback response for error cases
   */
  private async generateFallbackResponse(state: WorkflowState): Promise<any> {
    return {
      sessionId: state.context?.sessionId || 'error-session',
      assessment: state.assessmentResponse || {
        agentName: 'FallbackAssessment',
        content: 'I understand you\'re seeking support. Due to technical issues, I\'m providing a basic response.',
        recommendations: ['Please try again in a few minutes', 'Consider speaking with a mental health professional'],
        timestamp: new Date(),
      },
      action: state.actionResponse || {
        agentName: 'FallbackAction',
        content: 'Here are some general immediate steps you can take while we resolve technical issues.',
        recommendations: ['Take deep breaths', 'Practice grounding techniques', 'Reach out to your support network'],
        timestamp: new Date(),
      },
      followUp: state.followUpResponse || {
        agentName: 'FallbackFollowUp',
        content: 'Please return to our service when it\'s fully available for comprehensive support.',
        recommendations: ['Check back in 30 minutes', 'Contact support if issues persist'],
        timestamp: new Date(),
      },
      metadata: {
        workflowVersion: '1.0.0-fallback',
        ragEnabled: false,
        processingTime: Date.now() - (state.startTime?.getTime() || Date.now()),
        qualityScore: 0.3,
        error: state.error || 'Unknown workflow error',
      },
    };
  }

  /**
   * Execute the workflow
   */
  async execute(userInput: UserInput, context?: AgentContext): Promise<any> {
    const initialState: WorkflowState = {
      userInput,
      context,
    };

    try {
      const result = await this.workflow.invoke(initialState);
      return result.finalResponse;
    } catch (error) {
      logger.error('Workflow execution failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

// Export singleton instance
export const mentalHealthWorkflow = new MentalHealthWorkflow();