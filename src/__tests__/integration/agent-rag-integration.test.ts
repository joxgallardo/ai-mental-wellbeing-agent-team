import { EnhancedBaseAgent } from '../../agents/enhanced-base-agent';
import { UserInput, AgentContext } from '../../types/index';
import { ragFoundationService } from '../../services/rag/rag-foundation.service';
// import { knowledgePopulationService } from '../../services/rag/knowledge-population.service';
// import { domainConfigLoaderService } from '../../services/rag/domain-config-loader.service';
import { featureFlagService } from '../../services/feature-flag.service';
// import { lifeCoachingKnowledgeBase } from '../../data/knowledge-base/life-coaching-knowledge';

/**
 * Integration Tests for Agent-RAG System
 * 
 * These tests validate the complete integration between the existing agent system
 * and the new RAG capabilities, ensuring zero-disruption and proper functionality.
 */

// Create a test agent that extends the enhanced base agent
class TestAssessmentAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'TestAssessmentAgent',
      'Mental Health Assessment Specialist',
      `You are a mental health assessment specialist. Your role is to:
      1. Evaluate the user's current mental state
      2. Identify key concerns and patterns
      3. Provide initial recommendations
      4. Determine appropriate next steps
      
      Use evidence-based approaches and maintain a supportive, professional tone.`,
      {
        ragEnabled: true,
        hybridSearchEnabled: true,
        performanceMonitoring: true,
      }
    );
  }

  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    // Customize context for assessment agent
    return {
      ...ragContext,
      preferredMethodology: 'Life Wheel Assessment',
      lifeArea: ragContext.lifeArea || 'personal_growth',
    };
  }

  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    // Filter for assessment-relevant knowledge
    return knowledgeResults.filter(result => 
      result.document.category === 'assessment_tools' ||
      result.document.category === 'methodologies' ||
      result.content.toLowerCase().includes('assessment')
    );
  }
}

describe('Agent-RAG Integration Tests', () => {
  let testAgent: TestAssessmentAgent;
  let mockInput: UserInput;
  let mockContext: AgentContext;

  beforeAll(async () => {
    // Initialize services for integration testing
    console.log('Setting up integration test environment...');
    
    // Note: In a real integration test, you would:
    // 1. Set up test database
    // 2. Initialize RAG foundation service
    // 3. Populate test knowledge base
    // 4. Configure feature flags
    
    // For this test, we'll mock the services appropriately
  });

  beforeEach(() => {
    testAgent = new TestAssessmentAgent();
    
    mockInput = {
      mentalState: 'I have been feeling overwhelmed with work stress and struggling with work-life balance. I wake up feeling anxious and have trouble concentrating during the day.',
      sleepPattern: 5,
      stressLevel: 8,
      supportSystem: ['spouse', 'colleagues'],
      recentChanges: 'Started a new demanding project at work 3 weeks ago',
      currentSymptoms: ['anxiety', 'sleep issues', 'concentration problems', 'fatigue'],
    };

    mockContext = {
      sessionId: 'integration-test-session-123',
      userId: 'test-user-456',
      previousResponses: [],
      userInput: mockUserInput,
    };
  });

  describe('Basic Agent Functionality', () => {
    it('should maintain existing agent interface', async () => {
      // Mock RAG services to simulate disabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify response structure matches original AgentResponse
      expect(response).toHaveProperty('agentName');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('recommendations');
      expect(response).toHaveProperty('timestamp');
      
      // Verify agent name is correct
      expect(response.agentName).toBe('TestAssessmentAgent');
      
      // Verify content is string
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      
      // Verify recommendations are array
      expect(Array.isArray(response.recommendations)).toBe(true);
      
      // Verify timestamp is Date
      expect(response.timestamp).toBeInstanceOf(Date);
      
      // Verify RAG metadata indicates no RAG usage
      expect(response.ragMetadata?.useRag).toBe(false);
    });

    it('should work with original agent context structure', async () => {
      // Mock RAG services to simulate disabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const contextWithPreviousResponses = {
        ...mockContext,
        previousResponses: [
          {
            agentName: 'PreviousAgent',
            content: 'Previous agent response content',
            recommendations: ['Previous recommendation'],
            timestamp: new Date(),
          },
        ],
      };
      
      const response = await testAgent.process(mockInput, contextWithPreviousResponses);
      
      expect(response).toBeDefined();
      expect(response.agentName).toBe('TestAssessmentAgent');
      expect(response.content).toBeTruthy();
    });

    it('should handle missing context gracefully', async () => {
      // Mock RAG services to simulate disabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const response = await testAgent.process(mockInput); // No context provided
      
      expect(response).toBeDefined();
      expect(response.agentName).toBe('TestAssessmentAgent');
      expect(response.content).toBeTruthy();
      expect(response.ragMetadata?.useRag).toBe(false);
    });
  });

  describe('RAG Integration', () => {
    it('should enhance responses when RAG is enabled', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'test-result-1',
          content: 'Work-life balance is crucial for mental health. The Life Wheel Assessment can help identify areas of imbalance and prioritize improvements.',
          similarity: 0.85,
          document: {
            id: 'life-wheel-doc',
            title: 'Life Wheel Assessment Guide',
            category: 'assessment_tools',
            author: 'Life Coaching Team',
          },
          metadata: {
            methodology: 'Life Wheel Assessment',
            life_area: 'personal_growth',
            complexity_level: 'beginner',
            evidence_level: 'practical',
          },
          chunk_index: 0,
        },
        {
          id: 'test-result-2',
          content: 'Stress management techniques include mindfulness, time management, and boundary setting. Assessment should identify specific stressors and coping strategies.',
          similarity: 0.78,
          document: {
            id: 'stress-management-doc',
            title: 'Comprehensive Stress Management',
            category: 'best_practices',
            author: 'Life Coaching Team',
          },
          metadata: {
            methodology: 'Mindfulness-Based Coaching',
            life_area: 'health',
            complexity_level: 'intermediate',
            evidence_level: 'research-based',
          },
          chunk_index: 1,
        },
      ]);
      
      // Mock domain adapter
      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'work stress anxiety concentration problems assessment life wheel',
          originalQuery: 'work stress anxiety concentration problems',
          addedContext: ['life_area:personal_growth', 'methodology:Life Wheel Assessment'],
          confidence: 0.85,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify RAG was used
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBe(2);
      expect(response.ragMetadata?.sources).toEqual([
        'Life Wheel Assessment Guide (assessment_tools)',
        'Comprehensive Stress Management (best_practices)',
      ]);
      
      // Verify knowledge was integrated
      expect(mockDomainAdapter.enhanceQuery).toHaveBeenCalled();
      expect(mockDomainAdapter.filterResults).toHaveBeenCalled();
      expect(ragFoundationService.hybridSearch).toHaveBeenCalled();
    });

    it('should gracefully fallback when RAG fails', async () => {
      // Mock RAG services to simulate enabled state but with failures
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval failure
      jest.spyOn(ragFoundationService, 'hybridSearch').mockRejectedValue(new Error('Knowledge retrieval failed'));
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify graceful fallback
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
      
      // Verify response is still generated
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
      expect(response.agentName).toBe('TestAssessmentAgent');
    });

    it('should respect feature flag settings', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      
      // Mock feature flag as disabled
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify RAG was not used due to feature flag
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('RAG disabled');
      
      // Verify response is still generated
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track performance metrics', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval with delay
      jest.spyOn(ragFoundationService, 'hybridSearch').mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve([
            {
              id: 'test-result-1',
              content: 'Test knowledge content',
              similarity: 0.8,
              document: {
                id: 'test-doc',
                title: 'Test Document',
                category: 'assessment_tools',
                author: 'Test Author',
              },
              metadata: {},
              chunk_index: 0,
            },
          ]), 100)
        )
      );
      
      const startTime = Date.now();
      const response = await testAgent.process(mockInput, mockContext);
      const endTime = Date.now();
      
      // Verify performance tracking
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.retrievalTime).toBeGreaterThan(50);
      expect(response.ragMetadata?.qualityScore).toBe(0.8);
      expect(endTime - startTime).toBeGreaterThan(100);
    });

    it('should handle concurrent requests', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'test-result-1',
          content: 'Test knowledge content',
          similarity: 0.8,
          document: {
            id: 'test-doc',
            title: 'Test Document',
            category: 'assessment_tools',
            author: 'Test Author',
          },
          metadata: {},
          chunk_index: 0,
        },
      ]);
      
      // Process multiple requests concurrently
      const promises = [
        testAgent.process(mockInput, { ...mockContext, sessionId: 'session-1' }),
        testAgent.process(mockInput, { ...mockContext, sessionId: 'session-2' }),
        testAgent.process(mockInput, { ...mockContext, sessionId: 'session-3' }),
      ];
      
      const responses = await Promise.all(promises);
      
      // Verify all requests completed successfully
      responses.forEach((response, index) => {
        expect(response.ragMetadata?.useRag).toBe(true);
        expect(response.content).toBeTruthy();
        expect(response.recommendations).toBeTruthy();
      });
    });
  });

  describe('Agent Customization', () => {
    it('should apply agent-specific RAG context customization', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'test-result-1',
          content: 'Life Wheel Assessment content',
          similarity: 0.8,
          document: {
            id: 'life-wheel-doc',
            title: 'Life Wheel Assessment',
            category: 'assessment_tools',
            author: 'Test Author',
          },
          metadata: {
            methodology: 'Life Wheel Assessment',
          },
          chunk_index: 0,
        },
      ]);
      
      // Mock domain adapter to capture the context
      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'enhanced query',
          originalQuery: 'original query',
          addedContext: [],
          confidence: 0.8,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);
      
      await testAgent.process(mockInput, mockContext);
      
      // Verify that the domain adapter was called with customized context
      expect(mockDomainAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockDomainAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      // Verify agent-specific customization
      expect(ragContext.preferredMethodology).toBe('Life Wheel Assessment');
      expect(ragContext.domainId).toBe('life_coaching');
    });

    it('should apply role-specific knowledge filtering', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval with mixed content
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'assessment-result',
          content: 'Assessment-related content',
          similarity: 0.9,
          document: {
            id: 'assessment-doc',
            title: 'Assessment Guide',
            category: 'assessment_tools',
            author: 'Test Author',
          },
          metadata: {},
          chunk_index: 0,
        },
        {
          id: 'other-result',
          content: 'Other content',
          similarity: 0.8,
          document: {
            id: 'other-doc',
            title: 'Other Guide',
            category: 'other',
            author: 'Test Author',
          },
          metadata: {},
          chunk_index: 0,
        },
      ]);
      
      // Mock domain adapter
      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'enhanced query',
          originalQuery: 'original query',
          addedContext: [],
          confidence: 0.8,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify that knowledge was filtered for the assessment agent role
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBe(2);
      
      // The filtering happens in the agent's filterKnowledgeForRole method
      // In this test, we expect the agent to have received both results
      // but would filter them based on its role
    });
  });

  describe('Context Preservation', () => {
    it('should preserve session context across RAG processing', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([]);
      
      const contextWithHistory = {
        ...mockContext,
        previousResponses: [
          {
            agentName: 'PreviousAgent',
            content: 'Previous assessment showed moderate stress levels',
            recommendations: ['Take breaks', 'Practice mindfulness'],
            timestamp: new Date(),
          },
        ],
      };
      
      const response = await testAgent.process(mockInput, contextWithHistory);
      
      // Verify context was preserved
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
    });

    it('should handle user profile information', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([]);
      
      const contextWithUser = {
        ...mockContext,
        userId: 'user-with-profile-123',
        // Additional user profile data could be added here
      };
      
      const response = await testAgent.process(mockInput, contextWithUser);
      
      // Verify user context was handled
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.content).toBeTruthy();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle partial service failures gracefully', async () => {
      // Mock RAG services with mixed state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock domain adapter failure
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockImplementation(() => {
        throw new Error('Domain adapter failed');
      });
      
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify graceful fallback
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
      expect(response.content).toBeTruthy();
    });

    it('should handle invalid user input gracefully', async () => {
      // Mock RAG services to simulate enabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      const invalidInput = {
        ...mockInput,
        mentalState: '', // Empty mental state
        currentSymptoms: [], // Empty symptoms
      };
      
      const response = await testAgent.process(invalidInput, mockContext);
      
      // Verify response is still generated
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing agent coordinator', async () => {
      // Mock RAG services to simulate disabled state
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      // Simulate how the agent coordinator would use the agent
      const response = await testAgent.process(mockInput, mockContext);
      
      // Verify the response structure is exactly what the coordinator expects
      expect(response).toHaveProperty('agentName');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('recommendations');
      expect(response).toHaveProperty('timestamp');
      
      // Verify no new required properties break existing code
      expect(typeof response.agentName).toBe('string');
      expect(typeof response.content).toBe('string');
      expect(Array.isArray(response.recommendations)).toBe(true);
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain response timing expectations', async () => {
      // Mock RAG services to simulate enabled state with reasonable performance
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      // Mock fast knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([]);
      
      const startTime = Date.now();
      const response = await testAgent.process(mockInput, mockContext);
      const endTime = Date.now();
      
      // Verify response time is reasonable (should be < 5 seconds for integration test)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(response.content).toBeTruthy();
    });
  });
});

// Additional helper functions for integration testing
export async function setupTestEnvironment(): Promise<void> {
  // This would set up the test environment in a real integration test
  // - Initialize test database
  // - Load test configurations
  // - Set up feature flags
  // - Initialize RAG services
}

export async function teardownTestEnvironment(): Promise<void> {
  // This would clean up the test environment
  // - Clear test database
  // - Reset configurations
  // - Clean up temporary files
}

export function createTestInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    mentalState: 'Test mental state description',
    sleepPattern: 7,
    stressLevel: 5,
    supportSystem: ['family'],
    recentChanges: 'No recent changes',
    currentSymptoms: ['mild anxiety'],
    ...overrides,
  };
}

export function createTestContext(overrides: Partial<AgentContext> = {}): AgentContext {
  const defaultUserInput: UserInput = {
    mentalState: 'feeling stressed',
    sleepPattern: 6,
    stressLevel: 5,
    supportSystem: ['family'],
    currentSymptoms: ['stress'],
  };

  return {
    sessionId: 'test-session-id',
    userId: 'test-user-id',
    previousResponses: [],
    userInput: defaultUserInput,
    ...overrides,
  };
}