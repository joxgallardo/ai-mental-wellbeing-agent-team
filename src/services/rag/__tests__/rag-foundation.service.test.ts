import { RAGFoundationService } from '../rag-foundation.service';
import { ragConfig } from '../../../config/index';
import { EmbeddingError, SearchError, RAGError } from '../../../types/database';

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
}));

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(() => Promise.resolve({
    __call__: jest.fn((_text: string, _options: any) => ({
      data: new Float32Array(384).fill(0.1),
    })),
  })),
}));

describe('RAGFoundationService', () => {
  let ragService: RAGFoundationService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    ragService = new RAGFoundationService({
      enabled: true,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      maxResults: 5,
      minRelevanceScore: 0.6,
    });

    // Get mock supabase instance
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();
  });

  describe('Constructor', () => {
    it('should create instance with default configuration', () => {
      const service = new RAGFoundationService();
      const config = service.getConfiguration();
      
      expect(config.enabled).toBe(ragConfig.enabled);
      expect(config.embeddingModel).toBe(ragConfig.embeddingModel);
      expect(config.maxResults).toBe(ragConfig.maxResults);
      expect(config.minRelevanceScore).toBe(ragConfig.minRelevanceScore);
    });

    it('should create instance with custom configuration', () => {
      const customConfig = {
        enabled: true,
        embeddingModel: 'custom-model',
        maxResults: 10,
        minRelevanceScore: 0.8,
      };
      
      const service = new RAGFoundationService(customConfig);
      const config = service.getConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.embeddingModel).toBe('custom-model');
      expect(config.maxResults).toBe(10);
      expect(config.minRelevanceScore).toBe(0.8);
    });

    it('should throw error when Supabase config is missing', () => {
      // Mock missing config
      jest.mock('../../../config/index', () => ({
        supabaseConfig: {
          url: undefined,
          serviceKey: undefined,
        },
      }));

      expect(() => {
        new RAGFoundationService();
      }).toThrow(RAGError);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully when enabled', async () => {
      await expect(ragService.initialize()).resolves.not.toThrow();
      expect(ragService.isReady()).toBe(true);
    });

    it('should handle initialization when disabled', async () => {
      const disabledService = new RAGFoundationService({ enabled: false });
      await disabledService.initialize();
      expect(disabledService.isReady()).toBe(true);
    });

    it('should handle initialization failure', async () => {
      // Mock pipeline failure
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValueOnce(new Error('Model loading failed'));

      await expect(ragService.initialize()).rejects.toThrow(RAGError);
    });

    it('should only initialize once', async () => {
      const { pipeline } = require('@xenova/transformers');
      
      await ragService.initialize();
      await ragService.initialize();
      
      expect(pipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('Embedding Generation', () => {
    beforeEach(async () => {
      await ragService.initialize();
    });

    it('should generate embedding for text', async () => {
      const text = 'This is a test text for embedding generation';
      const embedding = await ragService.generateEmbedding(text);
      
      expect(embedding).toHaveLength(384);
      expect(embedding).toEqual(expect.arrayContaining([expect.any(Number)]));
    });

    it('should handle empty text', async () => {
      const embedding = await ragService.generateEmbedding('');
      expect(embedding).toHaveLength(384);
    });

    it('should handle long text by truncating', async () => {
      const longText = 'word '.repeat(200); // 1000 characters
      const embedding = await ragService.generateEmbedding(longText);
      expect(embedding).toHaveLength(384);
    });

    it('should throw error when disabled', async () => {
      const disabledService = new RAGFoundationService({ enabled: false });
      
      await expect(disabledService.generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });

    it('should handle embedding generation failure', async () => {
      // Mock pipeline failure
      const { pipeline } = require('@xenova/transformers');
      const mockPipeline = await pipeline();
      mockPipeline.__call__.mockRejectedValueOnce(new Error('Embedding failed'));

      await expect(ragService.generateEmbedding('test')).rejects.toThrow(EmbeddingError);
    });
  });

  describe('Batch Embedding Generation', () => {
    beforeEach(async () => {
      await ragService.initialize();
    });

    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const results = await ragService.generateBatchEmbeddings(texts);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.text).toBe(texts[index]);
        expect(result.embedding).toHaveLength(384);
        expect(result.metadata).toHaveProperty('globalIndex', index);
      });
    });

    it('should handle progress callback', async () => {
      const texts = ['text one', 'text two'];
      const progressCallback = jest.fn();
      
      await ragService.generateBatchEmbeddings(texts, progressCallback);
      
      expect(progressCallback).toHaveBeenCalledWith(1, 2);
      expect(progressCallback).toHaveBeenCalledWith(2, 2);
    });

    it('should handle empty array', async () => {
      const results = await ragService.generateBatchEmbeddings([]);
      expect(results).toHaveLength(0);
    });

    it('should handle batch processing failure', async () => {
      const texts = ['text one', 'text two'];
      const { pipeline } = require('@xenova/transformers');
      const mockPipeline = await pipeline();
      mockPipeline.__call__.mockRejectedValueOnce(new Error('Batch failed'));

      await expect(ragService.generateBatchEmbeddings(texts)).rejects.toThrow(EmbeddingError);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      await ragService.initialize();
    });

    it('should perform semantic search successfully', async () => {
      // Mock successful search response
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            document_id: 'doc1',
            chunk_content: 'Test content',
            similarity: 0.8,
            metadata: {},
            document_title: 'Test Document',
            document_category: 'test',
            document_author: 'Test Author',
            chunk_index: 0,
          },
        ],
        error: null,
      });

      const results = await ragService.semanticSearch('domain-id', 'test query');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: '1',
        content: 'Test content',
        similarity: 0.8,
        document: {
          id: 'doc1',
          title: 'Test Document',
          category: 'test',
          author: 'Test Author',
        },
        chunk_index: 0,
      });
    });

    it('should handle search with custom options', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      await ragService.semanticSearch('domain-id', 'test query', {
        limit: 10,
        threshold: 0.7,
        categories: ['methodology'],
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('semantic_search', {
        query_embedding: expect.any(Array),
        match_threshold: 0.7,
        match_count: 10,
        domain_filter: 'domain-id',
        category_filter: 'methodology',
      });
    });

    it('should return empty array when disabled', async () => {
      const disabledService = new RAGFoundationService({ enabled: false });
      const results = await disabledService.semanticSearch('domain-id', 'test query');
      expect(results).toHaveLength(0);
    });

    it('should handle search database error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      });

      await expect(ragService.semanticSearch('domain-id', 'test query')).rejects.toThrow(SearchError);
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      await ragService.initialize();
    });

    it('should perform hybrid search when enabled', async () => {
      const hybridService = new RAGFoundationService({
        enabled: true,
        hybridSearchEnabled: true,
      });
      await hybridService.initialize();

      // Mock search responses
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [{ id: '1', similarity: 0.9 }], error: null })
        .mockResolvedValueOnce({ data: [{ id: '2', similarity: 0.8 }], error: null });

      await hybridService.hybridSearch('domain-id', 'test query');
      
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('semantic_search', expect.any(Object));
      expect(mockSupabase.rpc).toHaveBeenCalledWith('text_search', expect.any(Object));
    });

    it('should fallback to semantic search when hybrid disabled', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      await ragService.hybridSearch('domain-id', 'test query');
      
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('semantic_search', expect.any(Object));
    });

    it('should handle hybrid search failure with fallback', async () => {
      const hybridService = new RAGFoundationService({
        enabled: true,
        hybridSearchEnabled: true,
      });
      await hybridService.initialize();

      // Mock first call failure, second success
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce({ data: [], error: null });

      const results = await hybridService.hybridSearch('domain-id', 'test query');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Domain Stats', () => {
    it('should get domain statistics', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          total_documents: 10,
          total_embeddings: 50,
          total_conversations: 25,
          avg_processing_time: 150,
          rag_usage_rate: 0.8,
        }],
        error: null,
      });

      const stats = await ragService.getDomainStats('domain-id');
      
      expect(stats).toMatchObject({
        total_documents: 10,
        total_embeddings: 50,
        total_conversations: 25,
        avg_processing_time: 150,
        rag_usage_rate: 0.8,
      });
    });

    it('should handle empty stats response', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const stats = await ragService.getDomainStats('domain-id');
      
      expect(stats).toMatchObject({
        total_documents: 0,
        total_embeddings: 0,
        total_conversations: 0,
        avg_processing_time: 0,
        rag_usage_rate: 0,
      });
    });

    it('should handle stats error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Stats error' },
      });

      await expect(ragService.getDomainStats('domain-id')).rejects.toThrow(RAGError);
    });
  });

  describe('Health Check', () => {
    it('should pass health check when everything is working', async () => {
      await ragService.initialize();
      
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
        }),
      });

      const isHealthy = await ragService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should fail health check on database error', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }),
        }),
      });

      const isHealthy = await ragService.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should fail health check on embedding error', async () => {
      await ragService.initialize();
      
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
        }),
      });

      // Mock embedding failure
      const { pipeline } = require('@xenova/transformers');
      const mockPipeline = await pipeline();
      mockPipeline.__call__.mockRejectedValueOnce(new Error('Embedding failed'));

      const isHealthy = await ragService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = ragService.getConfiguration();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('embeddingModel');
      expect(config).toHaveProperty('maxResults');
      expect(config).toHaveProperty('minRelevanceScore');
    });

    it('should report enabled status', () => {
      expect(ragService.isEnabled()).toBe(true);
    });

    it('should report initialization status', async () => {
      expect(ragService.isReady()).toBe(false);
      await ragService.initialize();
      expect(ragService.isReady()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing embedding model gracefully', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValueOnce(new Error('Model not found'));

      await expect(ragService.initialize()).rejects.toThrow(RAGError);
    });

    it('should handle malformed search responses', async () => {
      await ragService.initialize();
      
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ invalid: 'data' }],
        error: null,
      });

      const results = await ragService.semanticSearch('domain-id', 'test query');
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id');
    });

    it('should handle network timeouts', async () => {
      await ragService.initialize();
      
      mockSupabase.rpc.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(ragService.semanticSearch('domain-id', 'test query')).rejects.toThrow(SearchError);
    });
  });
});