import { AssessmentAgent } from '../agents/assessment-agent';
import { ActionAgent } from '../agents/action-agent';
import { FollowUpAgent } from '../agents/followup-agent';
import { 
  UserInput, 
  AssessmentResponse, 
  ActionResponse, 
  FollowUpResponse, 
  MentalHealthPlan,
  AgentError 
} from '../types/index';
import { createLogger } from '../utils/logger';
import { UserInputSchema } from '../types/index';
import { ragFoundationService } from './rag/rag-foundation.service';
import { featureFlagService } from './feature-flag.service';

export class AgentCoordinatorService {
  private readonly assessmentAgent: AssessmentAgent;
  private readonly actionAgent: ActionAgent;
  private readonly followUpAgent: FollowUpAgent;
  private readonly logger = createLogger('AgentCoordinator');

  constructor() {
    this.assessmentAgent = new AssessmentAgent();
    this.actionAgent = new ActionAgent();
    this.followUpAgent = new FollowUpAgent();
  }

  async generateMentalHealthPlan(
    userInput: UserInput,
    sessionId: string
  ): Promise<MentalHealthPlan> {
    this.logger.info('Starting RAG-enhanced mental health plan generation', { 
      sessionId,
      ragEnabled: await this.isRAGEnabled(),
      ragReady: ragFoundationService.isReady()
    });

    try {
      // Validate user input
      const validatedInput = UserInputSchema.parse(userInput);

      // Check RAG system status for enhanced context
      const ragStatus = await this.checkRAGStatus();
      
      // Step 1: Assessment with RAG enhancement
      this.logger.info('Starting RAG-enhanced assessment phase', { sessionId, ragStatus });
      const assessment = await this.assessmentAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
        ragContext: {
          domainId: 'life_coaching',
          sessionHistory: [],
          userPreferences: this.extractUserPreferences(validatedInput),
        }
      });

      // Step 2: Action Plan with context from assessment
      this.logger.info('Starting RAG-enhanced action plan phase', { sessionId });
      const actionPlan = await this.actionAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
        previousResponses: [assessment],
        ragContext: {
          domainId: 'life_coaching',
          assessmentInsights: this.extractAssessmentInsights(assessment),
          urgencyLevel: assessment.riskLevel,
        }
      });

      // Step 3: Follow-up Strategy with comprehensive context
      this.logger.info('Starting RAG-enhanced follow-up strategy phase', { sessionId });
      const followUp = await this.followUpAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
        previousResponses: [assessment, actionPlan],
        ragContext: {
          domainId: 'life_coaching',
          recoveryStage: this.determineRecoveryStage(assessment, actionPlan),
          planningTimeframe: actionPlan.urgency === 'high' ? 'short_term' : 'medium_term',
        }
      });

      // Generate enhanced summary with RAG insights
      const summary = this.generateEnhancedSummary(assessment, actionPlan, followUp, ragStatus);

      const mentalHealthPlan: MentalHealthPlan = {
        sessionId,
        assessment,
        actionPlan,
        followUp,
        summary,
        metadata: {
          ragEnabled: ragStatus.enabled,
          ragQuality: ragStatus.ready ? 'high' : 'degraded',
          processingTime: Date.now(),
          agentVersions: {
            assessment: 'enhanced-v1',
            action: 'enhanced-v1',
            followUp: 'enhanced-v1'
          }
        }
      };

      this.logger.info('RAG-enhanced mental health plan generated successfully', {
        sessionId,
        riskLevel: assessment.riskLevel,
        urgency: actionPlan.urgency,
        strategiesCount: followUp.longTermStrategies.length,
        ragEnabled: ragStatus.enabled,
        ragQuality: ragStatus.ready ? 'high' : 'degraded'
      });

      return mentalHealthPlan;
    } catch (error) {
      this.logger.error('Failed to generate mental health plan', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof AgentError) {
        throw error;
      }

      throw new AgentError(
        'Failed to coordinate agent workflow',
        'coordinator',
        'COORDINATION_FAILED',
        { originalError: error }
      );
    }
  }

  private generateSummary(
    assessment: AssessmentResponse,
    actionPlan: ActionResponse,
    followUp: FollowUpResponse
  ): MentalHealthPlan['summary'] {
    const keyInsights: string[] = [];
    const immediateNextSteps: string[] = [];
    const longTermGoals: string[] = [];

    // Extract key insights from assessment
    if (assessment.riskLevel === 'high') {
      keyInsights.push('High risk level identified - immediate support recommended');
    }
    if (assessment.emotionalAnalysis.primaryEmotions.length > 0) {
      keyInsights.push(`Primary emotions: ${assessment.emotionalAnalysis.primaryEmotions.join(', ')}`);
    }
    if (assessment.riskFactors.length > 0) {
      keyInsights.push(`Key risk factors: ${assessment.riskFactors.slice(0, 3).join(', ')}`);
    }

    // Extract immediate next steps from action plan
    if (actionPlan.urgency === 'high') {
      immediateNextSteps.push('Immediate action required - consider crisis resources');
    }
    actionPlan.immediateActions
      .filter(action => action.priority === 'high')
      .slice(0, 3)
      .forEach(action => {
        immediateNextSteps.push(action.title);
      });

    // Extract long-term goals from follow-up
    followUp.longTermStrategies
      .slice(0, 3)
      .forEach(strategy => {
        longTermGoals.push(`${strategy.category}: ${strategy.timeline}`);
      });

    return {
      keyInsights: keyInsights.length > 0 ? keyInsights : ['Mental health assessment completed'],
      immediateNextSteps: immediateNextSteps.length > 0 ? immediateNextSteps : ['Review the detailed plan above'],
      longTermGoals: longTermGoals.length > 0 ? longTermGoals : ['Focus on gradual improvement'],
    };
  }

  async validatePlan(plan: MentalHealthPlan): Promise<boolean> {
    try {
      // Basic validation checks
      if (!plan.assessment || !plan.actionPlan || !plan.followUp) {
        return false;
      }

      if (!plan.assessment.content || !plan.actionPlan.content || !plan.followUp.content) {
        return false;
      }

      // Check for crisis indicators
      if (plan.assessment.riskLevel === 'high' && plan.actionPlan.urgency !== 'high') {
        this.logger.warn('High risk assessment but low urgency action plan', {
          sessionId: plan.sessionId,
        });
      }

      // Check for resource availability
      if (plan.actionPlan.resources.length === 0) {
        this.logger.warn('No resources provided in action plan', {
          sessionId: plan.sessionId,
        });
      }

      return true;
    } catch (error) {
      this.logger.error('Plan validation failed', {
        sessionId: plan.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if RAG system is enabled via feature flags
   */
  private async isRAGEnabled(): Promise<boolean> {
    try {
      return await featureFlagService.isEnabled('rag_enhancement', { userId: 'system' });
    } catch (error) {
      this.logger.warn('Failed to check RAG feature flag', { error });
      return false;
    }
  }

  /**
   * Check RAG system status for enhanced planning
   */
  private async checkRAGStatus(): Promise<{ enabled: boolean; ready: boolean; quality: string }> {
    const enabled = await this.isRAGEnabled();
    const ready = ragFoundationService.isReady();
    
    return {
      enabled,
      ready: enabled && ready,
      quality: enabled && ready ? 'high' : enabled ? 'degraded' : 'disabled'
    };
  }

  /**
   * Extract user preferences for RAG context
   */
  private extractUserPreferences(input: UserInput): any {
    return {
      stressLevel: input.stressLevel,
      sleepPattern: input.sleepPattern,
      supportSystem: input.supportSystem,
      symptoms: input.currentSymptoms,
      communicationStyle: this.inferCommunicationStyle(input.mentalState),
    };
  }

  /**
   * Extract insights from assessment for action planning
   */
  private extractAssessmentInsights(assessment: AssessmentResponse): any {
    return {
      riskLevel: assessment.riskLevel,
      primaryEmotions: assessment.emotionalAnalysis.primaryEmotions,
      riskFactors: assessment.riskFactors,
      protectiveFactors: assessment.protectiveFactors,
      emotionalIntensity: assessment.emotionalAnalysis.intensity,
    };
  }

  /**
   * Determine recovery stage for follow-up planning
   */
  private determineRecoveryStage(assessment: AssessmentResponse, actionPlan: ActionResponse): string {
    if (assessment.riskLevel === 'high' || actionPlan.urgency === 'high') {
      return 'crisis_stabilization';
    }
    if (assessment.riskLevel === 'medium' || actionPlan.urgency === 'medium') {
      return 'active_recovery';
    }
    return 'maintenance';
  }

  /**
   * Infer communication style from mental state description
   */
  private inferCommunicationStyle(mentalState: string): string {
    const content = mentalState.toLowerCase();
    
    if (content.includes('direct') || content.includes('straightforward')) {
      return 'direct';
    }
    if (content.includes('gentle') || content.includes('supportive')) {
      return 'supportive';
    }
    if (content.includes('detailed') || content.includes('thorough')) {
      return 'comprehensive';
    }
    return 'balanced';
  }

  /**
   * Generate enhanced summary with RAG insights
   */
  private generateEnhancedSummary(
    assessment: AssessmentResponse,
    actionPlan: ActionResponse,
    followUp: FollowUpResponse,
    ragStatus: { enabled: boolean; ready: boolean; quality: string }
  ): MentalHealthPlan['summary'] {
    const baseSummary = this.generateSummary(assessment, actionPlan, followUp);
    
    // Add RAG-specific insights
    if (ragStatus.enabled && ragStatus.ready) {
      baseSummary.keyInsights.unshift('✨ Enhanced with evidence-based mental health practices');
      
      // Add quality indicator
      baseSummary.longTermGoals.push(`RAG Quality: ${ragStatus.quality} - Evidence-based recommendations`);
    } else if (ragStatus.enabled) {
      baseSummary.keyInsights.push('⚠️ RAG system partially available - using cached knowledge');
    }
    
    return baseSummary;
  }

  getAgentStatus(): Record<string, any> {
    return {
      assessment: {
        name: this.assessmentAgent.name,
        type: 'EnhancedBaseAgent',
        ragEnabled: true,
        focusArea: 'assessment'
      },
      action: {
        name: this.actionAgent.name,
        type: 'EnhancedBaseAgent',
        ragEnabled: true,
        focusArea: 'intervention'
      },
      followUp: {
        name: this.followUpAgent.name,
        type: 'EnhancedBaseAgent',
        ragEnabled: true,
        focusArea: 'recovery'
      },
      rag: {
        enabled: ragFoundationService.isEnabled(),
        ready: ragFoundationService.isReady(),
        version: 'v1.0'
      }
    };
  }
}

// Export singleton instance
export const agentCoordinator = new AgentCoordinatorService(); 