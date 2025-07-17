import { agentCoordinator } from '../../services/agent-coordinator.service';
import { EnhancedBaseAgent } from '../../agents/enhanced-base-agent';
import { UserInput, AgentContext, AgentResponse } from '../../types/index';
import { ragFoundationService } from '../../services/rag/rag-foundation.service';
import { featureFlagService } from '../../services/feature-flag.service';

/**
 * System Integration Validation Tests
 * 
 * These tests validate that the RAG-enhanced agents integrate seamlessly
 * with the existing agent coordinator system without breaking existing functionality.
 */

// Mock the existing BaseAgent to test backward compatibility
class MockLegacyAgent {
  constructor(
    public name: string,
    public role: string,
    public systemMessage: string
  ) {}

  async process(input: UserInput, context?: AgentContext): Promise<AgentResponse> {
    return {
      agentName: this.name,
      content: `Legacy agent response: ${input.mentalState}`,
      recommendations: ['Legacy recommendation 1', 'Legacy recommendation 2'],
      timestamp: new Date(),
    };
  }
}

// Create enhanced versions of the original agents
class EnhancedAssessmentAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'AssessmentAgent',
      'Mental Health Assessment Specialist',
      `You are a mental health assessment specialist. Your role is to:
      1. Evaluate the user's current mental state
      2. Identify key concerns and patterns
      3. Provide initial recommendations
      4. Determine appropriate next steps`,
      { ragEnabled: true, hybridSearchEnabled: true }
    );
  }

  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    return {
      ...ragContext,
      preferredMethodology: 'Life Wheel Assessment',
      focusArea: 'assessment',
    };
  }

  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'assessment_tools' ||
      result.document.category === 'methodologies' ||
      result.content.toLowerCase().includes('assessment')
    );
  }
}

class EnhancedActionAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'ActionAgent',
      'Action Planning Specialist',
      `You are an action planning specialist. Your role is to:
      1. Create actionable plans based on assessment
      2. Provide specific, measurable steps
      3. Consider user's capabilities and constraints
      4. Set realistic timelines`,
      { ragEnabled: true, hybridSearchEnabled: true }
    );
  }

  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    return {
      ...ragContext,
      preferredMethodology: 'GROW Model',
      focusArea: 'action_planning',
    };
  }

  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'best_practices' ||
      result.document.category === 'methodologies' ||
      result.content.toLowerCase().includes('action') ||
      result.content.toLowerCase().includes('goal')
    );
  }
}

class EnhancedFollowUpAgent extends EnhancedBaseAgent {
  constructor() {
    super(
      'FollowUpAgent',
      'Follow-up and Support Specialist',
      `You are a follow-up and support specialist. Your role is to:
      1. Create long-term support strategies
      2. Provide ongoing motivation and accountability
      3. Suggest resources and tools
      4. Plan check-ins and progress reviews`,
      { ragEnabled: true, hybridSearchEnabled: true }
    );
  }

  protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
    return {
      ...ragContext,
      preferredMethodology: 'Values Clarification',
      focusArea: 'long_term_support',
    };
  }

  protected filterKnowledgeForRole(knowledgeResults: any[], _ragContext: any): any[] {
    return knowledgeResults.filter(result => 
      result.document.category === 'best_practices' ||
      result.content.toLowerCase().includes('support') ||
      result.content.toLowerCase().includes('follow') ||
      result.content.toLowerCase().includes('maintain')
    );
  }
}

describe('System Integration Validation', () => {
  let mockInput: UserInput;
  let mockContext: AgentContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      mentalState: 'I have been feeling overwhelmed with work stress and struggling to maintain work-life balance. I wake up feeling anxious about the day ahead and have trouble focusing on tasks.',
      sleepPattern: 5,
      stressLevel: 8,
      supportSystem: ['spouse', 'close friend'],
      recentChanges: 'Started a new demanding job 6 weeks ago with increased responsibilities',
      currentSymptoms: ['anxiety', 'insomnia', 'difficulty concentrating', 'irritability', 'fatigue'],
    };

    mockContext = {
      sessionId: 'system-validation-session-123',
      userId: 'test-user-789',
      previousResponses: [],
    };
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing AgentResponse interface', async () => {
      const enhancedAgent = new EnhancedAssessmentAgent();
      
      // Mock RAG as disabled to test legacy mode
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const response = await enhancedAgent.process(mockInput, mockContext);
      
      // Verify the response matches the original AgentResponse interface
      expect(response).toHaveProperty('agentName');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('recommendations');
      expect(response).toHaveProperty('timestamp');
      
      expect(typeof response.agentName).toBe('string');
      expect(typeof response.content).toBe('string');
      expect(Array.isArray(response.recommendations)).toBe(true);
      expect(response.timestamp).toBeInstanceOf(Date);
      
      // Verify no breaking changes to existing properties
      expect(response.agentName).toBe('AssessmentAgent');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.recommendations.length).toBeGreaterThan(0);
    });

    it('should work with existing AgentCoordinator pattern', async () => {
      // Create a minimal coordinator that mimics the existing pattern
      class TestCoordinator {
        private assessmentAgent = new EnhancedAssessmentAgent();
        private actionAgent = new EnhancedActionAgent();
        private followUpAgent = new EnhancedFollowUpAgent();

        async coordinateSession(input: UserInput, _context: AgentContext) {
          const sessionId = _context.sessionId;
          
          // Process with each agent in sequence (existing pattern)
          const assessment = await this.assessmentAgent.process(input, _context);
          
          const actionContext = {
            ..._context,
            previousResponses: [assessment],
          };
          const action = await this.actionAgent.process(input, actionContext);
          
          const followUpContext = {
            ..._context,
            previousResponses: [assessment, action],
          };
          const followUp = await this.followUpAgent.process(input, followUpContext);
          
          return {
            sessionId,
            assessment,
            action,
            followUp,
          };
        }
      }

      // Mock RAG as disabled to test legacy mode
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      const coordinator = new TestCoordinator();
      const result = await coordinator.coordinateSession(mockInput, mockContext);
      
      // Verify the coordinator pattern still works
      expect(result.sessionId).toBe(mockContext.sessionId);
      expect(result.assessment.agentName).toBe('AssessmentAgent');
      expect(result.action.agentName).toBe('ActionAgent');
      expect(result.followUp.agentName).toBe('FollowUpAgent');
      
      // Verify context passing works correctly
      expect(result.action).toBeDefined();
      expect(result.followUp).toBeDefined();
    });

    it('should handle missing context gracefully like original agents', async () => {
      const enhancedAgent = new EnhancedAssessmentAgent();
      
      // Mock RAG as disabled
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
      
      // Test with no context (original agents should handle this)
      const response = await enhancedAgent.process(mockInput);
      
      expect(response).toBeDefined();
      expect(response.agentName).toBe('AssessmentAgent');
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
    });
  });

  describe('Enhanced Functionality', () => {
    beforeEach(() => {
      // Mock RAG as enabled for enhanced functionality tests
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
    });

    it('should provide enhanced responses when RAG is enabled', async () => {
      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'assessment-knowledge-1',
          content: 'The Life Wheel Assessment is a powerful tool for evaluating satisfaction across different life areas including career, relationships, health, and personal growth.',
          similarity: 0.9,
          document: {
            id: 'life-wheel-guide',
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
      ]);

      // Mock domain adapter
      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'work stress anxiety life balance assessment life wheel',
          originalQuery: 'work stress anxiety life balance',
          addedContext: ['life_area:personal_growth', 'methodology:Life Wheel Assessment'],
          confidence: 0.9,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);

      const enhancedAgent = new EnhancedAssessmentAgent();
      const response = await enhancedAgent.process(mockInput, mockContext);
      
      // Verify enhanced functionality
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBe(1);
      expect(response.ragMetadata?.sources).toContain('Life Wheel Assessment Guide (assessment_tools)');
      expect(response.ragMetadata?.qualityScore).toBe(0.9);
      
      // Verify backward compatibility maintained
      expect(response.agentName).toBe('AssessmentAgent');
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should work with different agent roles and specializations', async () => {
      // Mock different knowledge for different agent roles
      const assessmentKnowledge = [
        {
          id: 'assessment-1',
          content: 'Assessment content',
          similarity: 0.8,
          document: { id: 'test-id', title: 'Assessment Guide', category: 'assessment_tools', author: 'Test Author' },
          metadata: {},
          chunk_index: 0,
        },
      ];

      const actionKnowledge = [
        {
          id: 'action-1',
          content: 'GROW Model action planning content',
          similarity: 0.85,
          document: { id: 'test-id', title: 'GROW Model Guide', category: 'methodologies', author: 'Test Author' },
          metadata: {},
          chunk_index: 0,
        },
      ];

      const followUpKnowledge = [
        {
          id: 'followup-1',
          content: 'Long-term support strategies content',
          similarity: 0.82,
          document: { id: 'test-id', title: 'Support Strategies', category: 'best_practices', author: 'Test Author' },
          metadata: {},
          chunk_index: 0,
        },
      ];

      jest.spyOn(ragFoundationService, 'hybridSearch')
        .mockResolvedValueOnce(assessmentKnowledge)
        .mockResolvedValueOnce(actionKnowledge)
        .mockResolvedValueOnce(followUpKnowledge);

      // Mock domain adapter for all calls
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

      const assessmentAgent = new EnhancedAssessmentAgent();
      const actionAgent = new EnhancedActionAgent();
      const followUpAgent = new EnhancedFollowUpAgent();

      const assessmentResponse = await assessmentAgent.process(mockInput, mockContext);
      const actionResponse = await actionAgent.process(mockInput, mockContext);
      const followUpResponse = await followUpAgent.process(mockInput, mockContext);

      // Verify each agent maintains its identity and role
      expect(assessmentResponse.agentName).toBe('AssessmentAgent');
      expect(actionResponse.agentName).toBe('ActionAgent');
      expect(followUpResponse.agentName).toBe('FollowUpAgent');

      // Verify RAG was used for each
      expect(assessmentResponse.ragMetadata?.useRag).toBe(true);
      expect(actionResponse.ragMetadata?.useRag).toBe(true);
      expect(followUpResponse.ragMetadata?.useRag).toBe(true);

      // Verify responses are different (role-specific)
      expect(assessmentResponse.content).not.toBe(actionResponse.content);
      expect(actionResponse.content).not.toBe(followUpResponse.content);
    });
  });

  describe('Graceful Degradation', () => {
    it('should fallback to legacy behavior when RAG fails', async () => {
      // Mock RAG as enabled but failing
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      jest.spyOn(ragFoundationService, 'hybridSearch').mockRejectedValue(new Error('RAG system failure'));

      const enhancedAgent = new EnhancedAssessmentAgent();
      const response = await enhancedAgent.process(mockInput, mockContext);

      // Verify graceful fallback
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
      
      // Verify original functionality still works
      expect(response.agentName).toBe('AssessmentAgent');
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should handle partial RAG failures gracefully', async () => {
      // Mock RAG enabled but domain adapter fails
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockImplementation(() => {
        throw new Error('Domain adapter initialization failed');
      });

      const enhancedAgent = new EnhancedAssessmentAgent();
      const response = await enhancedAgent.process(mockInput, mockContext);

      // Verify graceful fallback
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
      
      // Verify system continues to work
      expect(response.content).toBeTruthy();
      expect(response.recommendations).toBeTruthy();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should maintain reasonable response times with RAG', async () => {
      // Mock RAG with realistic delay
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      
      jest.spyOn(ragFoundationService, 'hybridSearch').mockImplementation(() =>
        new Promise(resolve => 
          setTimeout(() => resolve([
            {
              id: 'test-1',
              content: 'Test content',
              similarity: 0.8,
              document: { id: 'test-id', title: 'Test Doc', category: 'methodologies', author: 'Test Author' },
              metadata: {},
              chunk_index: 0,
            },
          ]), 200) // 200ms delay
        )
      );

      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'enhanced',
          originalQuery: 'original',
          addedContext: [],
          confidence: 0.8,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);

      const enhancedAgent = new EnhancedAssessmentAgent();
      
      const startTime = Date.now();
      const response = await enhancedAgent.process(mockInput, mockContext);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      // Verify reasonable response time (should be < 5 seconds for integration test)
      expect(responseTime).toBeLessThan(5000);
      
      // Verify performance metadata is tracked
      expect(response.ragMetadata?.retrievalTime).toBeGreaterThan(100);
      expect(response.ragMetadata?.useRag).toBe(true);
    });

    it('should handle concurrent requests without interference', async () => {
      // Mock RAG services
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'concurrent-test',
          content: 'Concurrent test content',
          similarity: 0.8,
          document: { id: 'test-id', title: 'Test Doc', category: 'methodologies', author: 'Test Author' },
          metadata: {},
          chunk_index: 0,
        },
      ]);

      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'enhanced',
          originalQuery: 'original',
          addedContext: [],
          confidence: 0.8,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);

      const enhancedAgent = new EnhancedAssessmentAgent();
      
      // Process multiple requests concurrently
      const contexts = [
        { ...mockContext, sessionId: 'session-1', userId: 'user-1' },
        { ...mockContext, sessionId: 'session-2', userId: 'user-2' },
        { ...mockContext, sessionId: 'session-3', userId: 'user-3' },
      ];

      const promises = contexts.map(ctx => enhancedAgent.process(mockInput, ctx));
      const responses = await Promise.all(promises);

      // Verify all requests completed successfully
      responses.forEach((response, index) => {
        expect(response.ragMetadata?.useRag).toBe(true);
        expect(response.content).toBeTruthy();
        expect(response.recommendations).toBeTruthy();
        expect(response.agentName).toBe('AssessmentAgent');
      });

      // Verify no cross-contamination between sessions
      expect(responses[0]).not.toEqual(responses[1]);
      expect(responses[1]).not.toEqual(responses[2]);
    });
  });

  describe('System Integration Health Check', () => {
    it('should validate complete system integration', async () => {
      // This test validates the complete system works end-to-end
      const healthCheck = {
        ragFoundationService: false,
        featureFlags: false,
        domainAdapter: false,
        enhancedAgents: false,
        backwardCompatibility: false,
        gracefulDegradation: false,
      };

      try {
        // Check RAG Foundation Service
        jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
        jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
        healthCheck.ragFoundationService = true;

        // Check Feature Flags
        jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
        healthCheck.featureFlags = true;

        // Check Domain Adapter
        const mockDomainAdapter = {
          enhanceQuery: jest.fn().mockReturnValue({
            enhancedQuery: 'test',
            originalQuery: 'test',
            addedContext: [],
            confidence: 0.8,
          }),
          filterResults: jest.fn().mockImplementation((results) => results),
        };
        
        const { DomainAdapterFactory } = require('../../services/rag/domain-adapter.service');
        jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);
        healthCheck.domainAdapter = true;

        // Check Enhanced Agents
        jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
          {
            id: 'health-check',
            content: 'Health check content',
            similarity: 0.8,
            document: { id: 'test-id', title: 'Health Check', category: 'methodologies', author: 'Test Author' },
            metadata: {},
            chunk_index: 0,
          },
        ]);

        const enhancedAgent = new EnhancedAssessmentAgent();
        const enhancedResponse = await enhancedAgent.process(mockInput, mockContext);
        
        if (enhancedResponse.ragMetadata?.useRag === true) {
          healthCheck.enhancedAgents = true;
        }

        // Check Backward Compatibility
        jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(false);
        jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(false);
        
        const legacyResponse = await enhancedAgent.process(mockInput, mockContext);
        
        if (
          legacyResponse.agentName === 'AssessmentAgent' &&
          legacyResponse.content &&
          legacyResponse.recommendations &&
          legacyResponse.ragMetadata?.useRag === false
        ) {
          healthCheck.backwardCompatibility = true;
        }

        // Check Graceful Degradation
        jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
        jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);
        jest.spyOn(ragFoundationService, 'hybridSearch').mockRejectedValue(new Error('Test failure'));
        
        const fallbackResponse = await enhancedAgent.process(mockInput, mockContext);
        
        if (
          fallbackResponse.ragMetadata?.useRag === false &&
          fallbackResponse.ragMetadata?.fallbackReason &&
          fallbackResponse.content &&
          fallbackResponse.recommendations
        ) {
          healthCheck.gracefulDegradation = true;
        }

      } catch (error) {
        console.error('Health check failed:', error);
      }

      // Verify all systems are healthy
      expect(healthCheck.ragFoundationService).toBe(true);
      expect(healthCheck.featureFlags).toBe(true);
      expect(healthCheck.domainAdapter).toBe(true);
      expect(healthCheck.enhancedAgents).toBe(true);
      expect(healthCheck.backwardCompatibility).toBe(true);
      expect(healthCheck.gracefulDegradation).toBe(true);

      console.log('System Integration Health Check Results:', healthCheck);
    });
  });
});

// Helper functions for integration testing
export function createSystemTestInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    mentalState: 'I am experiencing work-related stress and need help developing coping strategies',
    sleepPattern: 6,
    stressLevel: 7,
    supportSystem: ['family', 'colleagues'],
    recentChanges: 'Started new role with increased responsibilities',
    currentSymptoms: ['stress', 'mild anxiety', 'difficulty prioritizing'],
    ...overrides,
  };
}

export function createSystemTestContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'system-test-session',
    userId: 'system-test-user',
    previousResponses: [],
    ...overrides,
  };
}

export async function validateAgentResponse(response: any): Promise<boolean> {
  // Validate that response matches expected AgentResponse interface
  const requiredFields = ['agentName', 'content', 'recommendations', 'timestamp'];
  
  for (const field of requiredFields) {
    if (!(field in response)) {
      return false;
    }
  }

  if (typeof response.agentName !== 'string') return false;
  if (typeof response.content !== 'string') return false;
  if (!Array.isArray(response.recommendations)) return false;
  if (!(response.timestamp instanceof Date)) return false;

  return true;
}