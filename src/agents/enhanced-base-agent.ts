import { Agent, AgentContext, AgentResponse, UserInput } from '../types/index';
import { BaseAgent } from './base-agent';
import { ragFoundationService } from '../services/rag/rag-foundation.service';
import { DomainAdapterFactory } from '../services/rag/domain-adapter.service';
import { featureFlagService } from '../services/feature-flag.service';
import { createLogger } from '../utils/logger';

/**
 * Enhanced Base Agent - RAG-enabled extension of BaseAgent
 * 
 * Features:
 * - RAG-enhanced context generation
 * - Domain-specific knowledge retrieval
 * - Adaptive personalization based on user profile
 * - Graceful fallback to standard agent behavior
 * - Performance monitoring and optimization
 * - Zero-disruption integration with existing agents
 */

export interface RAGContext {
  domainId: string;
  preferredMethodology?: string;
  lifeArea?: string;
  complexityLevel?: 'beginner' | 'intermediate' | 'advanced';
  currentGoals?: string[];
  sessionHistory?: string[];
  userProfile?: Record<string, any>;
}

export interface EnhancedAgentResponse extends AgentResponse {
  ragMetadata?: {
    useRag: boolean;
    queryEnhanced?: boolean;
    knowledgeUsed?: boolean;
    domainSpecific?: boolean;
    contextualFactors?: string[];
    qualityScore?: number;
    sources?: any[];
    fallbackReason?: string;
    searchResults?: any[];
    retrievalTime?: number;
    agentVersions?: Record<string, string>;
    ragQuality?: {
      relevance: number;
      completeness: number;
      accuracy: number;
      threshold: number;
    };
    threshold?: number;
  };
}

export interface RAGPerformanceMetrics {
  retrievalLatency: number;
  contextEnhancementTime: number;
  totalProcessingTime: number;
  searchResultsCount: number;
  relevanceScore: number;
  cacheHitRate: number;
}

/**
 * Enhanced Base Agent with RAG capabilities
 */
export abstract class EnhancedBaseAgent extends BaseAgent {
  protected readonly ragLogger = createLogger(`${this.constructor.name}-RAG`);
  protected readonly defaultDomainId = 'life_coaching';
  protected readonly ragEnabled: boolean;
  protected readonly hybridSearchEnabled: boolean;
  protected readonly performanceMonitoring: boolean;

  constructor(
    name: string,
    role: string,
    systemMessage: string,
    options: {
      domainId?: string;
      ragEnabled?: boolean;
      hybridSearchEnabled?: boolean;
      performanceMonitoring?: boolean;
      focusArea?: string;
    } = {}
  ) {
    super(name, role, systemMessage);
    
    this.ragEnabled = options.ragEnabled ?? true;
    this.hybridSearchEnabled = options.hybridSearchEnabled ?? true;
    this.performanceMonitoring = options.performanceMonitoring ?? true;
    
    this.ragLogger.info('Enhanced agent initialized', {
      agentName: this.name,
      ragEnabled: this.ragEnabled,
      hybridSearchEnabled: this.hybridSearchEnabled,
      performanceMonitoring: this.performanceMonitoring,
    });
  }

  /**
   * Enhanced process method with RAG integration
   */
  async process(input: UserInput, context?: AgentContext): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();
    let ragMetadata: EnhancedAgentResponse['ragMetadata'] = {
      useRag: false,
      searchResults: [],
      retrievalTime: 0,
      qualityScore: 0,
      sources: [],
    };

    try {
      // Check if RAG is enabled via feature flags
      const shouldUseRag = await this.shouldUseRAG(context);
      
      if (shouldUseRag) {
        this.ragLogger.info('Processing with RAG enhancement', {
          agentName: this.name,
          sessionId: context?.sessionId,
        });

        // Enhanced processing with RAG
        const enhancedResponse = await this.processWithRAG(input, context, startTime);
        ragMetadata = enhancedResponse.ragMetadata || ragMetadata;
        
        return enhancedResponse;
      } else {
        // Standard processing without RAG
        this.ragLogger.info('Processing without RAG (disabled or fallback)', {
          agentName: this.name,
          sessionId: context?.sessionId,
          reason: ragMetadata?.fallbackReason || 'RAG disabled',
        });
        
        const standardResponse = await this.processStandard(input, context);
        if (ragMetadata) {
          ragMetadata.fallbackReason = 'RAG disabled or not available';
        }
        
        return {
          ...standardResponse,
          ragMetadata,
        };
      }
    } catch (error) {
      this.ragLogger.error('Enhanced processing failed, falling back to standard', {
        agentName: this.name,
        sessionId: context?.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to standard processing
      const fallbackResponse = await this.processStandard(input, context);
      if (ragMetadata) {
        ragMetadata.fallbackReason = `Error in RAG processing: ${error}`;
      }
      
      return {
        ...fallbackResponse,
        ragMetadata,
      };
    }
  }

  /**
   * Process with RAG enhancement
   */
  protected async processWithRAG(
    input: UserInput,
    context: AgentContext | undefined,
    startTime: number
  ): Promise<EnhancedAgentResponse> {
    const retrievalStartTime = Date.now();
    
    try {
      // Extract RAG context from user input and agent context
      const ragContext = this.extractRAGContext(input, context);
      
      // Retrieve relevant knowledge
      const knowledgeResults = await this.retrieveKnowledge(input, ragContext);
      
      const retrievalTime = Date.now() - retrievalStartTime;
      
      // Enhance system message with retrieved knowledge
      const enhancedSystemMessage = this.enhanceSystemMessage(
        this.systemMessage,
        knowledgeResults.results,
        ragContext
      );
      
      // Generate enhanced user message
      const enhancedUserMessage = this.enhanceUserMessage(
        input,
        context,
        knowledgeResults.results,
        ragContext
      );
      
      // Generate AI response with enhanced context
      const aiResponse = await this.generateEnhancedAIResponse(
        enhancedSystemMessage,
        enhancedUserMessage,
        context
      );
      
      // Create agent response with recommendations
      const recommendations = this.extractRecommendations(aiResponse);
      const agentResponse = this.createBaseResponse(aiResponse, recommendations);
      
      // Extract sources from knowledge results
      const sources = knowledgeResults.results.map(result => 
        `${result.document.title} (${result.document.category})`
      );
      
      const totalTime = Date.now() - startTime;
      
      this.ragLogger.info('RAG-enhanced processing completed', {
        agentName: this.name,
        retrievalTime,
        totalTime,
        searchResults: knowledgeResults.results.length,
        qualityScore: knowledgeResults.qualityScore,
        sources: sources.length,
      });
      
      return {
        ...agentResponse,
        ragMetadata: {
          useRag: true,
          searchResults: knowledgeResults.results || [],
          retrievalTime,
          qualityScore: knowledgeResults.qualityScore,
          sources,
        },
      };
    } catch (error) {
      this.ragLogger.error('RAG processing failed', {
        agentName: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error; // Re-throw to trigger fallback
    }
  }

  /**
   * Standard processing without RAG
   */
  protected async processStandard(
    input: UserInput,
    context?: AgentContext
  ): Promise<AgentResponse> {
    const aiResponse = await this.generateAIResponse(input, context);
    const recommendations = this.extractRecommendations(aiResponse);
    return this.createBaseResponse(aiResponse, recommendations);
  }

  /**
   * Determine if RAG should be used
   */
  protected async shouldUseRAG(context?: AgentContext): Promise<boolean> {
    try {
      // Check if RAG is enabled globally
      if (!this.ragEnabled) {
        return false;
      }

      // Check RAG feature flag
      const ragFeatureEnabled = await featureFlagService.isEnabled(
        'rag_enhancement',
        {
          userId: context?.userId,
          sessionId: context?.sessionId,
        }
      );

      if (!ragFeatureEnabled) {
        return false;
      }

      // Check if RAG foundation service is available and healthy
      if (!ragFoundationService.isEnabled() || !ragFoundationService.isReady()) {
        return false;
      }

      // Additional checks can be added here (e.g., domain availability, user preferences)
      
      return true;
    } catch (error) {
      this.ragLogger.warn('Error checking RAG availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Extract RAG context from user input and agent context
   */
  protected extractRAGContext(
    input: UserInput,
    context?: AgentContext
  ): RAGContext {
    const ragContext: RAGContext = {
      domainId: this.defaultDomainId,
      sessionHistory: [],
      userProfile: {},
    };

    // Extract life area from user input
    if (input.mentalState) {
      ragContext.lifeArea = this.detectLifeAreaFromInput(input);
    }

    // Extract complexity level based on user communication
    ragContext.complexityLevel = this.detectComplexityLevel(input);

    // Extract current goals if mentioned
    ragContext.currentGoals = this.extractGoalsFromInput(input);

    // Add session history if available
    if (context?.previousResponses) {
      ragContext.sessionHistory = context.previousResponses.map(
        response => `${response.agentName}: ${response.content.substring(0, 200)}...`
      );
    }

    // Add user profile information
    if (context?.userId) {
      ragContext.userProfile = {
        userId: context.userId,
        sessionId: context.sessionId,
        // Additional user profile data can be added here
      };
    }

    return ragContext;
  }

  /**
   * Retrieve relevant knowledge from RAG system
   */
  protected async retrieveKnowledge(
    input: UserInput,
    ragContext: RAGContext
  ): Promise<{
    results: any[];
    qualityScore: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Create search query from user input
      const searchQuery = this.createSearchQuery(input, ragContext);
      
      // Get domain adapter
      const domainAdapter = DomainAdapterFactory.getAdapter(ragContext.domainId);
      
      // Enhance query with domain knowledge
      const enhancedQuery = domainAdapter.enhanceQuery(searchQuery, {
        sessionId: ragContext.userProfile?.sessionId || 'unknown',
        userId: ragContext.userProfile?.userId,
        preferredMethodology: ragContext.preferredMethodology,
        lifeArea: ragContext.lifeArea,
        complexityLevel: ragContext.complexityLevel,
        currentGoals: ragContext.currentGoals,
        sessionHistory: ragContext.sessionHistory,
        userProfile: ragContext.userProfile,
      });
      
      // Perform search (hybrid if enabled, semantic otherwise)
      const searchResults = this.hybridSearchEnabled
        ? await ragFoundationService.hybridSearch(
            ragContext.domainId,
            enhancedQuery.enhancedQuery,
            {
              limit: 5,
              threshold: 0.6,
            }
          )
        : await ragFoundationService.semanticSearch(
            ragContext.domainId,
            enhancedQuery.enhancedQuery,
            {
              limit: 5,
              threshold: 0.6,
            }
          );

      // Filter and rank results using domain adapter
      const filteredResults = domainAdapter.filterResults(searchResults, {
        sessionId: ragContext.userProfile?.sessionId || 'unknown',
        userId: ragContext.userProfile?.userId,
        preferredMethodology: ragContext.preferredMethodology,
        lifeArea: ragContext.lifeArea,
        complexityLevel: ragContext.complexityLevel,
        currentGoals: ragContext.currentGoals,
        sessionHistory: ragContext.sessionHistory,
        userProfile: ragContext.userProfile,
      });

      const processingTime = Date.now() - startTime;
      
      // Calculate quality score
      const qualityScore = filteredResults.length > 0
        ? filteredResults.reduce((sum, result) => sum + result.similarity, 0) / filteredResults.length
        : 0;

      this.ragLogger.debug('Knowledge retrieval completed', {
        agentName: this.name,
        searchQuery: searchQuery.substring(0, 100),
        enhancedQuery: enhancedQuery.enhancedQuery.substring(0, 100),
        resultsCount: filteredResults.length,
        qualityScore,
        processingTime,
      });

      return {
        results: filteredResults,
        qualityScore,
        processingTime,
      };
    } catch (error) {
      this.ragLogger.error('Knowledge retrieval failed', {
        agentName: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return empty results on failure
      return {
        results: [],
        qualityScore: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create search query from user input
   */
  protected createSearchQuery(input: UserInput, ragContext: RAGContext): string {
    const queryParts: string[] = [];
    
    // Add mental state
    if (input.mentalState) {
      queryParts.push(input.mentalState);
    }
    
    // Add context from symptoms
    if (input.currentSymptoms && input.currentSymptoms.length > 0) {
      queryParts.push(`symptoms: ${input.currentSymptoms.join(', ')}`);
    }
    
    // Add context from recent changes
    if (input.recentChanges) {
      queryParts.push(`recent changes: ${input.recentChanges}`);
    }
    
    // Add stress and sleep context
    if (input.stressLevel > 6) {
      queryParts.push('high stress management');
    }
    
    if (input.sleepPattern < 6) {
      queryParts.push('sleep improvement');
    }
    
    // Add life area context
    if (ragContext.lifeArea) {
      queryParts.push(`${ragContext.lifeArea} improvement`);
    }
    
    // Add current goals
    if (ragContext.currentGoals && ragContext.currentGoals.length > 0) {
      queryParts.push(`goals: ${ragContext.currentGoals.join(', ')}`);
    }
    
    return queryParts.join(' ');
  }

  /**
   * Enhance system message with retrieved knowledge
   */
  protected enhanceSystemMessage(
    originalMessage: string,
    knowledgeResults: any[],
    ragContext: RAGContext
  ): string {
    if (knowledgeResults.length === 0) {
      return originalMessage;
    }

    let enhancedMessage = originalMessage;
    
    // Add knowledge context
    enhancedMessage += '\n\n--- RELEVANT KNOWLEDGE ---\n';
    
    knowledgeResults.forEach((result, index) => {
      enhancedMessage += `\n${index + 1}. ${result.document.title}:\n`;
      enhancedMessage += `${result.content.substring(0, 300)}...\n`;
    });
    
    // Add domain-specific guidance
    if (ragContext.preferredMethodology) {
      enhancedMessage += `\n--- METHODOLOGY GUIDANCE ---\n`;
      enhancedMessage += `Focus on ${ragContext.preferredMethodology} approach when providing recommendations.\n`;
    }
    
    if (ragContext.lifeArea) {
      enhancedMessage += `\n--- LIFE AREA FOCUS ---\n`;
      enhancedMessage += `Pay special attention to ${ragContext.lifeArea} aspects in your response.\n`;
    }
    
    if (ragContext.complexityLevel) {
      enhancedMessage += `\n--- COMPLEXITY LEVEL ---\n`;
      enhancedMessage += `Adjust your response for ${ragContext.complexityLevel} level understanding.\n`;
    }
    
    enhancedMessage += `\n--- INSTRUCTIONS ---\n`;
    enhancedMessage += `Use the above knowledge to provide more specific, evidence-based recommendations. `;
    enhancedMessage += `Reference the knowledge sources when relevant, but maintain your natural conversational style.`;
    
    return enhancedMessage;
  }

  /**
   * Enhance user message with knowledge context
   */
  protected enhanceUserMessage(
    input: UserInput,
    context: AgentContext | undefined,
    knowledgeResults: any[],
    ragContext: RAGContext
  ): string {
    const baseMessage = this.formatUserMessage(input, context);
    
    if (knowledgeResults.length === 0) {
      return baseMessage;
    }

    let enhancedMessage = baseMessage;
    
    // Add knowledge-aware context
    enhancedMessage += `\n\n--- CONTEXT FROM KNOWLEDGE BASE ---\n`;
    enhancedMessage += `Based on the user's situation, the following relevant information was found:\n`;
    
    knowledgeResults.forEach((result, index) => {
      enhancedMessage += `\n${index + 1}. From "${result.document.title}": ${result.content.substring(0, 200)}...\n`;
    });
    
    enhancedMessage += `\nPlease consider this context when providing your response.`;
    
    return enhancedMessage;
  }

  /**
   * Generate AI response with enhanced context
   */
  protected async generateEnhancedAIResponse(
    systemMessage: string,
    userMessage: string,
    context?: AgentContext
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Use the enhanced system message directly
      const response = await this.generateAIResponseWithMessages(systemMessage, userMessage, context);
      
      const duration = Date.now() - startTime;
      this.ragLogger.info('Enhanced AI response generated', {
        agentName: this.name,
        duration,
        responseLength: response.length,
        contextLength: systemMessage.length + userMessage.length,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.ragLogger.error('Enhanced AI response generation failed', {
        agentName: this.name,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate AI response with custom messages
   */
  protected async generateAIResponseWithMessages(
    systemMessage: string,
    userMessage: string,
    context?: AgentContext
  ): Promise<string> {
    // This would use the same OpenAI service but with custom messages
    // For now, we'll use the existing service with enhanced context
    const { openAIService } = require('../services/openai.service');
    
    return await openAIService.generateResponse(
      systemMessage,
      userMessage,
      context ? this.formatContext(context) : undefined
    );
  }

  /**
   * Detect life area from user input
   */
  protected detectLifeAreaFromInput(input: UserInput): string | undefined {
    const content = `${input.mentalState} ${input.currentSymptoms.join(' ')} ${input.recentChanges || ''}`.toLowerCase();
    
    const lifeAreaKeywords = {
      career: ['work', 'job', 'career', 'professional', 'workplace', 'boss', 'colleagues'],
      relationships: ['relationship', 'partner', 'family', 'friends', 'marriage', 'dating', 'social'],
      health: ['health', 'fitness', 'exercise', 'diet', 'wellness', 'medical', 'physical'],
      personal_growth: ['growth', 'development', 'learning', 'skills', 'improvement', 'self'],
      finances: ['money', 'financial', 'budget', 'debt', 'savings', 'investment'],
    };
    
    for (const [area, keywords] of Object.entries(lifeAreaKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return area;
      }
    }
    
    return undefined;
  }

  /**
   * Detect complexity level from user input
   */
  protected detectComplexityLevel(input: UserInput): 'beginner' | 'intermediate' | 'advanced' {
    const content = `${input.mentalState} ${input.currentSymptoms.join(' ')} ${input.recentChanges || ''}`.toLowerCase();
    
    const beginnerKeywords = ['new', 'first time', 'beginning', 'basic', 'simple', 'help me understand'];
    const advancedKeywords = ['complex', 'sophisticated', 'advanced', 'deep', 'comprehensive', 'nuanced'];
    
    const beginnerScore = beginnerKeywords.filter(keyword => content.includes(keyword)).length;
    const advancedScore = advancedKeywords.filter(keyword => content.includes(keyword)).length;
    
    if (beginnerScore > advancedScore) return 'beginner';
    if (advancedScore > beginnerScore) return 'advanced';
    return 'intermediate';
  }

  /**
   * Extract goals from user input
   */
  protected extractGoalsFromInput(input: UserInput): string[] {
    const goals: string[] = [];
    const content = `${input.mentalState} ${input.recentChanges || ''}`.toLowerCase();
    
    const goalKeywords = ['want to', 'need to', 'hoping to', 'trying to', 'goal', 'objective', 'aim'];
    
    for (const keyword of goalKeywords) {
      const index = content.indexOf(keyword);
      if (index !== -1) {
        const goalText = content.substring(index, index + 100);
        const sentences = goalText.split(/[.!?]/);
        if (sentences.length > 0) {
          goals.push(sentences[0].trim());
        }
      }
    }
    
    return goals.slice(0, 3); // Limit to 3 goals
  }

  /**
   * Get RAG performance metrics
   */
  protected getRAGMetrics(ragMetadata: EnhancedAgentResponse['ragMetadata']): RAGPerformanceMetrics | null {
    if (!ragMetadata || !ragMetadata.useRag) {
      return null;
    }

    return {
      retrievalLatency: ragMetadata.retrievalTime || 0,
      contextEnhancementTime: 0, // Would be calculated if we tracked this
      totalProcessingTime: 0, // Would be calculated if we tracked this
      searchResultsCount: ragMetadata.searchResults?.length || 0,
      relevanceScore: ragMetadata.qualityScore || 0,
      cacheHitRate: 0, // Would be calculated if we implemented caching
    };
  }

  /**
   * Abstract method for agent-specific processing
   * This allows each agent to customize their RAG integration
   */
  protected abstract customizeRAGContext(
    ragContext: RAGContext,
    input: UserInput,
    context?: AgentContext
  ): RAGContext;

  /**
   * Abstract method for agent-specific knowledge filtering
   * This allows each agent to filter knowledge based on their role
   */
  protected abstract filterKnowledgeForRole(
    knowledgeResults: any[],
    ragContext: RAGContext
  ): any[];
}