import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import { createLogger } from '../../utils/logger';
import { supabaseConfig, ragConfig } from '../../config/index';
import { 
  Database, 
  SearchResult, 
  EmbeddingResult, 
  RAGConfiguration,
  EmbeddingError,
  SearchError,
  RAGError,
  SemanticSearchResult,
  TextSearchResult,
  DomainStats
} from '../../types/database';

/**
 * RAG Foundation Service - Core RAG infrastructure with Supabase+pgvector
 * 
 * Features:
 * - Persistent vector storage with pgvector
 * - Semantic search with cosine similarity
 * - Hybrid search (semantic + full-text)
 * - Embedding generation with @xenova/transformers
 * - Multi-domain support with tenant isolation
 * - Performance monitoring and caching
 * - Graceful error handling and fallbacks
 */
export class RAGFoundationService {
  private supabase: SupabaseClient<Database>;
  private embeddingPipeline: any | null = null;
  private config: RAGConfiguration;
  private logger = createLogger('RAGFoundation');
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<RAGConfiguration> = {}) {
    this.config = {
      enabled: ragConfig.enabled,
      hybridSearchEnabled: ragConfig.hybridSearchEnabled,
      embeddingModel: ragConfig.embeddingModel,
      maxResults: ragConfig.maxResults,
      minRelevanceScore: ragConfig.minRelevanceScore,
      collectionPrefix: ragConfig.collectionPrefix,
      cacheTTL: 3600, // 1 hour
      retryAttempts: 3,
      timeoutMs: 30000, // 30 seconds
      ...config,
    };

    // Initialize Supabase client
    if (!supabaseConfig.url || !supabaseConfig.serviceKey) {
      throw new RAGError(
        'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY',
        'SUPABASE_CONFIG_ERROR'
      );
    }

    this.supabase = createClient<Database>(
      supabaseConfig.url,
      supabaseConfig.serviceKey,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            'X-Client-Info': 'ai-mental-wellbeing-rag-foundation',
          },
        },
        db: {
          schema: 'public',
        },
      }
    );

    this.logger.info('RAG Foundation Service created', {
      enabled: this.config.enabled,
      embeddingModel: this.config.embeddingModel,
      maxResults: this.config.maxResults,
    });
  }

  /**
   * Initialize the RAG Foundation service
   * - Loads embedding model
   * - Verifies database connection
   * - Sets up performance monitoring
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('RAG Foundation disabled via configuration');
      this.isInitialized = true;
      return;
    }

    try {
      this.logger.info('Initializing RAG Foundation service...');
      const startTime = Date.now();

      // Initialize embedding pipeline
      this.logger.info('Loading embedding model...', {
        model: this.config.embeddingModel,
      });
      
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.config.embeddingModel
      );

      // Test database connection
      await this.healthCheck();

      const initTime = Date.now() - startTime;
      this.logger.info('RAG Foundation initialized successfully', {
        initializationTime: initTime,
        model: this.config.embeddingModel,
      });

      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize RAG Foundation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new RAGError(
        `RAG Foundation initialization failed: ${error}`,
        'INITIALIZATION_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Generate embedding for a given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.config.enabled) {
      throw new EmbeddingError('RAG Foundation is disabled');
    }

    if (!this.embeddingPipeline) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Preprocess text for optimal embedding generation
      const cleanText = this.preprocessText(text);
      
      // Generate embedding
      const output = await this.embeddingPipeline!(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to array and ensure proper format
      const embedding = Array.from(output.data as Float32Array);
      
      // Validate embedding dimensions
      if (embedding.length !== 384) {
        throw new EmbeddingError(
          `Invalid embedding dimensions: expected 384, got ${embedding.length}`
        );
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug('Embedding generated successfully', {
        textLength: text.length,
        processingTime,
        dimensions: embedding.length,
      });

      return embedding;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Embedding generation failed', {
        textLength: text.length,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error instanceof EmbeddingError) {
        throw error;
      }
      
      throw new EmbeddingError(
        `Failed to generate embedding: ${error}`,
        { originalError: error, textLength: text.length }
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(
    texts: string[],
    progressCallback?: (processed: number, total: number) => void
  ): Promise<EmbeddingResult[]> {
    if (!this.config.enabled) {
      throw new EmbeddingError('RAG Foundation is disabled');
    }

    const startTime = Date.now();
    const results: EmbeddingResult[] = [];
    const batchSize = 16; // Process in batches to avoid memory issues

    try {
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (text, index) => {
          const embedding = await this.generateEmbedding(text);
          return {
            text,
            embedding,
            metadata: {
              batchIndex: Math.floor((i + index) / batchSize),
              globalIndex: i + index,
              textLength: text.length,
              timestamp: new Date().toISOString(),
            },
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (progressCallback) {
          progressCallback(results.length, texts.length);
        }

        // Add small delay to prevent overwhelming the system
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Batch embedding generation completed', {
        totalTexts: texts.length,
        processingTime,
        averageTimePerText: processingTime / texts.length,
      });

      return results;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Batch embedding generation failed', {
        totalTexts: texts.length,
        processedTexts: results.length,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new EmbeddingError(
        `Batch embedding generation failed: ${error}`,
        { originalError: error, processedCount: results.length }
      );
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  async semanticSearch(
    domainId: string,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      categories?: string[];
      includeMetadata?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const startTime = Date.now();
    const searchOptions = {
      limit: options.limit || this.config.maxResults,
      threshold: options.threshold || this.config.minRelevanceScore,
      categories: options.categories,
      includeMetadata: options.includeMetadata ?? true,
    };

    try {
      this.logger.debug('Starting semantic search', {
        domainId,
        query: query.substring(0, 100),
        ...searchOptions,
      });

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Execute semantic search
      const { data, error } = await this.supabase
        .rpc('semantic_search', {
          query_embedding: queryEmbedding,
          match_threshold: searchOptions.threshold,
          match_count: searchOptions.limit,
          domain_filter: domainId,
          category_filter: searchOptions.categories?.[0] || null,
        });

      if (error) {
        throw new SearchError(`Semantic search failed: ${error.message}`, {
          code: error.code,
          details: error.details,
        });
      }

      // Format results
      const results = this.formatSearchResults(data || []);
      
      const searchTime = Date.now() - startTime;
      this.logger.info('Semantic search completed', {
        domainId,
        queryLength: query.length,
        resultsCount: results.length,
        searchTime,
        averageRelevance: results.reduce((sum, r) => sum + r.similarity, 0) / results.length,
      });

      return results;
    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.logger.error('Semantic search failed', {
        domainId,
        queryLength: query.length,
        searchTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error instanceof SearchError) {
        throw error;
      }
      
      throw new SearchError(
        `Semantic search failed: ${error}`,
        { originalError: error, domainId, queryLength: query.length }
      );
    }
  }

  /**
   * Perform hybrid search (semantic + full-text)
   */
  async hybridSearch(
    domainId: string,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      categories?: string[];
      rrfK?: number;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.config.enabled || !this.config.hybridSearchEnabled) {
      return this.semanticSearch(domainId, query, options);
    }

    const startTime = Date.now();
    const searchOptions = {
      limit: options.limit || this.config.maxResults,
      threshold: options.threshold || this.config.minRelevanceScore,
      categories: options.categories,
      rrfK: options.rrfK || 60,
    };

    try {
      this.logger.debug('Starting hybrid search', {
        domainId,
        query: query.substring(0, 100),
        ...searchOptions,
      });

      // Execute semantic and text search in parallel
      const [semanticResults, textResults] = await Promise.all([
        this.semanticSearch(domainId, query, {
          limit: searchOptions.limit * 2,
          threshold: searchOptions.threshold * 0.8, // Lower threshold for semantic
          ...(searchOptions.categories && { categories: searchOptions.categories }),
        }),
        this.textSearch(domainId, query, {
          limit: searchOptions.limit * 2,
          ...(searchOptions.categories && { categories: searchOptions.categories }),
        }),
      ]);

      // Apply Reciprocal Rank Fusion (RRF)
      const fusedResults = this.applyRRF(
        semanticResults,
        textResults,
        searchOptions.rrfK
      );

      const results = fusedResults.slice(0, searchOptions.limit);
      
      const searchTime = Date.now() - startTime;
      this.logger.info('Hybrid search completed', {
        domainId,
        queryLength: query.length,
        semanticResults: semanticResults.length,
        textResults: textResults.length,
        finalResults: results.length,
        searchTime,
      });

      return results;
    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.logger.error('Hybrid search failed', {
        domainId,
        queryLength: query.length,
        searchTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Fallback to semantic search only
      this.logger.warn('Falling back to semantic search only');
      return this.semanticSearch(domainId, query, options);
    }
  }

  /**
   * Perform full-text search
   */
  private async textSearch(
    domainId: string,
    query: string,
    options: {
      limit?: number;
      categories?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    const searchOptions = {
      limit: options.limit || this.config.maxResults,
      categories: options.categories,
    };

    const { data, error } = await this.supabase
      .rpc('text_search', {
        search_query: query,
        match_count: searchOptions.limit,
        domain_filter: domainId,
        category_filter: searchOptions.categories?.[0] || null,
      });

    if (error) {
      throw new SearchError(`Text search failed: ${error.message}`, {
        code: error.code,
        details: error.details,
      });
    }

    return this.formatSearchResults(data || []);
  }

  /**
   * Get domain statistics
   */
  async getDomainStats(domainId: string): Promise<DomainStats> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_domain_stats', { domain_uuid: domainId });

      if (error) {
        throw new RAGError(`Failed to get domain stats: ${error.message}`, 'STATS_ERROR');
      }

      return (data && data.length > 0) ? data[0] : {
        total_documents: 0,
        total_embeddings: 0,
        total_conversations: 0,
        avg_processing_time: 0,
        rag_usage_rate: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get domain stats', {
        domainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Health check for RAG Foundation service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      const { error } = await this.supabase
        .from('domains')
        .select('id')
        .limit(1);

      if (error) {
        this.logger.error('Database health check failed', { error: error.message });
        return false;
      }

      // Test embedding generation if enabled
      if (this.config.enabled && this.embeddingPipeline) {
        await this.generateEmbedding('health check test');
      }

      return true;
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Format search results from database response
   */
  private formatSearchResults(rawResults: (SemanticSearchResult | TextSearchResult)[]): SearchResult[] {
    return rawResults.map(row => ({
      id: row.id,
      content: row.chunk_content,
      similarity: row.similarity,
      metadata: row.metadata || {},
      document: {
        id: row.document_id,
        title: row.document_title,
        category: row.document_category,
        author: row.document_author,
      },
      chunk_index: row.chunk_index,
    }));
  }

  /**
   * Apply Reciprocal Rank Fusion to combine semantic and text search results
   */
  private applyRRF(
    semanticResults: SearchResult[],
    textResults: SearchResult[],
    k: number
  ): SearchResult[] {
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    // Add semantic results with RRF scoring
    semanticResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      scoreMap.set(result.id, {
        result: { ...result, similarity: result.similarity * 0.7 }, // Weight semantic higher
        score: rrfScore,
      });
    });

    // Add text results with RRF scoring
    textResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(result.id);

      if (existing) {
        existing.score += rrfScore;
        // Combine similarity scores
        existing.result.similarity = Math.max(
          existing.result.similarity,
          result.similarity * 0.3
        );
      } else {
        scoreMap.set(result.id, {
          result: { ...result, similarity: result.similarity * 0.3 }, // Weight text lower
          score: rrfScore,
        });
      }
    });

    // Sort by combined RRF score and return results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.result);
  }

  /**
   * Preprocess text for optimal embedding generation
   */
  private preprocessText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,!?;:()]/g, '') // Remove special characters
      .trim()
      .substring(0, 512); // Limit length for embedding model
  }

  /**
   * Get service configuration
   */
  getConfiguration(): RAGConfiguration {
    return { ...this.config };
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const ragFoundationService = new RAGFoundationService();