// Mock logger first to ensure it's hoisted
jest.mock('../../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
}));

import { KnowledgePopulationService, KnowledgeDocument, PopulationOptions } from '../knowledge-population.service';
import { RAGError } from '../../../types/database';

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'test-domain' },
            error: null,
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'test-doc-id' },
            error: null,
          })),
        })),
      })),
      upsert: jest.fn(() => ({
        error: null,
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null,
        })),
        in: jest.fn(() => ({
          error: null,
        })),
      })),
    })),
  })),
}));

jest.mock('../rag-foundation.service', () => ({
  ragFoundationService: {
    generateEmbedding: jest.fn(() => Promise.resolve(new Array(384).fill(0.1))),
  },
}));

jest.mock('../document-processor.service', () => ({
  documentProcessorService: {
    processDocument: jest.fn(() => Promise.resolve({
      chunks: [
        {
          id: 'chunk-1',
          content: 'Test chunk content',
          index: 0,
          metadata: {
            title: 'Test Document',
            category: 'life_coaching',
            author: 'Test Author',
            source_document_id: 'doc-1',
            created_at: '2024-01-01T00:00:00Z',
            chunk_type: 'content',
          },
          quality_score: 0.8,
          word_count: 10,
          char_count: 100,
          embedding_ready: true,
        },
      ],
      metadata: {
        original_length: 100,
        total_chunks: 1,
        average_chunk_size: 100,
        quality_distribution: { '0.8-0.9': 1 },
        complexity_distribution: { intermediate: 1 },
        methodology_distribution: { 'GROW Model': 1 },
      },
      quality_report: {
        overall_score: 0.8,
        content_quality: 0.8,
        structure_quality: 0.8,
        metadata_completeness: 0.8,
        embedding_readiness: 1.0,
        issues: [],
        recommendations: [],
      },
      relationships: [],
      processing_time: 1000,
      errors: [],
    })),
  },
}));

describe('KnowledgePopulationService', () => {
  let service: KnowledgePopulationService;
  let mockSupabase: any;

  const sampleDocuments: KnowledgeDocument[] = [
    {
      id: 'doc-1',
      title: 'Goal Setting Fundamentals',
      content: 'Goal setting is a fundamental skill that enables individuals to achieve their desired outcomes through structured planning and execution.',
      category: 'life_coaching',
      author: 'Test Author',
      methodology: 'GROW Model',
      life_area: 'career',
      complexity_level: 'beginner',
      evidence_level: 'practical',
      tags: ['goal-setting', 'planning', 'achievement'],
    },
    {
      id: 'doc-2',
      title: 'Time Management Strategies',
      content: 'Effective time management requires understanding priorities, eliminating distractions, and creating sustainable systems for productivity.',
      category: 'life_coaching',
      author: 'Test Author',
      methodology: 'Values Clarification',
      life_area: 'productivity',
      complexity_level: 'intermediate',
      evidence_level: 'research-based',
      tags: ['time-management', 'productivity', 'efficiency'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a proper mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            data: [],
            error: null,
          })),
          data: [],
          error: null,
        })),
        insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        update: jest.fn(() => Promise.resolve({ data: null, error: null })),
        delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
        upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };
    
    // Mock the createClient function to return our mock
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabase);
    
    service = new KnowledgePopulationService();
  });

  describe('Constructor', () => {
    it('should create service with default options', () => {
      const newService = new KnowledgePopulationService();
      const config = newService.getConfiguration();
      
      expect(config.batchSize).toBe(10);
      expect(config.maxConcurrency).toBe(3);
      expect(config.enableDuplicateDetection).toBe(true);
      expect(config.minQualityScore).toBe(0.6);
    });

    it('should create service with custom options', () => {
      const customOptions: Partial<PopulationOptions> = {
        batchSize: 20,
        maxConcurrency: 5,
        minQualityScore: 0.8,
        enableDuplicateDetection: false,
      };
      
      const newService = new KnowledgePopulationService(customOptions);
      const config = newService.getConfiguration();
      
      expect(config.batchSize).toBe(20);
      expect(config.maxConcurrency).toBe(5);
      expect(config.minQualityScore).toBe(0.8);
      expect(config.enableDuplicateDetection).toBe(false);
    });
  });

  describe('Knowledge Population', () => {
    it('should populate knowledge successfully', async () => {
      const result = await service.populateKnowledge('test-domain', sampleDocuments);
      
      expect(result.total_documents).toBe(2);
      expect(result.processed_documents).toBe(2);
      expect(result.successful_embeddings).toBe(2);
      expect(result.failed_documents).toBe(0);
      expect(result.duplicates_detected).toBe(0);
      expect(result.total_chunks).toBe(2);
      expect(result.processing_time).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle progress callback', async () => {
      const progressCallback = jest.fn();
      
      await service.populateKnowledge('test-domain', sampleDocuments, {}, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          current: 2,
          total: 2,
          percentage: 100,
        })
      );
    });

    it('should handle custom population options', async () => {
      const customOptions: Partial<PopulationOptions> = {
        batchSize: 1,
        maxConcurrency: 1,
        minQualityScore: 0.5,
        enableDuplicateDetection: false,
        skipExisting: false,
      };
      
      const result = await service.populateKnowledge('test-domain', sampleDocuments, customOptions);
      
      expect(result.processed_documents).toBe(2);
      expect(result.duplicates_detected).toBe(0);
    });

    it('should handle empty document list', async () => {
      const result = await service.populateKnowledge('test-domain', []);
      
      expect(result.total_documents).toBe(0);
      expect(result.processed_documents).toBe(0);
      expect(result.successful_embeddings).toBe(0);
      expect(result.failed_documents).toBe(0);
      expect(result.duplicates_detected).toBe(0);
      expect(result.total_chunks).toBe(0);
    });

    it('should handle domain validation failure', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Domain not found' },
            })),
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;

      await expect(
        service.populateKnowledge('invalid-domain', sampleDocuments)
      ).rejects.toThrow(RAGError);
    });
  });

  describe('Document Validation', () => {
    it('should validate required fields', async () => {
      const invalidDocuments = [
        { id: 'doc-1', title: '', content: 'content', category: 'category' }, // Missing title
        { id: 'doc-2', title: 'title', content: '', category: 'category' }, // Missing content
        { id: 'doc-3', title: 'title', content: 'content', category: '' }, // Missing category
      ] as KnowledgeDocument[];
      
      const result = await service.populateKnowledge('test-domain', invalidDocuments);
      
      expect(result.processed_documents).toBe(0);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0].error_type).toBe('validation');
    });

    it('should warn about short content', async () => {
      const shortContentDoc: KnowledgeDocument = {
        id: 'doc-short',
        title: 'Short Document',
        content: 'Very short content',
        category: 'life_coaching',
      };
      
      const result = await service.populateKnowledge('test-domain', [shortContentDoc]);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].warning_type).toBe('content');
    });

    it('should warn about long content', async () => {
      const longContentDoc: KnowledgeDocument = {
        id: 'doc-long',
        title: 'Long Document',
        content: 'Very long content. '.repeat(10000),
        category: 'life_coaching',
      };
      
      const result = await service.populateKnowledge('test-domain', [longContentDoc]);
      
      expect(result.warnings.some(w => w.warning_type === 'content')).toBe(true);
    });

    it('should validate content quality', async () => {
      const lowQualityDoc: KnowledgeDocument = {
        id: 'doc-low',
        title: 'Low Quality Document',
        content: 'bad content no structure',
        category: 'life_coaching',
      };
      
      const result = await service.populateKnowledge('test-domain', [lowQualityDoc], {
        validateContent: true,
        minQualityScore: 0.8,
      });
      
      expect(result.warnings.some(w => w.warning_type === 'quality')).toBe(true);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate titles', async () => {
      const duplicateDocuments = [
        ...sampleDocuments,
        {
          id: 'doc-3',
          title: 'Goal Setting Fundamentals', // Same title as doc-1
          content: 'Different content about goal setting',
          category: 'life_coaching',
        },
      ] as KnowledgeDocument[];
      
      const result = await service.populateKnowledge('test-domain', duplicateDocuments);
      
      expect(result.duplicates_detected).toBe(1);
      expect(result.warnings.some(w => w.warning_type === 'duplicate')).toBe(true);
    });

    it('should detect duplicate content', async () => {
      const duplicateDocuments = [
        ...sampleDocuments,
        {
          id: 'doc-3',
          title: 'Different Title',
          content: sampleDocuments[0].content, // Same content as doc-1
          category: 'life_coaching',
        },
      ] as KnowledgeDocument[];
      
      const result = await service.populateKnowledge('test-domain', duplicateDocuments);
      
      expect(result.duplicates_detected).toBe(1);
      expect(result.warnings.some(w => w.warning_type === 'duplicate')).toBe(true);
    });

    it('should skip existing documents when enabled', async () => {
      // Mock existing documents
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [{ title: 'Goal Setting Fundamentals' }],
            error: null,
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;

      const result = await service.populateKnowledge('test-domain', sampleDocuments, {
        skipExisting: true,
      });
      
      expect(result.duplicates_detected).toBe(1);
      expect(result.processed_documents).toBe(1);
    });

    it('should not detect duplicates when disabled', async () => {
      const duplicateDocuments = [
        ...sampleDocuments,
        {
          id: 'doc-3',
          title: 'Goal Setting Fundamentals',
          content: 'Different content',
          category: 'life_coaching',
        },
      ] as KnowledgeDocument[];
      
      const result = await service.populateKnowledge('test-domain', duplicateDocuments, {
        enableDuplicateDetection: false,
      });
      
      expect(result.duplicates_detected).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process documents in batches', async () => {
      const manyDocuments = Array.from({ length: 25 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Document ${i}`,
        content: `Content for document ${i}`,
        category: 'life_coaching',
      })) as KnowledgeDocument[];
      
      const result = await service.populateKnowledge('test-domain', manyDocuments, {
        batchSize: 5,
      });
      
      expect(result.total_documents).toBe(25);
      expect(result.processed_documents).toBe(25);
    });

    it('should handle processing errors gracefully', async () => {
      const { documentProcessorService } = require('../document-processor.service');
      documentProcessorService.processDocument
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValue({
          chunks: [{
            id: 'chunk-1',
            content: 'Test chunk',
            index: 0,
            metadata: { title: 'Test', category: 'life_coaching', source_document_id: 'doc', created_at: '2024-01-01T00:00:00Z', chunk_type: 'content' },
            quality_score: 0.8,
            word_count: 10,
            char_count: 100,
            embedding_ready: true,
          }],
          metadata: { original_length: 100, total_chunks: 1, average_chunk_size: 100, quality_distribution: {}, complexity_distribution: {}, methodology_distribution: {} },
          quality_report: { overall_score: 0.8, content_quality: 0.8, structure_quality: 0.8, metadata_completeness: 0.8, embedding_readiness: 1.0, issues: [], recommendations: [] },
          relationships: [],
          processing_time: 1000,
          errors: [],
        });
      
      const result = await service.populateKnowledge('test-domain', sampleDocuments);
      
      expect(result.processed_documents).toBe(1);
      expect(result.failed_documents).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error_type).toBe('processing');
    });

    it('should retry failed processing', async () => {
      const { documentProcessorService } = require('../document-processor.service');
      documentProcessorService.processDocument
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({
          chunks: [{
            id: 'chunk-1',
            content: 'Test chunk',
            index: 0,
            metadata: { title: 'Test', category: 'life_coaching', source_document_id: 'doc', created_at: '2024-01-01T00:00:00Z', chunk_type: 'content' },
            quality_score: 0.8,
            word_count: 10,
            char_count: 100,
            embedding_ready: true,
          }],
          metadata: { original_length: 100, total_chunks: 1, average_chunk_size: 100, quality_distribution: {}, complexity_distribution: {}, methodology_distribution: {} },
          quality_report: { overall_score: 0.8, content_quality: 0.8, structure_quality: 0.8, metadata_completeness: 0.8, embedding_readiness: 1.0, issues: [], recommendations: [] },
          relationships: [],
          processing_time: 1000,
          errors: [],
        });
      
      const result = await service.populateKnowledge('test-domain', [sampleDocuments[0]], {
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      expect(result.processed_documents).toBe(1);
      expect(result.failed_documents).toBe(0);
    });
  });

  describe('Storage and Embedding', () => {
    it('should store documents and generate embeddings', async () => {
      const result = await service.populateKnowledge('test-domain', sampleDocuments, {
        generateEmbeddings: true,
      });
      
      expect(result.successful_embeddings).toBe(2);
      expect(result.total_chunks).toBe(2);
      
      const { ragFoundationService } = require('../rag-foundation.service');
      expect(ragFoundationService.generateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should skip embedding generation when disabled', async () => {
      const result = await service.populateKnowledge('test-domain', sampleDocuments, {
        generateEmbeddings: false,
      });
      
      expect(result.successful_embeddings).toBe(0);
      expect(result.total_chunks).toBe(2);
      
      const { ragFoundationService } = require('../rag-foundation.service');
      expect(ragFoundationService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should handle embedding generation failures', async () => {
      const { ragFoundationService } = require('../rag-foundation.service');
      ragFoundationService.generateEmbedding
        .mockRejectedValueOnce(new Error('Embedding failed'))
        .mockResolvedValueOnce(new Array(384).fill(0.1));
      
      const result = await service.populateKnowledge('test-domain', sampleDocuments);
      
      expect(result.successful_embeddings).toBe(1);
      expect(result.total_chunks).toBe(2);
      expect(result.errors.some(e => e.error_type === 'embedding')).toBe(true);
    });

    it('should handle storage failures', async () => {
      const mockFrom = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { id: 'test-domain' },
                error: null,
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Storage failed' },
              })),
            })),
          })),
        });
      
      mockSupabase.from = mockFrom;
      
      const result = await service.populateKnowledge('test-domain', [sampleDocuments[0]]);
      
      expect(result.errors.some(e => e.error_type === 'storage')).toBe(true);
    });
  });

  describe('Quality Reporting', () => {
    it('should generate quality report', async () => {
      const result = await service.populateKnowledge('test-domain', sampleDocuments);
      
      expect(result.quality_report).toBeDefined();
      expect(result.quality_report.average_quality_score).toBeGreaterThan(0);
      expect(result.quality_report.quality_distribution).toBeDefined();
      expect(result.quality_report.complexity_distribution).toBeDefined();
      expect(result.quality_report.methodology_distribution).toBeDefined();
      expect(result.quality_report.embedding_readiness_rate).toBeGreaterThan(0);
    });

    it('should provide quality recommendations', async () => {
      // Mock low quality results
      const { documentProcessorService } = require('../document-processor.service');
      documentProcessorService.processDocument.mockResolvedValue({
        chunks: [{
          id: 'chunk-1',
          content: 'Test chunk',
          index: 0,
          metadata: { title: 'Test', category: 'life_coaching', source_document_id: 'doc', created_at: '2024-01-01T00:00:00Z', chunk_type: 'content' },
          quality_score: 0.5, // Low quality
          word_count: 10,
          char_count: 100,
          embedding_ready: false, // Not ready
        }],
        metadata: { original_length: 100, total_chunks: 1, average_chunk_size: 100, quality_distribution: {}, complexity_distribution: {}, methodology_distribution: {} },
        quality_report: { overall_score: 0.5, content_quality: 0.5, structure_quality: 0.5, metadata_completeness: 0.5, embedding_readiness: 0.0, issues: [], recommendations: [] },
        relationships: [],
        processing_time: 1000,
        errors: [],
      });
      
      const result = await service.populateKnowledge('test-domain', [sampleDocuments[0]]);
      
      expect(result.quality_report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Domain Statistics', () => {
    it('should get domain statistics', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                domain_id: 'test-domain',
                total_documents: 10,
                total_chunks: 50,
                total_embeddings: 45,
                categories: { life_coaching: 10 },
                methodologies: { 'GROW Model': 5 },
                life_areas: { career: 3, relationships: 2 },
                complexity_levels: { beginner: 4, intermediate: 6 },
                average_quality: 0.8,
                last_updated: '2024-01-01T00:00:00Z',
              },
              error: null,
            })),
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;
      
      const stats = await service.getPopulationStats('test-domain');
      
      expect(stats.domain_id).toBe('test-domain');
      expect(stats.total_documents).toBe(10);
      expect(stats.total_chunks).toBe(50);
      expect(stats.total_embeddings).toBe(45);
      expect(stats.categories.life_coaching).toBe(10);
      expect(stats.average_quality).toBe(0.8);
    });

    it('should handle missing domain stats', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Not found' },
            })),
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;
      
      const stats = await service.getPopulationStats('test-domain');
      
      expect(stats.domain_id).toBe('test-domain');
      expect(stats.total_documents).toBe(0);
      expect(stats.total_chunks).toBe(0);
      expect(stats.total_embeddings).toBe(0);
      expect(stats.average_quality).toBe(0);
    });
  });

  describe('Knowledge Management', () => {
    it('should clear domain knowledge', async () => {
      await service.clearDomainKnowledge('test-domain');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('document_embeddings');
      expect(mockSupabase.from).toHaveBeenCalledWith('documents');
      expect(mockSupabase.from).toHaveBeenCalledWith('domain_stats');
    });

    it('should handle clear knowledge errors', async () => {
      const mockFrom = jest.fn(() => ({
        delete: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({
            error: { message: 'Delete failed' },
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;
      
      await expect(service.clearDomainKnowledge('test-domain')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      // This test ensures robust error handling
      await expect(
        service.populateKnowledge('', sampleDocuments)
      ).rejects.toThrow(RAGError);
    });

    it('should provide detailed error information', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Domain not found' },
            })),
          })),
        })),
      }));
      
      mockSupabase.from = mockFrom;

      try {
        await service.populateKnowledge('invalid-domain', sampleDocuments);
      } catch (error) {
        expect(error).toBeInstanceOf(RAGError);
        expect(error instanceof Error ? error.message : String(error)).toContain('Domain not found');
      }
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = service.getConfiguration();
      
      expect(config.batchSize).toBe(10);
      expect(config.maxConcurrency).toBe(3);
      expect(config.enableDuplicateDetection).toBe(true);
      expect(config.minQualityScore).toBe(0.6);
      expect(config.skipExisting).toBe(true);
      expect(config.validateContent).toBe(true);
      expect(config.generateEmbeddings).toBe(true);
    });
  });
});