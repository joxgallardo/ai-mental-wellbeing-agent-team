import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../../utils/logger';
import { supabaseConfig } from '../../config/index';
import { ragFoundationService } from './rag-foundation.service';
import { documentProcessorService, DocumentChunk, ProcessingResult } from './document-processor.service';
import { Database, RAGError } from '../../types/database';

/**
 * Knowledge Population Service - Batch processing for RAG knowledge base
 * 
 * Features:
 * - Batch document processing and embedding generation
 * - Supabase integration for persistent storage
 * - Progress tracking and error handling
 * - Duplicate detection and content validation
 * - Domain-specific knowledge organization
 * - Quality-based filtering and ranking
 * - Incremental updates and versioning
 */

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  author?: string;
  source_url?: string;
  methodology?: string;
  life_area?: string;
  complexity_level?: 'beginner' | 'intermediate' | 'advanced';
  evidence_level?: 'research-based' | 'practical' | 'anecdotal';
  tags?: string[];
  metadata?: Record<string, any>;
  version?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PopulationOptions {
  batchSize: number;
  maxConcurrency: number;
  enableDuplicateDetection: boolean;
  minQualityScore: number;
  skipExisting: boolean;
  validateContent: boolean;
  generateEmbeddings: boolean;
  enableProgressTracking: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface PopulationResult {
  total_documents: number;
  processed_documents: number;
  successful_embeddings: number;
  failed_documents: number;
  duplicates_detected: number;
  total_chunks: number;
  processing_time: number;
  quality_report: PopulationQualityReport;
  errors: PopulationError[];
  warnings: PopulationWarning[];
  domain_stats: DomainPopulationStats;
}

export interface PopulationQualityReport {
  average_quality_score: number;
  quality_distribution: Record<string, number>;
  complexity_distribution: Record<string, number>;
  methodology_distribution: Record<string, number>;
  embedding_readiness_rate: number;
  content_coverage: Record<string, number>;
  recommendations: string[];
}

export interface PopulationError {
  document_id: string;
  error_type: 'processing' | 'validation' | 'embedding' | 'storage';
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  timestamp: string;
  retry_count: number;
  stack_trace?: string;
}

export interface PopulationWarning {
  document_id: string;
  warning_type: 'quality' | 'duplicate' | 'metadata' | 'content';
  message: string;
  timestamp: string;
}

export interface DomainPopulationStats {
  domain_id: string;
  total_documents: number;
  total_chunks: number;
  total_embeddings: number;
  categories: Record<string, number>;
  methodologies: Record<string, number>;
  life_areas: Record<string, number>;
  complexity_levels: Record<string, number>;
  average_quality: number;
  last_updated: string;
}

export interface ProgressUpdate {
  stage: 'validation' | 'processing' | 'embedding' | 'storage' | 'complete';
  current: number;
  total: number;
  percentage: number;
  estimated_time_remaining?: number;
  current_document?: string;
  errors_count: number;
  warnings_count: number;
}

/**
 * Knowledge Population Service
 */
export class KnowledgePopulationService {
  private supabase: SupabaseClient<Database>;
  private logger = createLogger('KnowledgePopulation');
  private defaultOptions: PopulationOptions = {
    batchSize: 10,
    maxConcurrency: 3,
    enableDuplicateDetection: true,
    minQualityScore: 0.6,
    skipExisting: true,
    validateContent: true,
    generateEmbeddings: true,
    enableProgressTracking: true,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  constructor(options: Partial<PopulationOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    
    // Initialize Supabase client
    this.supabase = createClient<Database>(
      supabaseConfig.url,
      supabaseConfig.serviceKey,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            'X-Client-Info': 'ai-mental-wellbeing-knowledge-population',
          },
        },
      }
    );

    this.logger.info('Knowledge Population Service initialized', {
      batchSize: this.defaultOptions.batchSize,
      maxConcurrency: this.defaultOptions.maxConcurrency,
      enableDuplicateDetection: this.defaultOptions.enableDuplicateDetection,
    });
  }

  /**
   * Populate knowledge base with documents
   */
  async populateKnowledge(
    domainId: string,
    documents: KnowledgeDocument[],
    options: Partial<PopulationOptions> = {},
    progressCallback?: (progress: ProgressUpdate) => void
  ): Promise<PopulationResult> {
    const startTime = Date.now();
    const populationOptions = { ...this.defaultOptions, ...options };
    const errors: PopulationError[] = [];
    const warnings: PopulationWarning[] = [];
    
    let processedDocuments = 0;
    let successfulEmbeddings = 0;
    let totalChunks = 0;
    let duplicatesDetected = 0;

    try {
      this.logger.info('Starting knowledge population', {
        domainId,
        totalDocuments: documents.length,
        options: populationOptions,
      });

      // Validate domain exists
      await this.validateDomain(domainId);

      // Stage 1: Validation
      if (progressCallback) {
        progressCallback({
          stage: 'validation',
          current: 0,
          total: documents.length,
          percentage: 0,
          errors_count: 0,
          warnings_count: 0,
        });
      }

      const validDocuments = await this.validateDocuments(
        documents,
        populationOptions,
        errors,
        warnings
      );

      // Stage 2: Duplicate detection
      const uniqueDocuments = populationOptions.enableDuplicateDetection
        ? await this.detectDuplicates(domainId, validDocuments, populationOptions, warnings)
        : validDocuments;

      duplicatesDetected = validDocuments.length - uniqueDocuments.length;

      // Stage 3: Batch processing
      const batchResults: ProcessingResult[] = [];
      const batches = this.createBatches(uniqueDocuments, populationOptions.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        if (progressCallback) {
          progressCallback({
            stage: 'processing',
            current: batchIndex * populationOptions.batchSize,
            total: uniqueDocuments.length,
            percentage: (batchIndex / batches.length) * 100,
            errors_count: errors.length,
            warnings_count: warnings.length,
          });
        }

        try {
          const batchProcessingResults = await this.processBatch(
            batch,
            populationOptions,
            errors,
            warnings
          );

          batchResults.push(...batchProcessingResults);
          processedDocuments += batchProcessingResults.length;

          // Add delay between batches to prevent overwhelming the system
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          this.logger.error('Batch processing failed', {
            batchIndex,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          errors.push({
            document_id: `batch_${batchIndex}`,
            error_type: 'processing',
            message: `Batch processing failed: ${error}`,
            severity: 'error',
            timestamp: new Date().toISOString(),
            retry_count: 0,
          });
        }
      }

      // Stage 4: Storage and embedding generation
      if (progressCallback) {
        progressCallback({
          stage: 'storage',
          current: 0,
          total: batchResults.length,
          percentage: 0,
          errors_count: errors.length,
          warnings_count: warnings.length,
        });
      }

      const storageResults = await this.storeProcessedDocuments(
        domainId,
        batchResults,
        populationOptions,
        errors,
        warnings,
        progressCallback
      );

      successfulEmbeddings = storageResults.successful_embeddings;
      totalChunks = storageResults.total_chunks;

      // Stage 5: Generate quality report
      const qualityReport = this.generateQualityReport(batchResults, storageResults);
      
      // Update domain statistics
      await this.updateDomainStats(domainId, batchResults, storageResults);

      const processingTime = Date.now() - startTime;

      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          current: processedDocuments,
          total: documents.length,
          percentage: 100,
          errors_count: errors.length,
          warnings_count: warnings.length,
        });
      }

      this.logger.info('Knowledge population completed', {
        domainId,
        totalDocuments: documents.length,
        processedDocuments,
        successfulEmbeddings,
        totalChunks,
        duplicatesDetected,
        processingTime,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      return {
        total_documents: documents.length,
        processed_documents: processedDocuments,
        successful_embeddings: successfulEmbeddings,
        failed_documents: documents.length - processedDocuments,
        duplicates_detected: duplicatesDetected,
        total_chunks: totalChunks,
        processing_time: processingTime,
        quality_report: qualityReport,
        errors,
        warnings,
        domain_stats: await this.getDomainStats(domainId),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Knowledge population failed', {
        domainId,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new RAGError(
        `Knowledge population failed: ${error}`,
        'POPULATION_ERROR',
        { domainId, processingTime, originalError: error }
      );
    }
  }

  /**
   * Validate documents before processing
   */
  private async validateDocuments(
    documents: KnowledgeDocument[],
    options: PopulationOptions,
    errors: PopulationError[],
    warnings: PopulationWarning[]
  ): Promise<KnowledgeDocument[]> {
    const validDocuments: KnowledgeDocument[] = [];

    for (const document of documents) {
      try {
        // Required fields validation
        if (!document.id || !document.title || !document.content || !document.category) {
          errors.push({
            document_id: document.id || 'unknown',
            error_type: 'validation',
            message: 'Missing required fields (id, title, content, category)',
            severity: 'error',
            timestamp: new Date().toISOString(),
            retry_count: 0,
          });
          continue;
        }

        // Content length validation
        if (document.content.length < 50) {
          warnings.push({
            document_id: document.id,
            warning_type: 'content',
            message: 'Content is very short and may not be useful',
            timestamp: new Date().toISOString(),
          });
        }

        if (document.content.length > 100000) {
          warnings.push({
            document_id: document.id,
            warning_type: 'content',
            message: 'Content is very long and may affect processing performance',
            timestamp: new Date().toISOString(),
          });
        }

        // Quality validation
        if (options.validateContent) {
          const qualityScore = this.assessContentQuality(document.content);
          if (qualityScore < options.minQualityScore) {
            warnings.push({
              document_id: document.id,
              warning_type: 'quality',
              message: `Content quality score (${qualityScore.toFixed(2)}) below threshold (${options.minQualityScore})`,
              timestamp: new Date().toISOString(),
            });
          }
        }

        validDocuments.push(document);
      } catch (error) {
        errors.push({
          document_id: document.id || 'unknown',
          error_type: 'validation',
          message: `Validation failed: ${error}`,
          severity: 'error',
          timestamp: new Date().toISOString(),
          retry_count: 0,
        });
      }
    }

    return validDocuments;
  }

  /**
   * Detect duplicate documents
   */
  private async detectDuplicates(
    domainId: string,
    documents: KnowledgeDocument[],
    options: PopulationOptions,
    warnings: PopulationWarning[]
  ): Promise<KnowledgeDocument[]> {
    const uniqueDocuments: KnowledgeDocument[] = [];
    const seenTitles = new Set<string>();
    const seenHashes = new Set<string>();

    // Get existing documents from database if skipExisting is enabled
    let existingDocuments: string[] = [];
    if (options.skipExisting) {
      try {
        const { data } = await this.supabase
          .from('documents')
          .select('title')
          .eq('domain_id', domainId);
        
        existingDocuments = data?.map(doc => doc.title) || [];
      } catch (error) {
        this.logger.warn('Failed to fetch existing documents', { error });
      }
    }

    for (const document of documents) {
      const titleLower = document.title.toLowerCase();
      const contentHash = this.generateContentHash(document.content);

      // Check for title duplicates
      if (seenTitles.has(titleLower)) {
        warnings.push({
          document_id: document.id,
          warning_type: 'duplicate',
          message: `Duplicate title detected: "${document.title}"`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Check for content duplicates
      if (seenHashes.has(contentHash)) {
        warnings.push({
          document_id: document.id,
          warning_type: 'duplicate',
          message: 'Duplicate content detected',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Check against existing documents
      if (existingDocuments.includes(document.title)) {
        warnings.push({
          document_id: document.id,
          warning_type: 'duplicate',
          message: `Document already exists in database: "${document.title}"`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      seenTitles.add(titleLower);
      seenHashes.add(contentHash);
      uniqueDocuments.push(document);
    }

    return uniqueDocuments;
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of documents
   */
  private async processBatch(
    documents: KnowledgeDocument[],
    options: PopulationOptions,
    errors: PopulationError[],
    warnings: PopulationWarning[]
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const semaphore = new Array(options.maxConcurrency).fill(null);

    const processDocument = async (document: KnowledgeDocument): Promise<void> => {
      let retryCount = 0;
      
      while (retryCount <= options.retryAttempts) {
        try {
          const processingResult = await documentProcessorService.processDocument(
            document.id,
            document.content,
            {
              title: document.title,
              category: document.category,
              author: document.author,
              methodology: document.methodology,
              life_area: document.life_area,
              complexity_level: document.complexity_level,
              evidence_level: document.evidence_level,
              tags: document.tags,
            }
          );

          results.push(processingResult);
          return;
        } catch (error) {
          retryCount++;
          
          if (retryCount > options.retryAttempts) {
            errors.push({
              document_id: document.id,
              error_type: 'processing',
              message: `Processing failed after ${options.retryAttempts} attempts: ${error}`,
              severity: 'error',
              timestamp: new Date().toISOString(),
              retry_count: retryCount - 1,
            });
            return;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, options.retryDelay * retryCount));
        }
      }
    };

    // Process documents with concurrency control
    const promises = documents.map(async (document) => {
      // Wait for available slot
      await Promise.race(semaphore);
      
      // Process document
      const promise = processDocument(document);
      
      // Add to semaphore
      const index = semaphore.findIndex(p => p === null);
      semaphore[index] = promise;
      
      // Clean up when done
      promise.finally(() => {
        semaphore[index] = null;
      });
      
      return promise;
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Store processed documents and generate embeddings
   */
  private async storeProcessedDocuments(
    domainId: string,
    results: ProcessingResult[],
    options: PopulationOptions,
    errors: PopulationError[],
    warnings: PopulationWarning[],
    progressCallback?: (progress: ProgressUpdate) => void
  ): Promise<{ successful_embeddings: number; total_chunks: number }> {
    let successfulEmbeddings = 0;
    let totalChunks = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      if (progressCallback) {
        progressCallback({
          stage: 'storage',
          current: i,
          total: results.length,
          percentage: (i / results.length) * 100,
          errors_count: errors.length,
          warnings_count: warnings.length,
        });
      }

      try {
        // Store document
        const { data: documentData, error: documentError } = await this.supabase
          .from('documents')
          .insert({
            domain_id: domainId,
            title: result.chunks[0]?.metadata.title || 'Untitled',
            content: result.chunks.map(chunk => chunk.content).join('\n\n'),
            category: result.chunks[0]?.metadata.category || 'general',
            author: result.chunks[0]?.metadata.author || null,
            metadata: {
              processing_time: result.processing_time,
              quality_score: result.quality_report.overall_score,
              total_chunks: result.chunks.length,
              methodology: result.chunks[0]?.metadata.methodology,
              life_area: result.chunks[0]?.metadata.life_area,
              complexity_level: result.chunks[0]?.metadata.complexity_level,
              evidence_level: result.chunks[0]?.metadata.evidence_level,
              tags: result.chunks[0]?.metadata.tags,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (documentError) {
          throw new Error(`Document storage failed: ${documentError.message}`);
        }

        // Store chunks and generate embeddings
        for (const chunk of result.chunks) {
          if (!chunk.embedding_ready) {
            warnings.push({
              document_id: documentData.id,
              warning_type: 'quality',
              message: `Chunk ${chunk.index} not ready for embedding`,
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          try {
            // Generate embedding if enabled
            let embedding: number[] | null = null;
            if (options.generateEmbeddings) {
              embedding = await ragFoundationService.generateEmbedding(chunk.content);
            }

            // Store chunk with embedding
            const { error: chunkError } = await this.supabase
              .from('document_embeddings')
              .insert({
                document_id: documentData.id,
                chunk_index: chunk.index,
                chunk_content: chunk.content,
                embedding: embedding,
                metadata: chunk.metadata,
                quality_score: chunk.quality_score,
                word_count: chunk.word_count,
                created_at: new Date().toISOString(),
              });

            if (chunkError) {
              throw new Error(`Chunk storage failed: ${chunkError.message}`);
            }

            if (embedding) {
              successfulEmbeddings++;
            }
            totalChunks++;
          } catch (error) {
            errors.push({
              document_id: documentData.id,
              error_type: 'embedding',
              message: `Chunk embedding failed: ${error}`,
              severity: 'warning',
              timestamp: new Date().toISOString(),
              retry_count: 0,
            });
          }
        }
      } catch (error) {
        errors.push({
          document_id: `result_${i}`,
          error_type: 'storage',
          message: `Document storage failed: ${error}`,
          severity: 'error',
          timestamp: new Date().toISOString(),
          retry_count: 0,
        });
      }
    }

    return { successful_embeddings: successfulEmbeddings, total_chunks: totalChunks };
  }

  /**
   * Generate quality report
   */
  private generateQualityReport(
    results: ProcessingResult[],
    storageResults: { successful_embeddings: number; total_chunks: number }
  ): PopulationQualityReport {
    const qualityScores = results.flatMap(result => 
      result.chunks.map(chunk => chunk.quality_score)
    );
    
    const complexityLevels = results.flatMap(result => 
      result.chunks.map(chunk => chunk.metadata.complexity_level || 'unknown')
    );
    
    const methodologies = results.flatMap(result => 
      result.chunks.map(chunk => chunk.metadata.methodology || 'unknown')
    );

    const averageQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

    // Calculate distributions
    const qualityDistribution = this.calculateDistribution(qualityScores, 0.1);
    const complexityDistribution = this.calculateCategoryDistribution(complexityLevels);
    const methodologyDistribution = this.calculateCategoryDistribution(methodologies);

    // Calculate embedding readiness rate
    const embeddingReadinessRate = storageResults.successful_embeddings / storageResults.total_chunks;

    // Generate recommendations
    const recommendations: string[] = [];
    if (averageQualityScore < 0.7) {
      recommendations.push('Consider improving content quality before population');
    }
    if (embeddingReadinessRate < 0.8) {
      recommendations.push('Many chunks are not ready for embedding - review content structure');
    }
    if (complexityDistribution.unknown > 0.3) {
      recommendations.push('Consider adding complexity level metadata to improve categorization');
    }

    return {
      average_quality_score: averageQualityScore,
      quality_distribution: qualityDistribution,
      complexity_distribution: complexityDistribution,
      methodology_distribution: methodologyDistribution,
      embedding_readiness_rate: embeddingReadinessRate,
      content_coverage: {}, // Placeholder for content coverage analysis
      recommendations,
    };
  }

  /**
   * Calculate distribution for numerical values
   */
  private calculateDistribution(values: number[], bucketSize: number): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const value of values) {
      const bucket = Math.floor(value / bucketSize) * bucketSize;
      const key = `${bucket.toFixed(1)}-${(bucket + bucketSize).toFixed(1)}`;
      distribution[key] = (distribution[key] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Calculate distribution for categorical values
   */
  private calculateCategoryDistribution(values: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const value of values) {
      distribution[value] = (distribution[value] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Update domain statistics
   */
  private async updateDomainStats(
    domainId: string,
    results: ProcessingResult[],
    storageResults: { successful_embeddings: number; total_chunks: number }
  ): Promise<void> {
    try {
      const stats = await this.calculateDomainStats(domainId, results, storageResults);
      
      // Update or insert domain stats
      const { error } = await this.supabase
        .from('domain_stats')
        .upsert({
          domain_id: domainId,
          ...stats,
          last_updated: new Date().toISOString(),
        });

      if (error) {
        this.logger.error('Failed to update domain stats', { error });
      }
    } catch (error) {
      this.logger.error('Domain stats calculation failed', { error });
    }
  }

  /**
   * Calculate domain statistics
   */
  private async calculateDomainStats(
    domainId: string,
    results: ProcessingResult[],
    storageResults: { successful_embeddings: number; total_chunks: number }
  ): Promise<Omit<DomainPopulationStats, 'domain_id' | 'last_updated'>> {
    const chunks = results.flatMap(result => result.chunks);
    
    const categories = this.calculateCategoryDistribution(
      chunks.map(chunk => chunk.metadata.category)
    );
    
    const methodologies = this.calculateCategoryDistribution(
      chunks.map(chunk => chunk.metadata.methodology || 'unknown')
    );
    
    const lifeAreas = this.calculateCategoryDistribution(
      chunks.map(chunk => chunk.metadata.life_area || 'unknown')
    );
    
    const complexityLevels = this.calculateCategoryDistribution(
      chunks.map(chunk => chunk.metadata.complexity_level || 'unknown')
    );
    
    const averageQuality = chunks.reduce((sum, chunk) => sum + chunk.quality_score, 0) / chunks.length;

    return {
      total_documents: results.length,
      total_chunks: storageResults.total_chunks,
      total_embeddings: storageResults.successful_embeddings,
      categories,
      methodologies,
      life_areas: lifeAreas,
      complexity_levels: complexityLevels,
      average_quality: averageQuality,
    };
  }

  /**
   * Get domain statistics
   */
  private async getDomainStats(domainId: string): Promise<DomainPopulationStats> {
    try {
      const { data, error } = await this.supabase
        .from('domain_stats')
        .select('*')
        .eq('domain_id', domainId)
        .single();

      if (error || !data) {
        return {
          domain_id: domainId,
          total_documents: 0,
          total_chunks: 0,
          total_embeddings: 0,
          categories: {},
          methodologies: {},
          life_areas: {},
          complexity_levels: {},
          average_quality: 0,
          last_updated: new Date().toISOString(),
        };
      }

      return data as DomainPopulationStats;
    } catch (error) {
      this.logger.error('Failed to get domain stats', { error });
      throw error;
    }
  }

  /**
   * Validate domain exists
   */
  private async validateDomain(domainId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('domains')
        .select('id')
        .eq('id', domainId)
        .single();

      if (error || !data) {
        throw new RAGError(`Domain not found: ${domainId}`, 'DOMAIN_NOT_FOUND');
      }
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(`Domain validation failed: ${error}`, 'DOMAIN_VALIDATION_ERROR');
    }
  }

  /**
   * Generate content hash for duplicate detection
   */
  private generateContentHash(content: string): string {
    // Simple hash function - in production, use a proper hash library
    let hash = 0;
    const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ').trim();
    
    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Assess content quality
   */
  private assessContentQuality(content: string): number {
    let score = 0.5; // Base score

    // Length check
    if (content.length >= 100 && content.length <= 5000) {
      score += 0.2;
    }

    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 3) {
      score += 0.1;
    }

    // Word variety
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const varietyRatio = uniqueWords.size / words.length;
    if (varietyRatio > 0.4) {
      score += 0.1;
    }

    // Professional content indicators
    const professionalWords = ['goal', 'strategy', 'approach', 'method', 'technique', 'process'];
    const professionalScore = professionalWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    score += Math.min(professionalScore * 0.02, 0.1);

    return Math.min(score, 1);
  }

  /**
   * Get service configuration
   */
  getConfiguration(): PopulationOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Get population statistics
   */
  async getPopulationStats(domainId: string): Promise<DomainPopulationStats> {
    return this.getDomainStats(domainId);
  }

  /**
   * Clear domain knowledge (for testing)
   */
  async clearDomainKnowledge(domainId: string): Promise<void> {
    try {
      // Delete embeddings first (due to foreign key constraints)
      await this.supabase
        .from('document_embeddings')
        .delete()
        .in('document_id', 
          this.supabase
            .from('documents')
            .select('id')
            .eq('domain_id', domainId)
        );

      // Delete documents
      await this.supabase
        .from('documents')
        .delete()
        .eq('domain_id', domainId);

      // Delete domain stats
      await this.supabase
        .from('domain_stats')
        .delete()
        .eq('domain_id', domainId);

      this.logger.info('Domain knowledge cleared', { domainId });
    } catch (error) {
      this.logger.error('Failed to clear domain knowledge', { domainId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const knowledgePopulationService = new KnowledgePopulationService();