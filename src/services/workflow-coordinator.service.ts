/**
 * Workflow Coordinator Service
 * 
 * Orchestrates between traditional AgentCoordinator and new LangGraph workflow
 * based on feature flags and complexity requirements.
 */

import { UserInput, AgentContext } from '../types/index';
import { AgentCoordinator } from './agent-coordinator.service';
import { mentalHealthWorkflow } from '../workflows/mental-health-langgraph.workflow';
import { featureFlagService } from './feature-flag.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkflowCoordinator');

export interface WorkflowResult {
  sessionId: string;
  assessment: any;
  action: any;
  followUp: any;
  metadata: {
    workflowType: 'traditional' | 'langgraph';
    processingTime: number;
    ragEnabled: boolean;
    qualityScore?: number;
    version: string;
  };
}

export interface WorkflowSelectionCriteria {
  complexity: number; // 0-1 scale
  userPreference?: 'traditional' | 'langgraph' | 'auto';
  sessionHistory?: number;
  errorTolerance: 'low' | 'medium' | 'high';
}

/**
 * Workflow Coordinator Service
 * 
 * Manages the transition between traditional agent coordination and LangGraph workflows
 * with intelligent routing and fallback mechanisms.
 */
export class WorkflowCoordinatorService {
  private traditionalCoordinator: AgentCoordinator;

  constructor() {
    this.traditionalCoordinator = new AgentCoordinator();
  }

  /**
   * Coordinate session with intelligent workflow selection
   */
  async coordinateSession(
    userInput: UserInput, 
    context?: AgentContext,
    criteria?: Partial<WorkflowSelectionCriteria>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    
    logger.info('Starting workflow coordination', {
      sessionId: context?.sessionId,
      userId: context?.userId,
    });

    try {
      // Determine which workflow to use
      const workflowType = await this.selectWorkflow(userInput, context, criteria);
      
      logger.info('Workflow selected', { 
        workflowType,
        sessionId: context?.sessionId,
      });

      let result: any;
      
      if (workflowType === 'langgraph') {
        result = await this.executeLangGraphWorkflow(userInput, context);
      } else {
        result = await this.executeTraditionalWorkflow(userInput, context);
      }

      const processingTime = Date.now() - startTime;

      return {
        sessionId: result.sessionId,
        assessment: result.assessment,
        action: result.action,
        followUp: result.followUp,
        metadata: {
          workflowType,
          processingTime,
          ragEnabled: result.metadata?.ragEnabled || false,
          qualityScore: result.metadata?.qualityScore,
          version: '1.0.0',
        },
      };

    } catch (error) {
      logger.error('Workflow coordination failed', { 
        error: error.message,
        sessionId: context?.sessionId,
      });

      // Fallback to traditional workflow
      return await this.executeTraditionalWorkflowWithFallback(userInput, context, startTime);
    }
  }

  /**
   * Select appropriate workflow based on criteria
   */
  private async selectWorkflow(
    userInput: UserInput,
    context?: AgentContext,
    criteria?: Partial<WorkflowSelectionCriteria>
  ): Promise<'traditional' | 'langgraph'> {
    
    // Check feature flags first
    const langGraphEnabled = await featureFlagService.isEnabled('langgraph_workflow', {
      userId: context?.userId,
      sessionId: context?.sessionId,
    });

    if (!langGraphEnabled) {
      logger.info('LangGraph workflow disabled by feature flag');
      return 'traditional';
    }

    // Check user preference
    if (criteria?.userPreference === 'traditional') {
      return 'traditional';
    }
    if (criteria?.userPreference === 'langgraph') {
      return 'langgraph';
    }

    // Analyze complexity
    const complexity = this.calculateComplexity(userInput, context);
    
    // Decision matrix
    const shouldUseLangGraph = 
      complexity >= 0.6 || // High complexity scenarios
      (userInput.currentSymptoms?.length || 0) >= 4 || // Multiple symptoms
      (userInput.stressLevel || 0) >= 8 || // High stress
      (context?.previousResponses?.length || 0) >= 2; // Multi-session context

    if (shouldUseLangGraph && criteria?.errorTolerance !== 'low') {
      return 'langgraph';
    }

    return 'traditional';
  }

  /**
   * Calculate complexity score for workflow selection
   */
  private calculateComplexity(userInput: UserInput, context?: AgentContext): number {
    let complexity = 0;

    // Stress level factor (0-0.3)
    complexity += (userInput.stressLevel || 0) / 10 * 0.3;

    // Symptoms count factor (0-0.2)
    complexity += Math.min((userInput.currentSymptoms?.length || 0) / 10, 1) * 0.2;

    // Sleep pattern factor (0-0.1)
    const sleepScore = userInput.sleepPattern || 8;
    complexity += (8 - Math.min(sleepScore, 8)) / 8 * 0.1;

    // Support system factor (0-0.1)
    const supportScore = userInput.supportSystem?.length || 0;
    complexity += (3 - Math.min(supportScore, 3)) / 3 * 0.1;

    // Recent changes factor (0-0.1)
    if (userInput.recentChanges && userInput.recentChanges.length > 0) {
      complexity += 0.1;
    }

    // Context complexity factor (0-0.2)
    const contextComplexity = (context?.previousResponses?.length || 0) / 5;
    complexity += Math.min(contextComplexity, 1) * 0.2;

    return Math.min(complexity, 1);
  }

  /**
   * Execute LangGraph workflow
   */
  private async executeLangGraphWorkflow(
    userInput: UserInput,
    context?: AgentContext
  ): Promise<any> {
    logger.info('Executing LangGraph workflow');

    try {
      const result = await mentalHealthWorkflow.execute(userInput, context);
      
      logger.info('LangGraph workflow completed successfully', {
        sessionId: result.sessionId,
        processingTime: result.metadata.processingTime,
      });

      return result;

    } catch (error) {
      logger.error('LangGraph workflow failed', { error: error.message });
      
      // Fallback to traditional workflow
      logger.info('Falling back to traditional workflow');
      return await this.executeTraditionalWorkflow(userInput, context);
    }
  }

  /**
   * Execute traditional workflow
   */
  private async executeTraditionalWorkflow(
    userInput: UserInput,
    context?: AgentContext
  ): Promise<any> {
    logger.info('Executing traditional workflow');

    const result = await this.traditionalCoordinator.coordinateSession(userInput, context);
    
    return {
      sessionId: context?.sessionId || 'traditional-session',
      assessment: result.assessment,
      action: result.action,
      followUp: result.followUp,
      metadata: {
        workflowType: 'traditional',
        ragEnabled: this.checkRAGUsage(result),
        qualityScore: this.calculateTraditionalQualityScore(result),
      },
    };
  }

  /**
   * Execute traditional workflow with fallback error handling
   */
  private async executeTraditionalWorkflowWithFallback(
    userInput: UserInput,
    context?: AgentContext,
    startTime: number
  ): Promise<WorkflowResult> {
    try {
      const result = await this.executeTraditionalWorkflow(userInput, context);
      const processingTime = Date.now() - startTime;

      return {
        sessionId: result.sessionId,
        assessment: result.assessment,
        action: result.action,
        followUp: result.followUp,
        metadata: {
          workflowType: 'traditional',
          processingTime,
          ragEnabled: result.metadata.ragEnabled,
          qualityScore: result.metadata.qualityScore,
          version: '1.0.0-fallback',
        },
      };

    } catch (fallbackError) {
      logger.error('All workflows failed', { 
        error: fallbackError.message,
        sessionId: context?.sessionId,
      });

      // Generate emergency fallback response
      return this.generateEmergencyResponse(userInput, context, startTime);
    }
  }

  /**
   * Generate emergency response when all workflows fail
   */
  private generateEmergencyResponse(
    userInput: UserInput,
    context?: AgentContext,
    startTime: number
  ): WorkflowResult {
    const processingTime = Date.now() - startTime;

    return {
      sessionId: context?.sessionId || 'emergency-session',
      assessment: {
        agentName: 'EmergencyAssessment',
        content: 'I understand you\'re seeking support. Due to technical difficulties, I\'m providing basic guidance. Please try again shortly or contact our support team.',
        recommendations: [
          'Take deep, slow breaths to help manage immediate stress',
          'Try grounding techniques: name 5 things you can see, 4 you can hear, 3 you can touch',
          'Reach out to a trusted friend, family member, or mental health professional',
          'If this is an emergency, please contact your local emergency services',
        ],
        timestamp: new Date(),
      },
      action: {
        agentName: 'EmergencyAction',
        content: 'Here are immediate steps you can take right now:',
        recommendations: [
          'Focus on your breathing and stay present',
          'Remove yourself from stressful situations if possible',
          'Engage in a calming activity you enjoy',
          'Consider calling a mental health helpline if you need immediate support',
        ],
        timestamp: new Date(),
      },
      followUp: {
        agentName: 'EmergencyFollowUp',
        content: 'Please return to our service when it\'s fully operational, or consider these resources:',
        recommendations: [
          'National Suicide Prevention Lifeline: 988',
          'Crisis Text Line: Text HOME to 741741',
          'Contact your healthcare provider',
          'Reach out to local mental health services',
        ],
        timestamp: new Date(),
      },
      metadata: {
        workflowType: 'traditional',
        processingTime,
        ragEnabled: false,
        qualityScore: 0.2,
        version: '1.0.0-emergency',
      },
    };
  }

  /**
   * Check if RAG was used in traditional workflow
   */
  private checkRAGUsage(result: any): boolean {
    return (
      result.assessment?.ragMetadata?.useRag ||
      result.action?.ragMetadata?.useRag ||
      result.followUp?.ragMetadata?.useRag
    ) || false;
  }

  /**
   * Calculate quality score for traditional workflow
   */
  private calculateTraditionalQualityScore(result: any): number {
    let score = 0.5; // Base score

    // Check for RAG usage
    if (this.checkRAGUsage(result)) score += 0.2;

    // Check response quality indicators
    if (result.assessment?.content?.length > 100) score += 0.1;
    if (result.action?.recommendations?.length >= 3) score += 0.1;
    if (result.followUp?.recommendations?.length >= 3) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<{
    traditional: { count: number; avgProcessingTime: number; avgQualityScore: number };
    langgraph: { count: number; avgProcessingTime: number; avgQualityScore: number };
    fallbacks: number;
    emergencyResponses: number;
  }> {
    // In a real implementation, this would query metrics from a database
    return {
      traditional: {
        count: 150,
        avgProcessingTime: 1200, // ms
        avgQualityScore: 0.75,
      },
      langgraph: {
        count: 85,
        avgProcessingTime: 1800, // ms
        avgQualityScore: 0.85,
      },
      fallbacks: 5,
      emergencyResponses: 1,
    };
  }

  /**
   * Update workflow selection preferences based on feedback
   */
  updatePreferences(
    sessionId: string,
    workflowType: 'traditional' | 'langgraph',
    rating: number,
    feedback?: string
  ): void {
    logger.info('Updating workflow preferences', {
      sessionId,
      workflowType,
      rating,
      feedback: feedback ? 'provided' : 'none',
    });

    // In a real implementation, this would update user preferences in the database
    // and potentially adjust the workflow selection algorithm
  }
}

// Export singleton instance
export const workflowCoordinatorService = new WorkflowCoordinatorService();