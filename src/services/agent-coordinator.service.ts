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
    this.logger.info('Starting mental health plan generation', { sessionId });

    try {
      // Validate user input
      const validatedInput = UserInputSchema.parse(userInput);

      // Step 1: Assessment
      this.logger.info('Starting assessment phase', { sessionId });
      const assessment = await this.assessmentAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
      });

      // Step 2: Action Plan
      this.logger.info('Starting action plan phase', { sessionId });
      const actionPlan = await this.actionAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
        previousResponses: [assessment],
      });

      // Step 3: Follow-up Strategy
      this.logger.info('Starting follow-up strategy phase', { sessionId });
      const followUp = await this.followUpAgent.process(validatedInput, {
        sessionId,
        userInput: validatedInput,
        previousResponses: [assessment, actionPlan],
      });

      // Generate summary
      const summary = this.generateSummary(assessment, actionPlan, followUp);

      const mentalHealthPlan: MentalHealthPlan = {
        sessionId,
        assessment,
        actionPlan,
        followUp,
        summary,
      };

      this.logger.info('Mental health plan generated successfully', {
        sessionId,
        riskLevel: assessment.riskLevel,
        urgency: actionPlan.urgency,
        strategiesCount: followUp.longTermStrategies.length,
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

  getAgentStatus(): Record<string, string> {
    return {
      assessment: this.assessmentAgent.name,
      action: this.actionAgent.name,
      followUp: this.followUpAgent.name,
    };
  }
}

// Export singleton instance
export const agentCoordinator = new AgentCoordinatorService(); 