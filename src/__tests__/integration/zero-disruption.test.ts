import request from 'supertest';
import app from '../../index';
import { featureFlagService } from '../../services/feature-flag.service';
import { ragFoundationService } from '../../services/rag/rag-foundation.service';

/**
 * Zero-Disruption Integration Tests
 * 
 * These tests verify that the RAG enhancement doesn't break
 * existing functionality and provides graceful fallbacks.
 */

describe('Zero-Disruption Integration Tests', () => {
  const testUserInput = {
    mentalState: 'I have been feeling anxious about work and having trouble sleeping',
    sleepPattern: 5,
    stressLevel: 7,
    supportSystem: ['Family', 'Friends'],
    recentChanges: 'New job started last month',
    currentSymptoms: ['Anxiety', 'Insomnia', 'Difficulty concentrating'],
  };

  beforeEach(async () => {
    // Ensure RAG is disabled for baseline tests
    await featureFlagService.disableFeature('rag_enhancement');
    await featureFlagService.disableFeature('hybrid_search');
    await featureFlagService.disableFeature('advanced_personalization');
  });

  afterEach(async () => {
    // Reset to default state
    await featureFlagService.disableFeature('rag_enhancement');
  });

  describe('Baseline Functionality (RAG Disabled)', () => {
    it('should handle mental health plan generation without RAG', async () => {
      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('assessment');
      expect(response.body.data).toHaveProperty('actionPlan');
      expect(response.body.data).toHaveProperty('followUp');
      expect(response.body.data).toHaveProperty('summary');

      // Verify assessment structure
      const assessment = response.body.data.assessment;
      expect(assessment).toHaveProperty('agentName', 'assessment_agent');
      expect(assessment).toHaveProperty('content');
      expect(assessment).toHaveProperty('emotionalAnalysis');
      expect(assessment).toHaveProperty('riskFactors');
      expect(assessment).toHaveProperty('protectiveFactors');
      expect(assessment).toHaveProperty('riskLevel');

      // Verify action plan structure
      const actionPlan = response.body.data.actionPlan;
      expect(actionPlan).toHaveProperty('agentName', 'action_agent');
      expect(actionPlan).toHaveProperty('content');
      expect(actionPlan).toHaveProperty('immediateActions');
      expect(actionPlan).toHaveProperty('resources');
      expect(actionPlan).toHaveProperty('urgency');

      // Verify follow-up structure
      const followUp = response.body.data.followUp;
      expect(followUp).toHaveProperty('agentName', 'followup_agent');
      expect(followUp).toHaveProperty('content');
      expect(followUp).toHaveProperty('longTermStrategies');
      expect(followUp).toHaveProperty('monitoringPlan');
    });

    it('should handle edge cases without RAG', async () => {
      const edgeCaseInput = {
        mentalState: 'Fine',
        sleepPattern: 8,
        stressLevel: 1,
        supportSystem: [],
        currentSymptoms: [],
      };

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(edgeCaseInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assessment.riskLevel).toBe('low');
    });

    it('should handle high-risk scenarios without RAG', async () => {
      const highRiskInput = {
        mentalState: 'I feel hopeless and overwhelmed, having thoughts of self-harm',
        sleepPattern: 3,
        stressLevel: 10,
        supportSystem: [],
        currentSymptoms: ['Depression', 'Anxiety', 'Suicidal thoughts'],
      };

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(highRiskInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assessment.riskLevel).toBe('high');
      expect(response.body.data.actionPlan.urgency).toBe('high');
    });
  });

  describe('RAG Enhancement (Gradual Rollout)', () => {
    it('should handle RAG enhancement when enabled', async () => {
      // Enable RAG enhancement
      await featureFlagService.enableFeature('rag_enhancement');

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      
      // Should still have the same structure
      expect(response.body.data).toHaveProperty('assessment');
      expect(response.body.data).toHaveProperty('actionPlan');
      expect(response.body.data).toHaveProperty('followUp');
      expect(response.body.data).toHaveProperty('summary');

      // Content might be enhanced but structure should be identical
      const assessment = response.body.data.assessment;
      expect(assessment).toHaveProperty('agentName', 'assessment_agent');
      expect(assessment).toHaveProperty('emotionalAnalysis');
      expect(assessment).toHaveProperty('riskFactors');
      expect(assessment).toHaveProperty('protectiveFactors');
      expect(assessment).toHaveProperty('riskLevel');
    });

    it('should handle RAG service unavailable gracefully', async () => {
      // Enable RAG but simulate service unavailability
      await featureFlagService.enableFeature('rag_enhancement');
      
      // Mock RAG service to throw error
      jest.spyOn(ragFoundationService, 'semanticSearch').mockRejectedValue(
        new Error('RAG service unavailable')
      );

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assessment');
      expect(response.body.data).toHaveProperty('actionPlan');
      expect(response.body.data).toHaveProperty('followUp');

      // Should fallback to standard behavior
      expect(response.body.data.assessment).toHaveProperty('agentName', 'assessment_agent');
    });

    it('should handle partial RAG rollout', async () => {
      // Enable RAG with 50% rollout
      await featureFlagService.enableFeature('rag_enhancement');
      await featureFlagService.setRolloutPercentage('rag_enhancement', 50);

      const responses = [];
      
      // Test multiple requests with different session IDs
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/mental-health-plan')
          .send({
            ...testUserInput,
            sessionId: `test-session-${i}`,
          })
          .expect(200);

        responses.push(response.body);
      }

      // All responses should be successful
      responses.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.data).toHaveProperty('assessment');
        expect(response.data).toHaveProperty('actionPlan');
        expect(response.data).toHaveProperty('followUp');
      });
    });
  });

  describe('Feature Flag Validation', () => {
    it('should respect feature flag states', async () => {
      // Test with RAG disabled
      expect(await featureFlagService.isEnabled('rag_enhancement')).toBe(false);
      
      // Enable RAG
      await featureFlagService.enableFeature('rag_enhancement');
      expect(await featureFlagService.isEnabled('rag_enhancement')).toBe(true);
      
      // Disable RAG
      await featureFlagService.disableFeature('rag_enhancement');
      expect(await featureFlagService.isEnabled('rag_enhancement')).toBe(false);
    });

    it('should handle feature flag dependencies', async () => {
      // hybrid_search depends on rag_enhancement
      expect(await featureFlagService.isEnabled('hybrid_search')).toBe(false);
      
      // Enable hybrid_search without parent
      await featureFlagService.enableFeature('hybrid_search');
      expect(await featureFlagService.isEnabled('hybrid_search')).toBe(false);
      
      // Enable parent dependency
      await featureFlagService.enableFeature('rag_enhancement');
      expect(await featureFlagService.isEnabled('hybrid_search')).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    it('should maintain response times with RAG disabled', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post('/api/mental-health-plan')
          .send({
            ...testUserInput,
            mentalState: `Test concurrent request ${i}`,
          })
          .expect(200);
        
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('sessionId');
        expect(response.body.data.assessment.content).toContain(`Test concurrent request ${index}`);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const invalidInput = {
        mentalState: '', // Empty required field
        sleepPattern: 15, // Invalid range
        stressLevel: 11, // Invalid range
        supportSystem: 'invalid', // Should be array
        currentSymptoms: 'invalid', // Should be array
      };

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(invalidInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle missing required fields', async () => {
      const incompleteInput = {
        mentalState: 'I feel anxious',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(incompleteInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Health Check Integration', () => {
    it('should pass health check with RAG disabled', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should pass health check with RAG enabled', async () => {
      await featureFlagService.enableFeature('rag_enhancement');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should show agent status', async () => {
      const response = await request(app)
        .get('/agents/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assessment');
      expect(response.body.data).toHaveProperty('action');
      expect(response.body.data).toHaveProperty('followUp');
    });
  });

  describe('API Compatibility', () => {
    it('should maintain exact API response structure', async () => {
      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      // Verify exact response structure
      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessionId: expect.any(String),
          assessment: {
            agentName: 'assessment_agent',
            content: expect.any(String),
            recommendations: expect.any(Array),
            timestamp: expect.any(String),
            emotionalAnalysis: {
              primaryEmotions: expect.any(Array),
              intensity: expect.any(Number),
              patterns: expect.any(Array),
            },
            riskFactors: expect.any(Array),
            protectiveFactors: expect.any(Array),
            riskLevel: expect.stringMatching(/^(low|medium|high)$/),
          },
          actionPlan: {
            agentName: 'action_agent',
            content: expect.any(String),
            recommendations: expect.any(Array),
            timestamp: expect.any(String),
            immediateActions: expect.any(Array),
            resources: expect.any(Array),
            urgency: expect.stringMatching(/^(low|medium|high)$/),
          },
          followUp: {
            agentName: 'followup_agent',
            content: expect.any(String),
            recommendations: expect.any(Array),
            timestamp: expect.any(String),
            longTermStrategies: expect.any(Array),
            monitoringPlan: {
              frequency: expect.any(String),
              metrics: expect.any(Array),
              checkInQuestions: expect.any(Array),
            },
          },
          summary: {
            keyInsights: expect.any(Array),
            immediateNextSteps: expect.any(Array),
            longTermGoals: expect.any(Array),
          },
        },
        timestamp: expect.any(String),
      });
    });

    it('should maintain response field types', async () => {
      const response = await request(app)
        .post('/api/mental-health-plan')
        .send(testUserInput)
        .expect(200);

      const { data } = response.body;

      // Verify field types
      expect(typeof data.sessionId).toBe('string');
      expect(typeof data.assessment.content).toBe('string');
      expect(Array.isArray(data.assessment.recommendations)).toBe(true);
      expect(typeof data.assessment.emotionalAnalysis.intensity).toBe('number');
      expect(Array.isArray(data.actionPlan.immediateActions)).toBe(true);
      expect(Array.isArray(data.followUp.longTermStrategies)).toBe(true);
    });
  });
});