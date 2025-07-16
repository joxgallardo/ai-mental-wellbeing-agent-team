import { EnhancedBaseAgent, RAGContext, EnhancedAgentResponse } from '../enhanced-base-agent';
import { UserInput, AgentContext } from '../../types/index';

// Mock dependencies
jest.mock('../../../services/rag/rag-foundation.service', () => ({
  ragFoundationService: {
    isEnabled: jest.fn(() => true),
    isReady: jest.fn(() => true),
    semanticSearch: jest.fn(() => Promise.resolve([])),
    hybridSearch: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../../services/rag/domain-adapter.service', () => ({
  DomainAdapterFactory: {
    getAdapter: jest.fn(() => ({
      enhanceQuery: jest.fn(() => ({
        enhancedQuery: 'enhanced test query',
        originalQuery: 'test query',
        addedContext: ['context1', 'context2'],
        confidence: 0.8,
      })),
      filterResults: jest.fn((results) => results),
    })),
  },
}));

jest.mock('../../../services/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('../../../services/openai.service', () => ({
  openAIService: {
    generateResponse: jest.fn(() => Promise.resolve('AI response with recommendations:\n- Recommendation 1\n- Recommendation 2')),
  },
}));

// Create a concrete test implementation
class TestEnhancedAgent extends EnhancedBaseAgent {
  constructor(options: any = {}) {
    super(
      'TestAgent',
      'Test Agent Role',
      'Test system message for the agent',
      options
    );
  }

  async process(input: UserInput, context?: AgentContext): Promise<EnhancedAgentResponse> {
    return super.process(input, context);
  }

  protected customizeRAGContext(
    ragContext: RAGContext,
    input: UserInput,
    context?: AgentContext
  ): RAGContext {
    // Add test-specific customization
    return {
      ...ragContext,
      preferredMethodology: 'GROW Model',
    };
  }

  protected filterKnowledgeForRole(
    knowledgeResults: any[],
    ragContext: RAGContext
  ): any[] {
    // Add test-specific filtering
    return knowledgeResults.filter(result => result.document.category === 'methodologies');
  }
}

describe('EnhancedBaseAgent', () => {
  let agent: TestEnhancedAgent;
  let mockInput: UserInput;
  let mockContext: AgentContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    agent = new TestEnhancedAgent();
    
    mockInput = {
      mentalState: 'I am feeling stressed about work and need help with time management',
      sleepPattern: 6,
      stressLevel: 7,
      supportSystem: ['family', 'friends'],
      recentChanges: 'Started a new job last month',
      currentSymptoms: ['anxiety', 'fatigue', 'difficulty concentrating'],
    };

    mockContext = {
      sessionId: 'test-session-123',
      userId: 'user-456',
      previousResponses: [
        {
          agentName: 'AssessmentAgent',
          content: 'Previous assessment response',
          recommendations: ['Previous recommendation'],
          timestamp: new Date(),
        },
      ],
    };
  });

  describe('Constructor', () => {
    it('should create agent with default options', () => {
      const defaultAgent = new TestEnhancedAgent();
      
      expect(defaultAgent.name).toBe('TestAgent');
      expect(defaultAgent.role).toBe('Test Agent Role');
      expect(defaultAgent.systemMessage).toBe('Test system message for the agent');
    });

    it('should create agent with custom options', () => {
      const customAgent = new TestEnhancedAgent({
        ragEnabled: false,
        hybridSearchEnabled: false,
        performanceMonitoring: false,
      });
      
      expect(customAgent.name).toBe('TestAgent');
      expect(customAgent.role).toBe('Test Agent Role');
    });
  });

  describe('RAG Availability Check', () => {
    it('should use RAG when all conditions are met', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { featureFlagService } = require('../../../services/feature-flag.service');
      
      ragFoundationService.isEnabled.mockReturnValue(true);
      ragFoundationService.isReady.mockReturnValue(true);
      featureFlagService.isEnabled.mockResolvedValue(true);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(featureFlagService.isEnabled).toHaveBeenCalledWith('rag_enhancement', {
        userId: mockContext.userId,
        sessionId: mockContext.sessionId,
      });
    });

    it('should not use RAG when disabled in constructor', async () => {
      const disabledAgent = new TestEnhancedAgent({ ragEnabled: false });
      
      const response = await disabledAgent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('RAG disabled');
    });

    it('should not use RAG when feature flag is disabled', async () => {
      const { featureFlagService } = require('../../../services/feature-flag.service');
      featureFlagService.isEnabled.mockResolvedValue(false);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('RAG disabled');
    });

    it('should not use RAG when foundation service is not ready', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      ragFoundationService.isReady.mockReturnValue(false);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('RAG disabled');
    });
  });

  describe('RAG Context Extraction', () => {
    it('should extract life area from user input', async () => {
      const workRelatedInput = {
        ...mockInput,
        mentalState: 'I am having issues with my career and workplace stress',
        currentSymptoms: ['work anxiety', 'job dissatisfaction'],
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(workRelatedInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.lifeArea).toBe('career');
    });

    it('should detect complexity level from user input', async () => {
      const beginnerInput = {
        ...mockInput,
        mentalState: 'I am new to this and need basic help with simple goal setting',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(beginnerInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.complexityLevel).toBe('beginner');
    });

    it('should extract goals from user input', async () => {
      const goalInput = {
        ...mockInput,
        mentalState: 'I want to improve my time management and need to develop better work-life balance',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(goalInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.currentGoals).toBeDefined();
      expect(ragContext.currentGoals!.length).toBeGreaterThan(0);
    });

    it('should include session history in context', async () => {
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(mockInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.sessionHistory).toBeDefined();
      expect(ragContext.sessionHistory!.length).toBe(1);
      expect(ragContext.sessionHistory![0]).toContain('AssessmentAgent');
    });
  });

  describe('Knowledge Retrieval', () => {
    it('should perform semantic search when hybrid search is disabled', async () => {
      const semanticAgent = new TestEnhancedAgent({ hybridSearchEnabled: false });
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test knowledge content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      const response = await semanticAgent.process(mockInput, mockContext);
      
      expect(ragFoundationService.semanticSearch).toHaveBeenCalled();
      expect(ragFoundationService.hybridSearch).not.toHaveBeenCalled();
      expect(response.ragMetadata?.searchResults).toBe(1);
    });

    it('should perform hybrid search when enabled', async () => {
      const hybridAgent = new TestEnhancedAgent({ hybridSearchEnabled: true });
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      
      ragFoundationService.hybridSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test knowledge content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      const response = await hybridAgent.process(mockInput, mockContext);
      
      expect(ragFoundationService.hybridSearch).toHaveBeenCalled();
      expect(response.ragMetadata?.searchResults).toBe(1);
    });

    it('should handle knowledge retrieval errors gracefully', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      ragFoundationService.semanticSearch.mockRejectedValue(new Error('Search failed'));
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
    });

    it('should filter knowledge results for role', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      
      const mockResults = [
        {
          id: '1',
          content: 'Methodology content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
        {
          id: '2',
          content: 'Other content',
          similarity: 0.7,
          document: { title: 'Other Document', category: 'other' },
        },
      ];
      
      ragFoundationService.semanticSearch.mockResolvedValue(mockResults);
      DomainAdapterFactory.getAdapter().filterResults.mockReturnValue(mockResults);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.searchResults).toBe(2);
    });
  });

  describe('Query Enhancement', () => {
    it('should create meaningful search query from user input', async () => {
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(mockInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const originalQuery = enhanceQueryCall[0];
      
      expect(originalQuery).toContain('feeling stressed');
      expect(originalQuery).toContain('time management');
      expect(originalQuery).toContain('high stress management');
    });

    it('should include stress level context in query', async () => {
      const highStressInput = {
        ...mockInput,
        stressLevel: 9,
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(highStressInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const originalQuery = enhanceQueryCall[0];
      
      expect(originalQuery).toContain('high stress management');
    });

    it('should include sleep context in query', async () => {
      const poorSleepInput = {
        ...mockInput,
        sleepPattern: 4,
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(poorSleepInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const originalQuery = enhanceQueryCall[0];
      
      expect(originalQuery).toContain('sleep improvement');
    });
  });

  describe('System Message Enhancement', () => {
    it('should enhance system message with knowledge context', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { openAIService } = require('../../../services/openai.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'GROW Model is a coaching framework that stands for Goal, Reality, Options, and Will.',
          similarity: 0.9,
          document: { title: 'GROW Model Guide', category: 'methodologies' },
        },
      ]);
      
      await agent.process(mockInput, mockContext);
      
      expect(openAIService.generateResponse).toHaveBeenCalled();
      const generateResponseCall = openAIService.generateResponse.mock.calls[0];
      const enhancedSystemMessage = generateResponseCall[0];
      
      expect(enhancedSystemMessage).toContain('RELEVANT KNOWLEDGE');
      expect(enhancedSystemMessage).toContain('GROW Model Guide');
      expect(enhancedSystemMessage).toContain('GROW Model is a coaching framework');
    });

    it('should add methodology guidance to system message', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { openAIService } = require('../../../services/openai.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      await agent.process(mockInput, mockContext);
      
      expect(openAIService.generateResponse).toHaveBeenCalled();
      const generateResponseCall = openAIService.generateResponse.mock.calls[0];
      const enhancedSystemMessage = generateResponseCall[0];
      
      expect(enhancedSystemMessage).toContain('METHODOLOGY GUIDANCE');
      expect(enhancedSystemMessage).toContain('GROW Model approach');
    });

    it('should add complexity level guidance to system message', async () => {
      const beginnerInput = {
        ...mockInput,
        mentalState: 'I am new to this and need basic help',
      };
      
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { openAIService } = require('../../../services/openai.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      await agent.process(beginnerInput, mockContext);
      
      expect(openAIService.generateResponse).toHaveBeenCalled();
      const generateResponseCall = openAIService.generateResponse.mock.calls[0];
      const enhancedSystemMessage = generateResponseCall[0];
      
      expect(enhancedSystemMessage).toContain('COMPLEXITY LEVEL');
      expect(enhancedSystemMessage).toContain('beginner level understanding');
    });
  });

  describe('User Message Enhancement', () => {
    it('should enhance user message with knowledge context', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { openAIService } = require('../../../services/openai.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Time management strategies include prioritization and scheduling.',
          similarity: 0.85,
          document: { title: 'Time Management Guide', category: 'best_practices' },
        },
      ]);
      
      await agent.process(mockInput, mockContext);
      
      expect(openAIService.generateResponse).toHaveBeenCalled();
      const generateResponseCall = openAIService.generateResponse.mock.calls[0];
      const enhancedUserMessage = generateResponseCall[1];
      
      expect(enhancedUserMessage).toContain('CONTEXT FROM KNOWLEDGE BASE');
      expect(enhancedUserMessage).toContain('Time Management Guide');
      expect(enhancedUserMessage).toContain('Time management strategies');
    });

    it('should maintain original user message format', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      const { openAIService } = require('../../../services/openai.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([]);
      
      await agent.process(mockInput, mockContext);
      
      expect(openAIService.generateResponse).toHaveBeenCalled();
      const generateResponseCall = openAIService.generateResponse.mock.calls[0];
      const userMessage = generateResponseCall[1];
      
      expect(userMessage).toContain('Mental State: I am feeling stressed');
      expect(userMessage).toContain('Sleep Pattern: 6 hours per night');
      expect(userMessage).toContain('Stress Level: 7/10');
    });
  });

  describe('Response Generation', () => {
    it('should generate response with RAG metadata', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test knowledge content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata).toBeDefined();
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBe(1);
      expect(response.ragMetadata?.retrievalTime).toBeGreaterThan(0);
      expect(response.ragMetadata?.sources).toEqual(['Test Document (methodologies)']);
    });

    it('should extract recommendations from AI response', async () => {
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.recommendations).toBeDefined();
      expect(response.recommendations.length).toBe(2);
      expect(response.recommendations[0]).toBe('Recommendation 1');
      expect(response.recommendations[1]).toBe('Recommendation 2');
    });

    it('should include agent name and timestamp', async () => {
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.agentName).toBe('TestAgent');
      expect(response.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to standard processing on RAG failure', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      ragFoundationService.semanticSearch.mockRejectedValue(new Error('RAG system failure'));
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(false);
      expect(response.ragMetadata?.fallbackReason).toContain('Error in RAG processing');
      expect(response.content).toBeDefined();
      expect(response.recommendations).toBeDefined();
    });

    it('should fallback when no knowledge is found', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      ragFoundationService.semanticSearch.mockResolvedValue([]);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.useRag).toBe(true);
      expect(response.ragMetadata?.searchResults).toBe(0);
      expect(response.content).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track retrieval time in metadata', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      
      ragFoundationService.semanticSearch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve([
            {
              id: '1',
              content: 'Test content',
              similarity: 0.8,
              document: { title: 'Test Document', category: 'methodologies' },
            },
          ]), 100)
        )
      );
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.retrievalTime).toBeGreaterThan(50);
    });

    it('should calculate quality score from search results', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'High quality content',
          similarity: 0.9,
          document: { title: 'High Quality Document', category: 'methodologies' },
        },
        {
          id: '2',
          content: 'Medium quality content',
          similarity: 0.7,
          document: { title: 'Medium Quality Document', category: 'methodologies' },
        },
      ]);
      
      const response = await agent.process(mockInput, mockContext);
      
      expect(response.ragMetadata?.qualityScore).toBe(0.8); // Average of 0.9 and 0.7
    });
  });

  describe('Life Area Detection', () => {
    it('should detect career-related queries', async () => {
      const careerInput = {
        ...mockInput,
        mentalState: 'I am having workplace issues with my job and need career guidance',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(careerInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.lifeArea).toBe('career');
    });

    it('should detect relationship-related queries', async () => {
      const relationshipInput = {
        ...mockInput,
        mentalState: 'I am having problems with my partner and family relationships',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(relationshipInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.lifeArea).toBe('relationships');
    });

    it('should detect health-related queries', async () => {
      const healthInput = {
        ...mockInput,
        mentalState: 'I am concerned about my physical health and fitness levels',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(healthInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.lifeArea).toBe('health');
    });
  });

  describe('Complexity Level Detection', () => {
    it('should detect beginner level queries', async () => {
      const beginnerInput = {
        ...mockInput,
        mentalState: 'I am new to this and need basic help with simple goal setting',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(beginnerInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.complexityLevel).toBe('beginner');
    });

    it('should detect advanced level queries', async () => {
      const advancedInput = {
        ...mockInput,
        mentalState: 'I need sophisticated and comprehensive strategies for complex personal transformation',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(advancedInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.complexityLevel).toBe('advanced');
    });

    it('should default to intermediate level', async () => {
      const neutralInput = {
        ...mockInput,
        mentalState: 'I need help with managing my daily routines',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(neutralInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.complexityLevel).toBe('intermediate');
    });
  });

  describe('Goal Extraction', () => {
    it('should extract goals from user input', async () => {
      const goalInput = {
        ...mockInput,
        mentalState: 'I want to improve my productivity and need to develop better habits',
        recentChanges: 'I am trying to establish a morning routine',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(goalInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.currentGoals).toBeDefined();
      expect(ragContext.currentGoals!.length).toBeGreaterThan(0);
    });

    it('should limit goals to maximum of 3', async () => {
      const multiGoalInput = {
        ...mockInput,
        mentalState: 'I want to improve my health, I need to advance my career, I want to better relationships, I hope to learn new skills, I am trying to save money',
      };
      
      const { DomainAdapterFactory } = require('../../../services/rag/domain-adapter.service');
      const mockAdapter = DomainAdapterFactory.getAdapter();
      
      await agent.process(multiGoalInput, mockContext);
      
      expect(mockAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];
      
      expect(ragContext.currentGoals).toBeDefined();
      expect(ragContext.currentGoals!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Custom Agent Implementation', () => {
    it('should call customizeRAGContext method', async () => {
      const customizeSpy = jest.spyOn(agent, 'customizeRAGContext' as any);
      
      await agent.process(mockInput, mockContext);
      
      expect(customizeSpy).toHaveBeenCalled();
    });

    it('should call filterKnowledgeForRole method', async () => {
      const { ragFoundationService } = require('../../../services/rag/rag-foundation.service');
      ragFoundationService.semanticSearch.mockResolvedValue([
        {
          id: '1',
          content: 'Test content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
        },
      ]);
      
      const filterSpy = jest.spyOn(agent, 'filterKnowledgeForRole' as any);
      
      await agent.process(mockInput, mockContext);
      
      expect(filterSpy).toHaveBeenCalled();
    });
  });
});