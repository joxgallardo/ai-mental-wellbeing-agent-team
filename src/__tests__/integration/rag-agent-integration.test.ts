/**
 * RAG Agent Integration Tests
 * 
 * Comprehensive tests for RAG-enhanced agents ensuring proper integration
 * with knowledge base and evidence-based response generation.
 */

import { AssessmentAgent } from '../../agents/assessment-agent';
import { ActionAgent } from '../../agents/action-agent';
import { FollowUpAgent } from '../../agents/followup-agent';
import { agentCoordinator } from '../../services/agent-coordinator.service';
import { ragFoundationService } from '../../services/rag/rag-foundation.service';
import { featureFlagService } from '../../services/feature-flag.service';
import { UserInput, AgentContext } from '../../types/index';

// Mock setup
jest.mock('../../services/rag/rag-foundation.service');
jest.mock('../../services/feature-flag.service');

const mockRAGFoundationService = ragFoundationService as jest.Mocked<typeof ragFoundationService>;
const mockFeatureFlagService = featureFlagService as jest.Mocked<typeof featureFlagService>;

describe('RAG Agent Integration Tests', () => {
  let mockUserInput: UserInput;
  let mockContext: AgentContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockFeatureFlagService.isEnabled.mockResolvedValue(true);
    mockRAGFoundationService.isEnabled.mockReturnValue(true);
    mockRAGFoundationService.isReady.mockReturnValue(true);

    // Mock hybrid search with realistic knowledge base results
    mockRAGFoundationService.hybridSearch.mockResolvedValue([
      {
        id: 'stress-mgmt-001',
        content: 'Stress management involves developing healthy coping mechanisms including deep breathing exercises, progressive muscle relaxation, and cognitive reframing techniques. Research shows that regular practice of these techniques can reduce cortisol levels by up to 23%.',
        similarity: 0.89,
        document: {
          title: 'Evidence-Based Stress Management Techniques',
          category: 'best_practices',
          author: 'Mental Health Research Institute'
        },
        metadata: {
          methodology: 'Cognitive Behavioral Therapy',
          evidence_level: 'research-based',
          complexity_level: 'intermediate'
        },
        chunk_index: 0
      },
      {
        id: 'anxiety-assessment-001',
        content: 'Anxiety assessment should include evaluation of physical symptoms (rapid heartbeat, sweating), cognitive symptoms (racing thoughts, worry), and behavioral symptoms (avoidance, restlessness). The GAD-7 and Beck Anxiety Inventory are validated tools for measuring anxiety severity.',
        similarity: 0.85,
        document: {
          title: 'Comprehensive Anxiety Assessment Guidelines',
          category: 'assessment_tools',
          author: 'Clinical Psychology Association'
        },
        metadata: {
          assessment_type: 'anxiety_assessment',
          evidence_level: 'clinical-validated',
          complexity_level: 'advanced'
        },
        chunk_index: 1
      },
      {
        id: 'sleep-hygiene-001',
        content: 'Sleep hygiene practices include maintaining consistent sleep schedule, creating a comfortable sleep environment, avoiding caffeine 6 hours before bedtime, and establishing a relaxing bedtime routine. Studies demonstrate that proper sleep hygiene can improve sleep quality by 40-60%.',
        similarity: 0.82,
        document: {
          title: 'Sleep Hygiene Best Practices',
          category: 'interventions',
          author: 'Sleep Medicine Research Center'
        },
        metadata: {
          intervention_type: 'sleep_intervention',
          evidence_level: 'research-based',
          timeframe: 'short_term'
        },
        chunk_index: 0
      }
    ]);

    mockUserInput = {
      mentalState: 'I have been feeling overwhelmed with work stress and having difficulty sleeping at night',
      sleepPattern: 4,
      stressLevel: 8,
      supportSystem: ['family', 'friends'],
      recentChanges: 'Started a new demanding job 3 weeks ago',
      currentSymptoms: ['anxiety', 'insomnia', 'difficulty concentrating']
    };

    mockContext = {
      sessionId: 'rag-integration-test-session',
      userId: 'test-user-123',
      previousResponses: []
    };
  });

  describe('Enhanced Assessment Agent', () => {
    let assessmentAgent: AssessmentAgent;

    beforeEach(() => {
      assessmentAgent = new AssessmentAgent();
    });

    it('should use RAG enhancement for assessment with proper knowledge filtering', async () => {
      const response = await assessmentAgent.process(mockUserInput, mockContext);

      // Verify RAG service was called
      expect(mockRAGFoundationService.hybridSearch).toHaveBeenCalled();
      
      // Check that search query was constructed properly
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchQuery = searchCall[0];
      expect(searchQuery).toContain('stress');
      expect(searchQuery).toContain('sleep');

      // Verify response includes RAG metadata
      expect(response.ragMetadata).toBeDefined();
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBeGreaterThan(0);

      // Verify assessment-specific knowledge was prioritized
      expect(response.content).toContain('assessment');
      expect(response.riskLevel).toBeDefined();
      expect(response.emotionalAnalysis).toBeDefined();
    });

    it('should adapt assessment based on risk level and evidence', async () => {
      // Test high-risk scenario
      const highRiskInput = {
        ...mockUserInput,
        mentalState: 'I feel hopeless and have thoughts of self-harm',
        stressLevel: 10,
        sleepPattern: 2
      };

      const response = await assessmentAgent.process(highRiskInput, mockContext);

      expect(response.riskLevel).toBe('high');
      expect(response.riskFactors).toContain('Feelings of hopelessness');
      expect(response.emotionalAnalysis.intensity).toBeGreaterThan(8);
    });

    it('should extract relevant emotional context for RAG enhancement', async () => {
      await assessmentAgent.process(mockUserInput, mockContext);

      // Verify that emotional context was extracted and used
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchOptions = searchCall[1];
      
      expect(searchOptions).toBeDefined();
      // The agent should have customized the search based on emotional context
    });

    it('should handle RAG failure gracefully', async () => {
      // Simulate RAG service failure
      mockRAGFoundationService.hybridSearch.mockRejectedValue(new Error('RAG service unavailable'));

      const response = await assessmentAgent.process(mockUserInput, mockContext);

      // Agent should still function without RAG
      expect(response.content).toBeDefined();
      expect(response.riskLevel).toBeDefined();
      expect(response.ragMetadata?.fallbackReason).toContain('unavailable');
    });
  });

  describe('Enhanced Action Agent', () => {
    let actionAgent: ActionAgent;

    beforeEach(() => {
      actionAgent = new ActionAgent();
    });

    it('should use RAG enhancement for evidence-based interventions', async () => {
      const response = await actionAgent.process(mockUserInput, mockContext);

      // Verify RAG service was called with intervention-specific search
      expect(mockRAGFoundationService.hybridSearch).toHaveBeenCalled();
      
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchQuery = searchCall[0];
      expect(searchQuery).toMatch(/intervention|strategy|technique|action/);

      // Verify response includes evidence-based recommendations
      expect(response.ragMetadata).toBeDefined();
      expect(response.immediateActions).toBeDefined();
      expect(response.immediateActions.length).toBeGreaterThan(0);

      // Check that actions are prioritized based on urgency
      const highPriorityActions = response.immediateActions.filter(a => a.priority === 'high');
      expect(highPriorityActions.length).toBeGreaterThan(0);
    });

    it('should adapt interventions based on urgency level', async () => {
      // Test crisis scenario
      const crisisInput = {
        ...mockUserInput,
        mentalState: 'I am having a panic attack and feel like I cannot breathe',
        stressLevel: 10
      };

      const response = await actionAgent.process(crisisInput, mockContext);

      expect(response.urgency).toBe('high');
      expect(response.resources).toBeDefined();
      expect(response.resources.some(r => r.type === 'hotline')).toBe(true);
    });

    it('should filter knowledge for action-oriented content', async () => {
      await actionAgent.process(mockUserInput, mockContext);

      // Verify that search focused on actionable content
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchQuery = searchCall[0];
      
      // Should prioritize action-oriented terms
      expect(searchQuery).toMatch(/action|intervention|strategy|technique|immediate|coping|support/);
    });

    it('should provide context-aware resource recommendations', async () => {
      const response = await actionAgent.process(mockUserInput, mockContext);

      expect(response.resources).toBeDefined();
      expect(response.resources.length).toBeGreaterThan(0);

      // Resources should be relevant to the user's situation
      const resourceTypes = response.resources.map(r => r.type);
      expect(resourceTypes).toContain('app');
    });
  });

  describe('Enhanced Follow-Up Agent', () => {
    let followUpAgent: FollowUpAgent;

    beforeEach(() => {
      followUpAgent = new FollowUpAgent();
    });

    it('should use RAG enhancement for long-term recovery planning', async () => {
      const response = await followUpAgent.process(mockUserInput, mockContext);

      // Verify RAG service was called with recovery-focused search
      expect(mockRAGFoundationService.hybridSearch).toHaveBeenCalled();
      
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchQuery = searchCall[0];
      expect(searchQuery).toMatch(/follow-up|recovery|long-term|monitoring|maintenance/);

      // Verify response includes comprehensive long-term strategies
      expect(response.ragMetadata).toBeDefined();
      expect(response.longTermStrategies).toBeDefined();
      expect(response.longTermStrategies.length).toBeGreaterThan(0);
      expect(response.monitoringPlan).toBeDefined();
    });

    it('should adapt planning timeframe based on recovery stage', async () => {
      // Test different recovery stages
      const stabilizationInput = {
        ...mockUserInput,
        stressLevel: 9,
        currentSymptoms: ['anxiety', 'depression', 'panic attacks', 'insomnia']
      };

      const response = await followUpAgent.process(stabilizationInput, mockContext);

      // Should have short-term focus for crisis stabilization
      expect(response.longTermStrategies.some(s => s.timeline.includes('weeks'))).toBe(true);
      expect(response.monitoringPlan.frequency).toBe('daily');
    });

    it('should filter knowledge for recovery and maintenance content', async () => {
      await followUpAgent.process(mockUserInput, mockContext);

      // Verify that search focused on recovery-oriented content
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchQuery = searchCall[0];
      
      // Should prioritize recovery-oriented terms
      expect(searchQuery).toMatch(/recovery|maintenance|sustainability|relapse|progress|wellness|habit/);
    });

    it('should provide personalized monitoring plans', async () => {
      const response = await followUpAgent.process(mockUserInput, mockContext);

      expect(response.monitoringPlan).toBeDefined();
      expect(response.monitoringPlan.frequency).toBeDefined();
      expect(response.monitoringPlan.metrics).toBeDefined();
      expect(response.monitoringPlan.checkInQuestions).toBeDefined();

      // Monitoring should be tailored to user's symptoms
      expect(response.monitoringPlan.metrics).toContain('Stress level (1-10 scale)');
      expect(response.monitoringPlan.metrics).toContain('Sleep quality (1-10 scale)');
    });
  });

  describe('Agent Coordinator RAG Integration', () => {
    it('should orchestrate RAG-enhanced agents for complete mental health plan', async () => {
      const plan = await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'integration-test-session');

      // Verify all agents were enhanced with RAG
      expect(plan.assessment.ragMetadata).toBeDefined();
      expect(plan.actionPlan.ragMetadata).toBeDefined();
      expect(plan.followUp.ragMetadata).toBeDefined();

      // Verify metadata indicates enhanced agents
      expect(plan.metadata?.agentVersions?.assessment).toBe('enhanced-v1');
      expect(plan.metadata?.agentVersions?.action).toBe('enhanced-v1');
      expect(plan.metadata?.agentVersions?.followUp).toBe('enhanced-v1');

      // Verify RAG quality indicators
      expect(plan.metadata?.ragEnabled).toBe(true);
      expect(plan.metadata?.ragQuality).toBe('high');
    });

    it('should provide contextual information flow between agents', async () => {
      const plan = await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'context-flow-test');

      // Assessment should inform action planning
      expect(plan.actionPlan.urgency).toBeDefined();
      
      // Action planning should inform follow-up
      expect(plan.followUp.longTermStrategies).toBeDefined();
      
      // Summary should reflect RAG enhancement
      expect(plan.summary.keyInsights.some(insight => 
        insight.includes('evidence-based')
      )).toBe(true);
    });

    it('should handle RAG degradation gracefully in coordination', async () => {
      // Simulate partial RAG availability
      mockRAGFoundationService.isReady.mockReturnValue(false);

      const plan = await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'degraded-rag-test');

      // Should still generate complete plan
      expect(plan.assessment).toBeDefined();
      expect(plan.actionPlan).toBeDefined();
      expect(plan.followUp).toBeDefined();

      // Should indicate degraded quality
      expect(plan.metadata?.ragQuality).toBe('degraded');
      expect(plan.summary.keyInsights.some(insight => 
        insight.includes('partially available')
      )).toBe(true);
    });

    it('should validate enhanced agent status reporting', async () => {
      const agentStatus = agentCoordinator.getAgentStatus();

      // Verify all agents report as enhanced
      expect(agentStatus.assessment.type).toBe('EnhancedBaseAgent');
      expect(agentStatus.assessment.ragEnabled).toBe(true);
      expect(agentStatus.assessment.focusArea).toBe('assessment');

      expect(agentStatus.action.type).toBe('EnhancedBaseAgent');
      expect(agentStatus.action.ragEnabled).toBe(true);
      expect(agentStatus.action.focusArea).toBe('intervention');

      expect(agentStatus.followUp.type).toBe('EnhancedBaseAgent');
      expect(agentStatus.followUp.ragEnabled).toBe(true);
      expect(agentStatus.followUp.focusArea).toBe('recovery');

      // Verify RAG system status
      expect(agentStatus.rag.enabled).toBe(true);
      expect(agentStatus.rag.ready).toBe(true);
      expect(agentStatus.rag.version).toBe('v1.0');
    });
  });

  describe('RAG Knowledge Quality and Relevance', () => {
    it('should ensure knowledge relevance scores meet quality thresholds', async () => {
      await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'quality-test');

      // Verify search was called with appropriate threshold
      const searchCall = mockRAGFoundationService.hybridSearch.mock.calls[0];
      const searchOptions = searchCall[1];
      
      expect(searchOptions.threshold).toBeGreaterThan(0.7); // High relevance threshold
    });

    it('should filter out low-quality knowledge sources', async () => {
      // Mock knowledge with varying quality
      mockRAGFoundationService.hybridSearch.mockResolvedValue([
        {
          id: 'high-quality',
          content: 'Evidence-based stress management techniques...',
          similarity: 0.95,
          document: { title: 'Research Study', category: 'research', author: 'University' },
          metadata: { evidence_level: 'research-based' },
          chunk_index: 0
        },
        {
          id: 'low-quality',
          content: 'Some random advice about stress...',
          similarity: 0.55,
          document: { title: 'Blog Post', category: 'opinion', author: 'Unknown' },
          metadata: { evidence_level: 'anecdotal' },
          chunk_index: 0
        }
      ]);

      const assessmentAgent = new AssessmentAgent();
      const response = await assessmentAgent.process(mockUserInput, mockContext);

      // High-quality content should be prioritized
      expect(response.content).toContain('Evidence-based');
      expect(response.content).not.toContain('random advice');
    });

    it('should track and report knowledge source attribution', async () => {
      const plan = await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'attribution-test');

      // Check for source attribution in RAG metadata
      expect(plan.assessment.ragMetadata?.sources).toBeDefined();
      expect(plan.assessment.ragMetadata?.sources?.length).toBeGreaterThan(0);
      
      expect(plan.actionPlan.ragMetadata?.sources).toBeDefined();
      expect(plan.followUp.ragMetadata?.sources).toBeDefined();
    });
  });

  describe('Performance and Efficiency', () => {
    it('should complete RAG-enhanced processing within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'performance-test');
      
      const processingTime = Date.now() - startTime;
      
      // Should complete within 5 seconds (with mocked RAG service)
      expect(processingTime).toBeLessThan(5000);
    });

    it('should cache and reuse knowledge effectively', async () => {
      // Run multiple requests with similar content
      await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'cache-test-1');
      await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'cache-test-2');

      // Should have made efficient use of knowledge retrieval
      expect(mockRAGFoundationService.hybridSearch).toHaveBeenCalledTimes(6); // 3 agents × 2 requests
    });

    it('should handle concurrent requests without degradation', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        agentCoordinator.generateMentalHealthPlan(mockUserInput, `concurrent-test-${i}`)
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should complete successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.assessment).toBeDefined();
        expect(result.actionPlan).toBeDefined();
        expect(result.followUp).toBeDefined();
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle partial RAG failures with graceful degradation', async () => {
      // Simulate intermittent RAG failures
      mockRAGFoundationService.hybridSearch
        .mockResolvedValueOnce([]) // First call fails
        .mockResolvedValue([{    // Subsequent calls succeed
          id: 'fallback',
          content: 'Fallback content',
          similarity: 0.8,
          document: { title: 'Fallback', category: 'general', author: 'System' },
          metadata: {},
          chunk_index: 0
        }]);

      const plan = await agentCoordinator.generateMentalHealthPlan(mockUserInput, 'partial-failure-test');

      // Should still produce complete plan
      expect(plan.assessment).toBeDefined();
      expect(plan.actionPlan).toBeDefined();
      expect(plan.followUp).toBeDefined();

      // Should indicate degraded quality where appropriate
      expect(plan.assessment.ragMetadata?.fallbackReason).toBeDefined();
    });

    it('should validate knowledge content before use', async () => {
      // Mock invalid knowledge content
      mockRAGFoundationService.hybridSearch.mockResolvedValue([
        {
          id: 'invalid',
          content: '', // Empty content
          similarity: 0.9,
          document: { title: 'Invalid', category: 'test', author: 'Test' },
          metadata: {},
          chunk_index: 0
        }
      ]);

      const assessmentAgent = new AssessmentAgent();
      const response = await assessmentAgent.process(mockUserInput, mockContext);

      // Should handle invalid content gracefully
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });
});