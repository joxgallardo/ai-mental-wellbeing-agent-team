import { AgentCoordinatorService } from '../../src/services/agent-coordinator.service';
import { UserInput, MentalHealthPlan } from '../../src/types';

// Mock the OpenAI service
jest.mock('../../src/services/openai.service', () => ({
  openAIService: {
    generateResponse: jest.fn().mockResolvedValue('Mock AI response'),
  },
}));

// Mock the agents
jest.mock('../../src/agents/assessment-agent');
jest.mock('../../src/agents/action-agent');
jest.mock('../../src/agents/followup-agent');

describe('AgentCoordinatorService', () => {
  let coordinator: AgentCoordinatorService;
  let mockAssessmentAgent: any;
  let mockActionAgent: any;
  let mockFollowUpAgent: any;

  const mockUserInput: UserInput = {
    mentalState: 'Feeling overwhelmed and anxious',
    sleepPattern: 6,
    stressLevel: 8,
    supportSystem: ['family', 'friends'],
    recentChanges: 'Started new job',
    currentSymptoms: ['anxiety', 'insomnia', 'irritability']
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock agent responses
    mockAssessmentAgent = {
      name: 'Assessment Agent',
      process: jest.fn().mockResolvedValue({
        agentName: 'Assessment Agent',
        content: 'Assessment analysis',
        recommendations: ['Seek professional help'],
        riskLevel: 'medium',
        emotionalAnalysis: {
          primaryEmotions: ['anxiety', 'stress'],
          intensity: 7,
          patterns: ['overthinking', 'sleep issues']
        },
        riskFactors: ['high stress', 'sleep problems'],
        protectiveFactors: ['support system'],
        timestamp: new Date()
      })
    };

    mockActionAgent = {
      name: 'Action Agent',
      process: jest.fn().mockResolvedValue({
        agentName: 'Action Agent',
        content: 'Action plan',
        recommendations: ['Practice deep breathing'],
        urgency: 'medium',
        immediateActions: [
          {
            title: 'Deep breathing exercise',
            description: '5 minutes of deep breathing',
            priority: 'high',
            estimatedTime: '5 minutes'
          }
        ],
        resources: [
          {
            type: 'app',
            name: 'Calm App',
            description: 'Meditation app',
            url: 'https://calm.com'
          }
        ],
        timestamp: new Date()
      })
    };

    mockFollowUpAgent = {
      name: 'Follow-up Agent',
      process: jest.fn().mockResolvedValue({
        agentName: 'Follow-up Agent',
        content: 'Follow-up strategy',
        recommendations: ['Continue therapy'],
        longTermStrategies: [
          {
            category: 'Stress Management',
            strategies: ['Regular exercise', 'Mindfulness'],
            timeline: '3-6 months'
          }
        ],
        monitoringPlan: {
          frequency: 'weekly',
          metrics: ['sleep quality', 'stress level'],
          checkInQuestions: ['How are you feeling today?']
        },
        timestamp: new Date()
      })
    };

    // Mock the agent constructors
    const { AssessmentAgent } = require('../../src/agents/assessment-agent');
    const { ActionAgent } = require('../../src/agents/action-agent');
    const { FollowUpAgent } = require('../../src/agents/followup-agent');

    AssessmentAgent.mockImplementation(() => mockAssessmentAgent);
    ActionAgent.mockImplementation(() => mockActionAgent);
    FollowUpAgent.mockImplementation(() => mockFollowUpAgent);

    coordinator = new AgentCoordinatorService();
  });

  describe('generateMentalHealthPlan', () => {
    it('should generate a complete mental health plan', async () => {
      const sessionId = 'test-session-123';
      const plan = await coordinator.generateMentalHealthPlan(mockUserInput, sessionId);

      expect(plan).toBeDefined();
      expect(plan.sessionId).toBe(sessionId);
      expect(plan.assessment).toBeDefined();
      expect(plan.actionPlan).toBeDefined();
      expect(plan.followUp).toBeDefined();
      expect(plan.summary).toBeDefined();
    });

    it('should call all three agents in sequence', async () => {
      const sessionId = 'test-session-123';
      await coordinator.generateMentalHealthPlan(mockUserInput, sessionId);

      expect(mockAssessmentAgent.process).toHaveBeenCalledTimes(1);
      expect(mockActionAgent.process).toHaveBeenCalledTimes(1);
      expect(mockFollowUpAgent.process).toHaveBeenCalledTimes(1);

      // Check that agents are called with correct context
      expect(mockAssessmentAgent.process).toHaveBeenCalledWith(mockUserInput, {
        sessionId,
        userInput: mockUserInput,
      });

      expect(mockActionAgent.process).toHaveBeenCalledWith(mockUserInput, {
        sessionId,
        userInput: mockUserInput,
        previousResponses: expect.arrayContaining([expect.any(Object)]),
      });

      expect(mockFollowUpAgent.process).toHaveBeenCalledWith(mockUserInput, {
        sessionId,
        userInput: mockUserInput,
        previousResponses: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
      });
    });

    it('should generate a summary with key insights', async () => {
      const sessionId = 'test-session-123';
      const plan = await coordinator.generateMentalHealthPlan(mockUserInput, sessionId);

      expect(plan.summary.keyInsights).toBeDefined();
      expect(plan.summary.immediateNextSteps).toBeDefined();
      expect(plan.summary.longTermGoals).toBeDefined();
      expect(Array.isArray(plan.summary.keyInsights)).toBe(true);
      expect(Array.isArray(plan.summary.immediateNextSteps)).toBe(true);
      expect(Array.isArray(plan.summary.longTermGoals)).toBe(true);
    });
  });

  describe('validatePlan', () => {
    it('should validate a complete plan successfully', async () => {
      const sessionId = 'test-session-123';
      const plan = await coordinator.generateMentalHealthPlan(mockUserInput, sessionId);
      const isValid = await coordinator.validatePlan(plan);

      expect(isValid).toBe(true);
    });

    it('should reject incomplete plans', async () => {
      const incompletePlan: MentalHealthPlan = {
        sessionId: 'test-session',
        assessment: {} as any,
        actionPlan: {} as any,
        followUp: {} as any,
        summary: {
          keyInsights: [],
          immediateNextSteps: [],
          longTermGoals: [],
        },
      };

      const isValid = await coordinator.validatePlan(incompletePlan);
      expect(isValid).toBe(false);
    });
  });

  describe('getAgentStatus', () => {
    it('should return status of all agents', () => {
      const status = coordinator.getAgentStatus();

      expect(status).toEqual({
        assessment: 'Assessment Agent',
        action: 'Action Agent',
        followUp: 'Follow-up Agent',
      });
    });
  });
}); 