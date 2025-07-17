import { createLogger } from '../../utils/logger';
import { RAGError } from '../../types/database';

/**
 * Document Processor Service - Text chunking and validation for RAG
 * 
 * Features:
 * - Intelligent text chunking with overlap
 * - Document validation and quality scoring
 * - Metadata extraction and standardization
 * - Content preprocessing for embeddings
 * - Batch processing with progress tracking
 * - Error handling and recovery
 */

export interface DocumentChunk {
  id: string;
  content: string;
  index: number;
  metadata: ChunkMetadata;
  quality_score: number;
  word_count: number;
  char_count: number;
  embedding_ready: boolean;
}

export interface ChunkMetadata {
  source_document_id: string;
  title: string;
  category: string;
  author?: string;
  methodology?: string;
  life_area?: string;
  complexity_level?: 'beginner' | 'intermediate' | 'advanced';
  goal_type?: string;
  evidence_level?: 'research-based' | 'practical' | 'anecdotal';
  tags?: string[];
  created_at: string;
  chunk_type: 'content' | 'header' | 'summary' | 'example';
  parent_chunk_id?: string;
  relationships?: ChunkRelationship[];
}

export interface ChunkRelationship {
  related_chunk_id: string;
  relationship_type: 'prerequisite' | 'continuation' | 'example' | 'reference';
  strength: number; // 0-1 relationship strength
}

export interface DocumentProcessingOptions {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  maxChunkSize: number;
  preserveStructure: boolean;
  extractMetadata: boolean;
  validateQuality: boolean;
  minQualityScore: number;
  enableRelationships: boolean;
  customSplitters?: string[];
}

export interface ProcessingResult {
  chunks: DocumentChunk[];
  metadata: ProcessingMetadata;
  quality_report: QualityReport;
  relationships: ChunkRelationship[];
  processing_time: number;
  errors: ProcessingError[];
}

export interface ProcessingMetadata {
  original_length: number;
  total_chunks: number;
  average_chunk_size: number;
  quality_distribution: Record<string, number>;
  complexity_distribution: Record<string, number>;
  methodology_distribution: Record<string, number>;
}

export interface QualityReport {
  overall_score: number;
  content_quality: number;
  structure_quality: number;
  metadata_completeness: number;
  embedding_readiness: number;
  issues: QualityIssue[];
  recommendations: string[];
}

export interface QualityIssue {
  type: 'content' | 'structure' | 'metadata' | 'formatting';
  severity: 'low' | 'medium' | 'high';
  description: string;
  chunk_ids: string[];
  suggested_fix?: string;
}

export interface ProcessingError {
  chunk_id?: string;
  error_type: 'validation' | 'chunking' | 'metadata' | 'quality';
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  recoverable: boolean;
}

/**
 * Document Processor Service
 */
export class DocumentProcessorService {
  private logger = createLogger('DocumentProcessor');
  private defaultOptions: DocumentProcessingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    maxChunkSize: 2000,
    preserveStructure: true,
    extractMetadata: true,
    validateQuality: true,
    minQualityScore: 0.6,
    enableRelationships: true,
    customSplitters: ['\n\n', '\n', '. ', '! ', '? '],
  };

  constructor(options: Partial<DocumentProcessingOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    
    this.logger.info('DocumentProcessor initialized', {
      chunkSize: this.defaultOptions.chunkSize,
      chunkOverlap: this.defaultOptions.chunkOverlap,
      minQualityScore: this.defaultOptions.minQualityScore,
    });
  }

  /**
   * Process a document into chunks with validation
   */
  async processDocument(
    documentId: string,
    content: string,
    baseMetadata: Partial<ChunkMetadata>,
    options: Partial<DocumentProcessingOptions> = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processingOptions = { ...this.defaultOptions, ...options };
    const errors: ProcessingError[] = [];

    try {
      this.logger.info('Starting document processing', {
        documentId,
        contentLength: content.length,
        chunkSize: processingOptions.chunkSize,
      });

      // Validate input
      this.validateInput(documentId, content, baseMetadata);

      // Preprocess content
      const preprocessedContent = this.preprocessContent(content, processingOptions);

      // Perform chunking
      const rawChunks = this.chunkText(
        preprocessedContent,
        processingOptions
      );

      // Create structured chunks with metadata
      const chunks: DocumentChunk[] = [];
      for (let i = 0; i < rawChunks.length; i++) {
        try {
          const chunk = await this.createChunk(
            documentId,
            rawChunks[i],
            i,
            baseMetadata,
            processingOptions
          );
          chunks.push(chunk);
        } catch (error) {
          errors.push({
            chunk_id: `${documentId}_chunk_${i}`,
            error_type: 'chunking',
            message: error instanceof Error ? error.message : 'Unknown chunking error',
            severity: 'error',
            recoverable: true,
          });
        }
      }

      // Extract relationships if enabled
      const relationships = processingOptions.enableRelationships
        ? this.extractRelationships(chunks)
        : [];

      // Generate quality report
      const qualityReport = this.generateQualityReport(chunks, processingOptions);

      // Create processing metadata
      const metadata = this.createProcessingMetadata(content, chunks);

      const processingTime = Date.now() - startTime;

      this.logger.info('Document processing completed', {
        documentId,
        totalChunks: chunks.length,
        processingTime,
        qualityScore: qualityReport.overall_score,
        errorsCount: errors.length,
      });

      return {
        chunks,
        metadata,
        quality_report: qualityReport,
        relationships,
        processing_time: processingTime,
        errors,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Document processing failed', {
        documentId,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new RAGError(
        `Document processing failed: ${error}`,
        'PROCESSING_ERROR',
        { documentId, processingTime, originalError: error }
      );
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processBatch(
    documents: Array<{
      id: string;
      content: string;
      metadata: Partial<ChunkMetadata>;
    }>,
    options: Partial<DocumentProcessingOptions> = {},
    progressCallback?: (processed: number, total: number) => void
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const batchSize = 5; // Process 5 documents at a time

    this.logger.info('Starting batch document processing', {
      totalDocuments: documents.length,
      batchSize,
    });

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (doc) => {
        return this.processDocument(doc.id, doc.content, doc.metadata, options);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('Batch processing failed for document', {
            error: result.reason,
          });
        }
      }

      if (progressCallback) {
        progressCallback(Math.min(i + batchSize, documents.length), documents.length);
      }

      // Add small delay to prevent overwhelming the system
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.info('Batch processing completed', {
      totalDocuments: documents.length,
      successfulProcessed: results.length,
    });

    return results;
  }

  /**
   * Validate input parameters
   */
  private validateInput(
    documentId: string,
    content: string,
    metadata: Partial<ChunkMetadata>
  ): void {
    if (!documentId || typeof documentId !== 'string') {
      throw new RAGError('Document ID is required and must be a string', 'VALIDATION_ERROR');
    }

    if (!content || typeof content !== 'string') {
      throw new RAGError('Content is required and must be a string', 'VALIDATION_ERROR');
    }

    if (content.length < 10) {
      throw new RAGError('Content too short for processing', 'VALIDATION_ERROR');
    }

    if (content.length > 1000000) { // 1MB limit
      throw new RAGError('Content too large for processing', 'VALIDATION_ERROR');
    }

    if (!metadata.title || !metadata.category) {
      throw new RAGError('Title and category are required in metadata', 'VALIDATION_ERROR');
    }
  }

  /**
   * Preprocess content for optimal chunking
   */
  private preprocessContent(
    content: string,
    options: DocumentProcessingOptions
  ): string {
    let processed = content;

    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Clean up excessive whitespace
    processed = processed.replace(/\n{3,}/g, '\n\n');
    processed = processed.replace(/[ \t]+/g, ' ');

    // Remove or standardize special characters
    processed = processed.replace(/[""]/g, '"');
    processed = processed.replace(/['']/g, "'");
    processed = processed.replace(/[–—]/g, '-');

    // Preserve structure markers if enabled
    if (options.preserveStructure) {
      // Mark headers and sections
      processed = processed.replace(/^(#{1,6})\s+(.+)$/gm, '\n$1 $2\n');
      processed = processed.replace(/^([A-Z][A-Z\s]+)$/gm, '\n### $1\n');
    }

    return processed.trim();
  }

  /**
   * Chunk text using intelligent splitting
   */
  private chunkText(
    content: string,
    options: DocumentProcessingOptions
  ): string[] {
    const chunks: string[] = [];
    const splitters = options.customSplitters || this.defaultOptions.customSplitters!;
    
    // Start with the full content
    let remainingContent = content;
    
    while (remainingContent.length > 0) {
      // If remaining content is smaller than chunk size, take it all
      if (remainingContent.length <= options.chunkSize) {
        if (remainingContent.length >= options.minChunkSize) {
          chunks.push(remainingContent.trim());
        }
        break;
      }

      // Find the best split point
      const splitPoint = this.findOptimalSplitPoint(
        remainingContent,
        options.chunkSize,
        splitters
      );

      // Extract the chunk
      const chunk = remainingContent.substring(0, splitPoint).trim();
      
      if (chunk.length >= options.minChunkSize) {
        chunks.push(chunk);
      }

      // Move to next chunk with overlap
      const overlapStart = Math.max(0, splitPoint - options.chunkOverlap);
      remainingContent = remainingContent.substring(overlapStart);
    }

    return chunks.filter(chunk => chunk.length >= options.minChunkSize);
  }

  /**
   * Find optimal split point for chunking
   */
  private findOptimalSplitPoint(
    content: string,
    maxSize: number,
    splitters: string[]
  ): number {
    if (content.length <= maxSize) {
      return content.length;
    }

    // Try each splitter in order of preference
    for (const splitter of splitters) {
      const lastIndex = content.lastIndexOf(splitter, maxSize);
      if (lastIndex > maxSize * 0.5) { // Don't split too early
        return lastIndex + splitter.length;
      }
    }

    // If no good split point found, split at word boundary
    const wordBoundary = content.lastIndexOf(' ', maxSize);
    if (wordBoundary > maxSize * 0.7) {
      return wordBoundary;
    }

    // Last resort: hard split at maxSize
    return maxSize;
  }

  /**
   * Create a structured chunk with metadata
   */
  private async createChunk(
    documentId: string,
    content: string,
    index: number,
    baseMetadata: Partial<ChunkMetadata>,
    options: DocumentProcessingOptions
  ): Promise<DocumentChunk> {
    const chunkId = `${documentId}_chunk_${index}`;
    
    // Extract chunk-specific metadata
    const chunkMetadata = this.extractChunkMetadata(content, baseMetadata);
    
    // Calculate quality score
    const qualityScore = this.calculateChunkQuality(content, chunkMetadata);
    
    // Determine chunk type
    const chunkType = this.determineChunkType(content);
    
    // Check if content is ready for embedding
    const embeddingReady = this.isEmbeddingReady(content, qualityScore, options);

    return {
      id: chunkId,
      content: content.trim(),
      index,
      metadata: {
        ...chunkMetadata,
        source_document_id: documentId,
        created_at: new Date().toISOString(),
        chunk_type: chunkType,
      },
      quality_score: qualityScore,
      word_count: content.split(/\s+/).length,
      char_count: content.length,
      embedding_ready: embeddingReady,
    };
  }

  /**
   * Extract metadata from chunk content
   */
  private extractChunkMetadata(
    content: string,
    baseMetadata: Partial<ChunkMetadata>
  ): ChunkMetadata {
    const metadata: ChunkMetadata = {
      source_document_id: '',
      title: baseMetadata.title || 'Untitled',
      category: baseMetadata.category || 'general',
      author: baseMetadata.author,
      methodology: baseMetadata.methodology,
      life_area: baseMetadata.life_area,
      complexity_level: baseMetadata.complexity_level,
      goal_type: baseMetadata.goal_type,
      evidence_level: baseMetadata.evidence_level,
      tags: baseMetadata.tags || [],
      created_at: new Date().toISOString(),
      chunk_type: 'content',
    };

    // Auto-detect complexity level if not provided
    if (!metadata.complexity_level) {
      metadata.complexity_level = this.detectComplexityLevel(content);
    }

    // Auto-detect methodology if not provided
    if (!metadata.methodology) {
      metadata.methodology = this.detectMethodology(content);
    }

    // Auto-detect life area if not provided
    if (!metadata.life_area) {
      metadata.life_area = this.detectLifeArea(content);
    }

    // Extract tags from content
    const extractedTags = this.extractTags(content);
    metadata.tags = [...(metadata.tags || []), ...extractedTags];

    return metadata;
  }

  /**
   * Calculate quality score for a chunk
   */
  private calculateChunkQuality(
    content: string,
    metadata: ChunkMetadata
  ): number {
    let score = 0;

    // Content quality (40%)
    const contentScore = this.assessContentQuality(content);
    score += contentScore * 0.4;

    // Structure quality (20%)
    const structureScore = this.assessStructureQuality(content);
    score += structureScore * 0.2;

    // Metadata completeness (20%)
    const metadataScore = this.assessMetadataCompleteness(metadata);
    score += metadataScore * 0.2;

    // Embedding readiness (20%)
    const embeddingScore = this.assessEmbeddingReadiness(content);
    score += embeddingScore * 0.2;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Assess content quality
   */
  private assessContentQuality(content: string): number {
    let score = 0.5; // Base score

    // Length check
    if (content.length >= 100 && content.length <= 2000) {
      score += 0.2;
    }

    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      score += 0.1;
    }

    // Word variety
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const varietyRatio = uniqueWords.size / words.length;
    if (varietyRatio > 0.5) {
      score += 0.1;
    }

    // Readability indicators
    const avgWordsPerSentence = words.length / sentences.length;
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Assess structure quality
   */
  private assessStructureQuality(content: string): number {
    let score = 0.5; // Base score

    // Paragraph structure
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2) {
      score += 0.2;
    }

    // Headers and organization
    if (/^#+\s+/.test(content) || /^[A-Z][A-Z\s]+$/m.test(content)) {
      score += 0.15;
    }

    // Lists and structure
    if (/^[-*+]\s+/m.test(content) || /^\d+\.\s+/m.test(content)) {
      score += 0.15;
    }

    // Proper punctuation
    if (/[.!?]$/.test(content.trim())) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Assess metadata completeness
   */
  private assessMetadataCompleteness(metadata: ChunkMetadata): number {
    let score = 0;
    const fields = ['title', 'category', 'author', 'methodology', 'life_area', 'complexity_level'];
    
    for (const field of fields) {
      if (metadata[field as keyof ChunkMetadata]) {
        score += 1 / fields.length;
      }
    }

    // Bonus for tags
    if (metadata.tags && metadata.tags.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Assess embedding readiness
   */
  private assessEmbeddingReadiness(content: string): number {
    let score = 0.5; // Base score

    // Length appropriateness
    if (content.length >= 50 && content.length <= 1000) {
      score += 0.2;
    }

    // Contains meaningful content
    if (!/^[\s\n\r]*$/.test(content)) {
      score += 0.1;
    }

    // Not just metadata or headers
    if (!/^#+\s+/.test(content.trim()) && !/^[A-Z][A-Z\s]+$/.test(content.trim())) {
      score += 0.1;
    }

    // Contains actionable content
    if (/\b(how|what|when|where|why|steps|process|method|approach|technique)\b/i.test(content)) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Detect complexity level from content
   */
  private detectComplexityLevel(content: string): 'beginner' | 'intermediate' | 'advanced' {
    const beginnerKeywords = ['basic', 'simple', 'easy', 'start', 'begin', 'introduction', 'first'];
    const advancedKeywords = ['complex', 'advanced', 'sophisticated', 'expert', 'mastery', 'deep'];
    
    const lowerContent = content.toLowerCase();
    const beginnerScore = beginnerKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    const advancedScore = advancedKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    
    if (beginnerScore > advancedScore) return 'beginner';
    if (advancedScore > beginnerScore + 1) return 'advanced';
    return 'intermediate';
  }

  /**
   * Detect methodology from content
   */
  private detectMethodology(content: string): string | undefined {
    const methodologies = {
      'GROW Model': ['goal', 'reality', 'options', 'will', 'grow'],
      'Values Clarification': ['values', 'important', 'meaning', 'priorities'],
      'Solution-Focused': ['solutions', 'strengths', 'resources', 'exceptions'],
      'Cognitive Behavioral': ['thoughts', 'feelings', 'behavior', 'patterns'],
      'Mindfulness-Based': ['mindfulness', 'present', 'awareness', 'meditation'],
    };

    const lowerContent = content.toLowerCase();
    let bestMatch = '';
    let bestScore = 0;

    for (const [methodology, keywords] of Object.entries(methodologies)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = methodology;
      }
    }

    return bestScore > 0 ? bestMatch : undefined;
  }

  /**
   * Detect life area from content
   */
  private detectLifeArea(content: string): string | undefined {
    const lifeAreas = {
      career: ['work', 'job', 'career', 'professional', 'workplace'],
      relationships: ['relationship', 'partner', 'family', 'friends', 'social'],
      health: ['health', 'fitness', 'exercise', 'diet', 'wellness'],
      personal_growth: ['growth', 'development', 'learning', 'skills'],
      finances: ['money', 'financial', 'budget', 'debt', 'savings'],
    };

    const lowerContent = content.toLowerCase();
    let bestMatch = '';
    let bestScore = 0;

    for (const [area, keywords] of Object.entries(lifeAreas)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = area;
      }
    }

    return bestScore > 0 ? bestMatch : undefined;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Common coaching tags
    const tagPatterns = [
      'goal setting', 'time management', 'stress management', 'communication',
      'leadership', 'motivation', 'confidence', 'self-esteem', 'habits',
      'productivity', 'work-life balance', 'decision making', 'conflict resolution',
    ];

    for (const pattern of tagPatterns) {
      if (lowerContent.includes(pattern)) {
        tags.push(pattern);
      }
    }

    return tags;
  }

  /**
   * Determine chunk type from content
   */
  private determineChunkType(content: string): ChunkMetadata['chunk_type'] {
    const trimmed = content.trim();
    
    // Check for headers
    if (/^#+\s+/.test(trimmed) || /^[A-Z][A-Z\s]+$/.test(trimmed)) {
      return 'header';
    }

    // Check for examples
    if (/^(example|for example|case study|scenario):/i.test(trimmed)) {
      return 'example';
    }

    // Check for summaries
    if (/^(summary|conclusion|in summary|to summarize):/i.test(trimmed)) {
      return 'summary';
    }

    return 'content';
  }

  /**
   * Check if content is ready for embedding
   */
  private isEmbeddingReady(
    content: string,
    qualityScore: number,
    options: DocumentProcessingOptions
  ): boolean {
    return qualityScore >= options.minQualityScore &&
           content.length >= options.minChunkSize &&
           content.length <= options.maxChunkSize &&
           !/^[\s\n\r]*$/.test(content);
  }

  /**
   * Extract relationships between chunks
   */
  private extractRelationships(chunks: DocumentChunk[]): ChunkRelationship[] {
    const relationships: ChunkRelationship[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      
      // Check for sequential relationships
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const continuationStrength = this.calculateContinuationStrength(
          prevChunk.content,
          currentChunk.content
        );
        
        if (continuationStrength > 0.5) {
          relationships.push({
            related_chunk_id: prevChunk.id,
            relationship_type: 'continuation',
            strength: continuationStrength,
          });
        }
      }

      // Check for reference relationships
      for (let j = 0; j < chunks.length; j++) {
        if (i === j) continue;
        
        const otherChunk = chunks[j];
        const referenceStrength = this.calculateReferenceStrength(
          currentChunk.content,
          otherChunk.content
        );
        
        if (referenceStrength > 0.7) {
          relationships.push({
            related_chunk_id: otherChunk.id,
            relationship_type: 'reference',
            strength: referenceStrength,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Calculate continuation strength between chunks
   */
  private calculateContinuationStrength(content1: string, content2: string): number {
    // Simple heuristic: check for connecting phrases
    const connectors = ['however', 'therefore', 'furthermore', 'additionally', 'meanwhile'];
    const lowerContent2 = content2.toLowerCase();
    
    for (const connector of connectors) {
      if (lowerContent2.startsWith(connector)) {
        return 0.8;
      }
    }

    // Check for pronoun references
    if (/^(this|that|these|those|it|they)\b/i.test(content2.trim())) {
      return 0.6;
    }

    return 0.3; // Default weak continuation
  }

  /**
   * Calculate reference strength between chunks
   */
  private calculateReferenceStrength(content1: string, content2: string): number {
    // Simple keyword overlap
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Generate quality report
   */
  private generateQualityReport(
    chunks: DocumentChunk[],
    options: DocumentProcessingOptions
  ): QualityReport {
    const issues: QualityIssue[] = [];
    const recommendations: string[] = [];

    // Calculate overall scores
    const qualityScores = chunks.map(chunk => chunk.quality_score);
    const overallScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

    // Check for quality issues
    const lowQualityChunks = chunks.filter(chunk => chunk.quality_score < options.minQualityScore);
    if (lowQualityChunks.length > 0) {
      issues.push({
        type: 'content',
        severity: 'medium',
        description: `${lowQualityChunks.length} chunks below quality threshold`,
        chunk_ids: lowQualityChunks.map(chunk => chunk.id),
        suggested_fix: 'Review and improve content quality',
      });
    }

    // Check for empty or very short chunks
    const shortChunks = chunks.filter(chunk => chunk.content.length < options.minChunkSize);
    if (shortChunks.length > 0) {
      issues.push({
        type: 'structure',
        severity: 'low',
        description: `${shortChunks.length} chunks are too short`,
        chunk_ids: shortChunks.map(chunk => chunk.id),
        suggested_fix: 'Merge with adjacent chunks or expand content',
      });
    }

    // Generate recommendations
    if (overallScore < 0.7) {
      recommendations.push('Consider improving content quality before processing');
    }
    if (chunks.length < 3) {
      recommendations.push('Document may be too short for effective chunking');
    }

    return {
      overall_score: overallScore,
      content_quality: qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length,
      structure_quality: 0.8, // Placeholder
      metadata_completeness: 0.75, // Placeholder
      embedding_readiness: chunks.filter(chunk => chunk.embedding_ready).length / chunks.length,
      issues,
      recommendations,
    };
  }

  /**
   * Create processing metadata
   */
  private createProcessingMetadata(
    originalContent: string,
    chunks: DocumentChunk[]
  ): ProcessingMetadata {
    const qualityDistribution: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};
    const methodologyDistribution: Record<string, number> = {};

    // Calculate distributions
    chunks.forEach(chunk => {
      // Quality distribution
      const qualityBucket = Math.floor(chunk.quality_score * 10) / 10;
      qualityDistribution[qualityBucket.toString()] = 
        (qualityDistribution[qualityBucket.toString()] || 0) + 1;

      // Complexity distribution
      const complexity = chunk.metadata['complexity_level'] || 'unknown';
      complexityDistribution[complexity] = (complexityDistribution[complexity] || 0) + 1;

      // Methodology distribution
      const methodology = chunk.metadata['methodology'] || 'unknown';
      methodologyDistribution[methodology] = (methodologyDistribution[methodology] || 0) + 1;
    });

    return {
      original_length: originalContent.length,
      total_chunks: chunks.length,
      average_chunk_size: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
      quality_distribution: qualityDistribution,
      complexity_distribution: complexityDistribution,
      methodology_distribution: methodologyDistribution,
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    defaultOptions: DocumentProcessingOptions;
    supportedComplexityLevels: string[];
    supportedChunkTypes: string[];
  } {
    return {
      defaultOptions: { ...this.defaultOptions },
      supportedComplexityLevels: ['beginner', 'intermediate', 'advanced'],
      supportedChunkTypes: ['content', 'header', 'summary', 'example'],
    };
  }
}

// Export singleton instance
export const documentProcessorService = new DocumentProcessorService();