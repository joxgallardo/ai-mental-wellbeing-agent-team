import request from 'supertest';
import app from '../../src/index';
import { UserInput } from '../../src/types';

// Mock the agent coordinator
jest.mock('../../src/services/agent-coordinator.service', () => {
  const isoTimestamp = '2025-07-14T03:48:44.116Z';
  const mockPlan = {
    assessment: {
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
      timestamp: isoTimestamp,
    },
    actionPlan: {
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
      timestamp: isoTimestamp,
    },
    followUp: {
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
      timestamp: isoTimestamp,
    },
    summary: {
      keyInsights: ['High stress level identified'],
      immediateNextSteps: ['Practice deep breathing'],
      longTermGoals: ['Stress Management: 3-6 months'],
    },
  };
  return {
    agentCoordinator: {
      generateMentalHealthPlan: jest.fn((userInput: UserInput, sessionId: string) => {
        // Simula validación
        if (!userInput || typeof userInput !== 'object') {
          const err: any = new Error('Request body is required');
          err.name = 'ValidationError';
          err.field = 'body';
          err.value = userInput;
          return Promise.reject(err);
        }
        if (
          !userInput.mentalState ||
          typeof userInput.mentalState !== 'string' ||
          userInput.mentalState.length === 0 ||
          typeof userInput.sleepPattern !== 'number' ||
          userInput.sleepPattern < 0 || userInput.sleepPattern > 12 ||
          typeof userInput.stressLevel !== 'number' ||
          userInput.stressLevel < 1 || userInput.stressLevel > 10 ||
          !Array.isArray(userInput.supportSystem) ||
          !Array.isArray(userInput.currentSymptoms)
        ) {
          const err: any = new Error('Invalid user input');
          err.name = 'ValidationError';
          err.field = 'body';
          err.value = userInput;
          return Promise.reject(err);
        }
        // Devuelve el mockPlan con el sessionId correcto
        return Promise.resolve({ ...mockPlan, sessionId });
      }),
      validatePlan: jest.fn(() => true),
      getAgentStatus: jest.fn(() => ({
        assessment: 'Assessment Agent',
        action: 'Action Agent',
        followUp: 'Follow-up Agent',
      })),
    },
  };
});

describe('API Integration Tests', () => {
  const isoTimestamp = '2025-07-14T03:48:44.116Z';
  const mockUserInput: UserInput = {
    mentalState: 'Feeling overwhelmed and anxious',
    sleepPattern: 6,
    stressLevel: 8,
    supportSystem: ['family', 'friends'],
    recentChanges: 'Started new job',
    currentSymptoms: ['anxiety', 'insomnia', 'irritability']
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /agents/status', () => {
    it('should return agent status', async () => {
      const mockStatus = {
        assessment: 'Assessment Agent',
        action: 'Action Agent',
        followUp: 'Follow-up Agent',
      };

      const { agentCoordinator } = require('../../src/services/agent-coordinator.service');
      agentCoordinator.getAgentStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/agents/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const { agentCoordinator } = require('../../src/services/agent-coordinator.service');
      agentCoordinator.getAgentStatus.mockImplementation(() => {
        throw new Error('Agent status error');
      });

      const response = await request(app)
        .get('/agents/status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/mental-health-plan', () => {
    it('should generate mental health plan successfully', async () => {
      const { agentCoordinator } = require('../../src/services/agent-coordinator.service');
      agentCoordinator.generateMentalHealthPlan.mockImplementation((_userInput: UserInput, sessionId: string) => {
        const expectedPlan = {
          sessionId,
          assessment: {
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
            timestamp: isoTimestamp,
          },
          actionPlan: {
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
            timestamp: isoTimestamp,
          },
          followUp: {
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
            timestamp: isoTimestamp,
          },
          summary: {
            keyInsights: ['High stress level identified'],
            immediateNextSteps: ['Practice deep breathing'],
            longTermGoals: ['Stress Management: 3-6 months'],
          },
        };
        return Promise.resolve(expectedPlan);
      });
      agentCoordinator.validatePlan.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(mockUserInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        assessment: expect.any(Object),
        actionPlan: expect.any(Object),
        followUp: expect.any(Object),
        summary: expect.any(Object),
        sessionId: expect.any(String)
      });
      expect(response.body.timestamp).toBeDefined();
      expect(agentCoordinator.generateMentalHealthPlan).toHaveBeenCalledWith(
        mockUserInput,
        expect.any(String)
      );
    });

    it('should validate request body', async () => {
      const invalidInput = {
        mentalState: '', // Invalid: empty string
        sleepPattern: 15, // Invalid: too high
        stressLevel: 12, // Invalid: too high
        supportSystem: 'not-an-array', // Invalid: should be array
        currentSymptoms: 'not-an-array' // Invalid: should be array
      };

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(invalidInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/mental-health-plan')
        .send()
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle agent errors', async () => {
      const { agentCoordinator } = require('../../src/services/agent-coordinator.service');
      agentCoordinator.generateMentalHealthPlan.mockRejectedValue(
        new Error('Agent processing failed')
      );

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(mockUserInput)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
}); 