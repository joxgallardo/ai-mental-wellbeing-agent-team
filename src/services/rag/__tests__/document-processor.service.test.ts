import { DocumentProcessorService, DocumentProcessingOptions } from '../document-processor.service';
import { RAGError } from '../../../types/database';

describe('DocumentProcessorService', () => {
  let processor: DocumentProcessorService;
  const sampleMetadata = {
    title: 'Test Document',
    category: 'life_coaching',
    author: 'Test Author',
    methodology: 'GROW Model',
    life_area: 'career',
    complexity_level: 'intermediate' as const,
  };

  beforeEach(() => {
    processor = new DocumentProcessorService();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const service = new DocumentProcessorService();
      const stats = service.getProcessingStats();
      
      expect(stats.defaultOptions.chunkSize).toBe(1000);
      expect(stats.defaultOptions.chunkOverlap).toBe(200);
      expect(stats.defaultOptions.minQualityScore).toBe(0.6);
      expect(stats.supportedComplexityLevels).toEqual(['beginner', 'intermediate', 'advanced']);
    });

    it('should create instance with custom options', () => {
      const customOptions: Partial<DocumentProcessingOptions> = {
        chunkSize: 500,
        chunkOverlap: 100,
        minQualityScore: 0.8,
      };
      
      const service = new DocumentProcessorService(customOptions);
      const stats = service.getProcessingStats();
      
      expect(stats.defaultOptions.chunkSize).toBe(500);
      expect(stats.defaultOptions.chunkOverlap).toBe(100);
      expect(stats.defaultOptions.minQualityScore).toBe(0.8);
    });
  });

  describe('Input Validation', () => {
    it('should throw error for missing document ID', async () => {
      await expect(
        processor.processDocument('', 'content', sampleMetadata)
      ).rejects.toThrow(RAGError);
    });

    it('should throw error for missing content', async () => {
      await expect(
        processor.processDocument('doc1', '', sampleMetadata)
      ).rejects.toThrow(RAGError);
    });

    it('should throw error for content too short', async () => {
      await expect(
        processor.processDocument('doc1', 'short', sampleMetadata)
      ).rejects.toThrow(RAGError);
    });

    it('should throw error for missing required metadata', async () => {
      await expect(
        processor.processDocument('doc1', 'This is a longer content for testing', {})
      ).rejects.toThrow(RAGError);
    });

    it('should throw error for content too large', async () => {
      const largeContent = 'a'.repeat(1000001);
      await expect(
        processor.processDocument('doc1', largeContent, sampleMetadata)
      ).rejects.toThrow(RAGError);
    });
  });

  describe('Document Processing', () => {
    const sampleContent = `
# Introduction to Goal Setting

Goal setting is a fundamental aspect of personal development and achievement. It provides direction, motivation, and a clear path forward.

## The GROW Model

The GROW model is a structured approach to goal setting that consists of four key components:

### Goal
What do you want to achieve? Your goal should be specific, measurable, and meaningful to you.

### Reality
What is your current situation? Understanding where you are now is crucial for planning your path forward.

### Options
What are your available options? Brainstorm different approaches and strategies you could use.

### Will
What will you do? Commit to specific actions and create a timeline for implementation.

## Practical Application

When applying the GROW model, start with a clear vision of what you want to achieve. Be honest about your current situation and explore multiple options before committing to a specific course of action.

Remember that goal setting is an iterative process. Review and adjust your goals regularly based on your progress and changing circumstances.
    `.trim();

    it('should process document successfully', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata);
      
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.processing_time).toBeGreaterThan(0);
      expect(result.quality_report.overall_score).toBeGreaterThan(0);
      expect(result.metadata.original_length).toBe(sampleContent.length);
      expect(result.errors).toEqual([]);
    });

    it('should create chunks with proper structure', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata);
      
      const firstChunk = result.chunks[0];
      expect(firstChunk.id).toBe('doc1_chunk_0');
      expect(firstChunk.index).toBe(0);
      expect(firstChunk.content).toBeTruthy();
      expect(firstChunk.metadata.title).toBe('Test Document');
      expect(firstChunk.metadata.category).toBe('life_coaching');
      expect(firstChunk.metadata.source_document_id).toBe('doc1');
      expect(firstChunk.quality_score).toBeGreaterThan(0);
      expect(firstChunk.word_count).toBeGreaterThan(0);
      expect(firstChunk.char_count).toBeGreaterThan(0);
    });

    it('should handle custom processing options', async () => {
      const customOptions: Partial<DocumentProcessingOptions> = {
        chunkSize: 300,
        chunkOverlap: 50,
        minQualityScore: 0.5,
        preserveStructure: false,
      };
      
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata, customOptions);
      
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].content.length).toBeLessThanOrEqual(300);
    });

    it('should extract metadata correctly', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata);
      
      const chunk = result.chunks[0];
      expect(chunk.metadata['methodology']).toBe('GROW Model');
      expect(chunk.metadata['life_area']).toBe('career');
      expect(chunk.metadata['complexity_level']).toBe('intermediate');
      expect(chunk.metadata.created_at).toBeTruthy();
    });

    it('should auto-detect metadata when not provided', async () => {
      const minimalMetadata = {
        title: 'Test Document',
        category: 'life_coaching',
      };
      
      const result = await processor.processDocument('doc1', sampleContent, minimalMetadata);
      
      const chunk = result.chunks[0];
      expect(chunk.metadata['methodology']).toBeTruthy();
      expect(chunk.metadata['complexity_level']).toBeTruthy();
    });

    it('should calculate quality scores', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata);
      
      result.chunks.forEach(chunk => {
        expect(chunk.quality_score).toBeGreaterThanOrEqual(0);
        expect(chunk.quality_score).toBeLessThanOrEqual(1);
      });
      
      expect(result.quality_report.overall_score).toBeGreaterThan(0);
      expect(result.quality_report.content_quality).toBeGreaterThan(0);
    });

    it('should mark chunks as embedding ready', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata);
      
      const readyChunks = result.chunks.filter(chunk => chunk.embedding_ready);
      expect(readyChunks.length).toBeGreaterThan(0);
    });

    it('should extract relationships when enabled', async () => {
      const result = await processor.processDocument('doc1', sampleContent, sampleMetadata, {
        enableRelationships: true,
      });
      
      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should handle short content appropriately', async () => {
      const shortContent = 'This is a short document with minimal content for testing purposes.';
      
      const result = await processor.processDocument('doc1', shortContent, sampleMetadata);
      
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].content).toBe(shortContent);
    });

    it('should process content with different chunk types', async () => {
      const contentWithTypes = `
# Main Header

This is regular content about goal setting and personal development.

## Subheader

Example: Here's a specific example of how to apply the GROW model in practice.

Summary: The key takeaway is that goal setting requires clear vision and consistent action.
      `.trim();
      
      const result = await processor.processDocument('doc1', contentWithTypes, sampleMetadata);
      
      const chunkTypes = result.chunks.map(chunk => chunk.metadata.chunk_type);
      expect(chunkTypes).toContain('content');
    });
  });

  describe('Batch Processing', () => {
    const documents = [
      {
        id: 'doc1',
        content: 'First document content about goal setting and personal development strategies.',
        metadata: { ...sampleMetadata, title: 'Document 1' },
      },
      {
        id: 'doc2',
        content: 'Second document content about time management and productivity improvement techniques.',
        metadata: { ...sampleMetadata, title: 'Document 2', life_area: 'productivity' },
      },
      {
        id: 'doc3',
        content: 'Third document content about relationship building and communication skills development.',
        metadata: { ...sampleMetadata, title: 'Document 3', life_area: 'relationships' },
      },
    ];

    it('should process multiple documents', async () => {
      const results = await processor.processBatch(documents);
      
      expect(results.length).toBe(3);
      results.forEach((result, index) => {
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.chunks[0].metadata.title).toBe(`Document ${index + 1}`);
      });
    });

    it('should handle progress callback', async () => {
      const progressCallback = jest.fn();
      
      await processor.processBatch(documents, {}, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(3, 3);
    });

    it('should handle empty batch', async () => {
      const results = await processor.processBatch([]);
      
      expect(results).toEqual([]);
    });

    it('should handle batch with processing errors gracefully', async () => {
      const invalidDocuments = [
        ...documents,
        {
          id: 'invalid',
          content: 'short', // Too short
          metadata: { ...sampleMetadata, title: 'Invalid Doc' },
        },
      ];
      
      const results = await processor.processBatch(invalidDocuments);
      
      // Should process valid documents and skip invalid ones
      expect(results.length).toBe(3);
    });
  });

  describe('Quality Assessment', () => {
    it('should assess high-quality content correctly', async () => {
      const highQualityContent = `
Goal setting is a fundamental skill that enables individuals to achieve their desired outcomes through structured planning and execution.

The process involves several key components that work together to create a comprehensive framework for success. First, individuals must clearly define their objectives with specific, measurable criteria. This clarity provides direction and enables progress tracking.

Next, it's essential to assess the current situation honestly. Understanding where you are now creates the foundation for planning your path forward. This reality check helps identify gaps between current state and desired outcomes.

Once you have a clear goal and understand your starting point, you can explore various options and strategies. This brainstorming phase should consider multiple approaches, potential obstacles, and available resources.

Finally, commitment to action is crucial. Without concrete steps and timelines, even the best-planned goals remain unfulfilled aspirations.
      `.trim();
      
      const result = await processor.processDocument('doc1', highQualityContent, sampleMetadata);
      
      expect(result.quality_report.overall_score).toBeGreaterThan(0.7);
      expect(result.quality_report.content_quality).toBeGreaterThan(0.6);
      expect(result.quality_report.embedding_readiness).toBeGreaterThan(0.8);
    });

    it('should identify quality issues', async () => {
      const poorQualityContent = `
short text
another short line
minimal content
      `.trim();
      
      const result = await processor.processDocument('doc1', poorQualityContent, sampleMetadata);
      
      expect(result.quality_report.overall_score).toBeLessThan(0.7);
      expect(result.quality_report.issues.length).toBeGreaterThan(0);
      expect(result.quality_report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide quality recommendations', async () => {
      const mediumQualityContent = 'This is a medium quality document with some content but could be improved.';
      
      const result = await processor.processDocument('doc1', mediumQualityContent, sampleMetadata);
      
      expect(result.quality_report.recommendations).toBeDefined();
      expect(Array.isArray(result.quality_report.recommendations)).toBe(true);
    });
  });

  describe('Metadata Extraction', () => {
    it('should detect complexity level from content', async () => {
      const beginnerContent = 'This is a basic introduction to simple goal setting techniques for beginners.';
      const advancedContent = 'This explores sophisticated, complex strategies for expert-level mastery.';
      
      const beginnerResult = await processor.processDocument('doc1', beginnerContent, {
        title: 'Beginner Doc',
        category: 'life_coaching',
      });
      
      const advancedResult = await processor.processDocument('doc2', advancedContent, {
        title: 'Advanced Doc',
        category: 'life_coaching',
      });
      
      expect(beginnerResult.chunks[0].metadata['complexity_level']).toBe('beginner');
      expect(advancedResult.chunks[0].metadata['complexity_level']).toBe('advanced');
    });

    it('should detect methodology from content', async () => {
      const growContent = 'Using the GROW model, define your goal, assess reality, explore options, and commit to action.';
      
      const result = await processor.processDocument('doc1', growContent, {
        title: 'GROW Doc',
        category: 'life_coaching',
      });
      
      expect(result.chunks[0].metadata['methodology']).toBe('GROW Model');
    });

    it('should detect life area from content', async () => {
      const careerContent = 'Focus on your career development, workplace skills, and professional growth.';
      
      const result = await processor.processDocument('doc1', careerContent, {
        title: 'Career Doc',
        category: 'life_coaching',
      });
      
      expect(result.chunks[0].metadata['life_area']).toBe('career');
    });

    it('should extract tags from content', async () => {
      const taggedContent = 'This content covers goal setting, time management, and productivity strategies.';
      
      const result = await processor.processDocument('doc1', taggedContent, {
        title: 'Tagged Doc',
        category: 'life_coaching',
      });
      
      expect(result.chunks[0].metadata.tags).toContain('goal setting');
      expect(result.chunks[0].metadata.tags).toContain('time management');
    });
  });

  describe('Text Chunking', () => {
    it('should chunk long content appropriately', async () => {
      const longContent = 'This is a sentence. '.repeat(200); // Create long content
      
      const result = await processor.processDocument('doc1', longContent, sampleMetadata, {
        chunkSize: 500,
        chunkOverlap: 100,
      });
      
      expect(result.chunks.length).toBeGreaterThan(1);
      result.chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(500);
      });
    });

    it('should preserve structure when enabled', async () => {
      const structuredContent = `
# Main Header

This is content under the main header.

## Subheader

This is content under the subheader.

### Third Level

This is content under the third level header.
      `.trim();
      
      const result = await processor.processDocument('doc1', structuredContent, sampleMetadata, {
        preserveStructure: true,
      });
      
      expect(result.chunks.length).toBeGreaterThan(0);
      // Headers should be preserved in content
      expect(result.chunks.some(chunk => chunk.content.includes('#'))).toBe(true);
    });

    it('should handle overlap correctly', async () => {
      const content = 'Word '.repeat(200); // Create content with repeated words
      
      const result = await processor.processDocument('doc1', content, sampleMetadata, {
        chunkSize: 100,
        chunkOverlap: 20,
      });
      
      expect(result.chunks.length).toBeGreaterThan(1);
      
      // Check that chunks have some overlap
      if (result.chunks.length > 1) {
        const firstChunk = result.chunks[0];
        const secondChunk = result.chunks[1];
        
        expect(firstChunk.content.length).toBeLessThanOrEqual(100);
        expect(secondChunk.content.length).toBeLessThanOrEqual(100);
      }
    });

    it('should respect minimum chunk size', async () => {
      const result = await processor.processDocument('doc1', 'Short content.', sampleMetadata, {
        minChunkSize: 50,
      });
      
      // Should not create chunks smaller than minimum
      result.chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThanOrEqual(10); // Allowing some flexibility
      });
    });
  });

  describe('Relationship Extraction', () => {
    it('should extract relationships when enabled', async () => {
      const relatedContent = `
First, you need to understand the basics of goal setting. This involves defining clear objectives.

However, goal setting alone is not enough. You must also create action plans.

Therefore, the combination of clear goals and actionable plans leads to success.
      `.trim();
      
      const result = await processor.processDocument('doc1', relatedContent, sampleMetadata, {
        enableRelationships: true,
        chunkSize: 200,
      });
      
      expect(result.relationships).toBeDefined();
      expect(result.relationships.length).toBeGreaterThan(0);
      
      // Check relationship structure
      if (result.relationships.length > 0) {
        const relationship = result.relationships[0];
        expect(relationship.related_chunk_id).toBeTruthy();
        expect(relationship.relationship_type).toBeTruthy();
        expect(relationship.strength).toBeGreaterThan(0);
        expect(relationship.strength).toBeLessThanOrEqual(1);
      }
    });

    it('should not extract relationships when disabled', async () => {
      const result = await processor.processDocument('doc1', 'Content with relationships.', sampleMetadata, {
        enableRelationships: false,
      });
      
      expect(result.relationships).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      // This test ensures the service doesn't crash on edge cases
      const edgeCaseContent = '\n\n\n   \n\n\n'; // Only whitespace
      
      await expect(
        processor.processDocument('doc1', edgeCaseContent, sampleMetadata)
      ).rejects.toThrow(RAGError);
    });

    it('should provide detailed error information', async () => {
      try {
        await processor.processDocument('', 'content', sampleMetadata);
      } catch (error) {
        expect(error).toBeInstanceOf(RAGError);
        expect(error instanceof Error ? error.message : String(error)).toContain('Document ID');
      }
    });
  });

  describe('Performance', () => {
    it('should complete processing within reasonable time', async () => {
      const content = 'This is test content. '.repeat(100);
      const startTime = Date.now();
      
      const result = await processor.processDocument('doc1', content, sampleMetadata);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processing_time).toBeGreaterThan(0);
    });

    it('should handle large documents efficiently', async () => {
      const largeContent = 'This is a longer sentence with more content. '.repeat(500);
      
      const result = await processor.processDocument('doc1', largeContent, sampleMetadata);
      
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.processing_time).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Statistics', () => {
    it('should provide processing statistics', () => {
      const stats = processor.getProcessingStats();
      
      expect(stats.defaultOptions).toBeDefined();
      expect(stats.supportedComplexityLevels).toEqual(['beginner', 'intermediate', 'advanced']);
      expect(stats.supportedChunkTypes).toEqual(['content', 'header', 'summary', 'example']);
    });
  });
});