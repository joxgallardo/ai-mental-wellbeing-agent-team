/**
 * Multi-Domain Architecture Validation
 * 
 * Comprehensive tests to validate the whitelabel multi-domain architecture
 * ensuring scalability and domain-specific customization capabilities.
 */

import { DomainConfigLoaderService } from '../../services/rag/domain-config-loader.service';
import { DomainAdapterFactory } from '../../services/rag/domain-adapter.service';
import { LifeCoachingAdapter } from '../../services/rag/domain-adapter.service';
import { ragFoundationService } from '../../services/rag/rag-foundation.service';
import { UserInput, AgentContext } from '../../types/index';
import { EnhancedBaseAgent } from '../../agents/enhanced-base-agent';

/**
 * Mock Career Coaching Domain Configuration
 */
const mockCareerCoachingConfig = {
  name: 'career_coaching',
  display_name: 'Career Coaching',
  description: 'Professional development and career advancement coaching',
  knowledge_sources: ['methodologies', 'best_practices', 'resources'],
  methodologies: [
    'GROW Model',
    'Career Anchors Assessment',
    'Skills Gap Analysis',
    'Personal Branding',
    'Network Building',
  ],
  assessment_frameworks: [
    {
      name: 'Career Satisfaction Assessment',
      description: 'Evaluate satisfaction with current career trajectory',
      dimensions: ['job_satisfaction', 'growth_opportunities', 'work_life_balance', 'compensation', 'culture_fit'],
    },
    {
      name: 'Skills Assessment',
      description: 'Identify strengths and development areas',
      categories: ['technical_skills', 'soft_skills', 'leadership_skills', 'industry_knowledge'],
    },
  ],
  retrieval_preferences: {
    methodology_weight: 0.4,
    best_practices_weight: 0.3,
    resources_weight: 0.2,
    templates_weight: 0.1,
  },
  metadata_schema: {
    career_stage: {
      type: 'string',
      values: ['entry_level', 'mid_level', 'senior_level', 'executive', 'career_change'],
    },
    industry: {
      type: 'string',
      values: ['technology', 'finance', 'healthcare', 'education', 'consulting', 'other'],
    },
    skill_level: {
      type: 'string',
      values: ['beginner', 'intermediate', 'advanced', 'expert'],
    },
  },
  filtering_rules: {
    minimum_relevance_score: 0.65,
    boost_factors: {
      career_stage_match: 1.3,
      industry_match: 1.2,
      methodology_match: 1.15,
    },
  },
  personalization: {
    career_stage_weight: 0.35,
    industry_preference_weight: 0.25,
    skill_level_weight: 0.2,
    goal_alignment_weight: 0.2,
  },
};

/**
 * Mock Relationship Coaching Domain Configuration
 */
const mockRelationshipCoachingConfig = {
  name: 'relationship_coaching',
  display_name: 'Relationship Coaching',
  description: 'Interpersonal skills and relationship building coaching',
  knowledge_sources: ['methodologies', 'best_practices', 'resources'],
  methodologies: [
    'Gottman Method',
    'Emotionally Focused Therapy',
    'Communication Skills Training',
    'Conflict Resolution',
    'Love Languages',
  ],
  assessment_frameworks: [
    {
      name: 'Relationship Quality Assessment',
      description: 'Evaluate various aspects of relationship health',
      dimensions: ['communication', 'trust', 'intimacy', 'conflict_resolution', 'shared_values'],
    },
    {
      name: 'Communication Style Assessment',
      description: 'Identify communication patterns and preferences',
      styles: ['assertive', 'passive', 'aggressive', 'passive_aggressive'],
    },
  ],
  retrieval_preferences: {
    methodology_weight: 0.35,
    best_practices_weight: 0.35,
    resources_weight: 0.2,
    templates_weight: 0.1,
  },
  metadata_schema: {
    relationship_type: {
      type: 'string',
      values: ['romantic', 'family', 'friendship', 'professional', 'general'],
    },
    relationship_stage: {
      type: 'string',
      values: ['new', 'established', 'struggling', 'recovering', 'thriving'],
    },
    communication_focus: {
      type: 'string',
      values: ['conflict_resolution', 'emotional_expression', 'active_listening', 'boundary_setting'],
    },
  },
  filtering_rules: {
    minimum_relevance_score: 0.6,
    boost_factors: {
      relationship_type_match: 1.25,
      relationship_stage_match: 1.2,
      communication_focus_match: 1.15,
    },
  },
  personalization: {
    relationship_type_weight: 0.3,
    relationship_stage_weight: 0.25,
    communication_style_weight: 0.25,
    goal_alignment_weight: 0.2,
  },
};

/**
 * Career Coaching Domain Adapter
 */
class CareerCoachingAdapter extends LifeCoachingAdapter {
  constructor() {
    super('career_coaching');
  }

  enhanceQuery(originalQuery: string, ragContext: any): any {
    const baseEnhancement = super.enhanceQuery(originalQuery, ragContext);
    
    // Add career-specific enhancements
    const careerKeywords = this.extractCareerKeywords(originalQuery);
    const careerStage = this.detectCareerStage(ragContext);
    const industry = this.detectIndustry(ragContext);
    
    return {
      ...baseEnhancement,
      enhancedQuery: `${baseEnhancement.enhancedQuery} ${careerKeywords.join(' ')}`,
      addedContext: [
        ...baseEnhancement.addedContext,
        `career_stage:${careerStage}`,
        `industry:${industry}`,
      ],
      careerSpecific: {
        careerStage,
        industry,
        careerKeywords,
      },
    };
  }

  filterResults(results: any[], ragContext: any): any[] {
    const baseFiltered = super.filterResults(results, ragContext);
    
    // Apply career-specific filtering
    return baseFiltered.filter(result => {
      const metadata = result.metadata || {};
      
      // Boost career-relevant content
      if (metadata.career_stage === ragContext.careerStage) {
        result.similarity *= 1.3;
      }
      
      if (metadata.industry === ragContext.industry) {
        result.similarity *= 1.2;
      }
      
      return result.similarity >= 0.65; // Career coaching threshold
    });
  }

  private extractCareerKeywords(query: string): string[] {
    const careerTerms = [
      'promotion', 'career change', 'job search', 'interview', 'resume',
      'networking', 'skills development', 'leadership', 'performance review',
      'salary negotiation', 'work-life balance', 'professional growth',
    ];
    
    return careerTerms.filter(term => 
      query.toLowerCase().includes(term.toLowerCase())
    );
  }

  private detectCareerStage(ragContext: any): string {
    const userProfile = ragContext.userProfile || {};
    const content = ragContext.originalQuery?.toLowerCase() || '';
    
    if (content.includes('entry level') || content.includes('first job')) return 'entry_level';
    if (content.includes('mid level') || content.includes('manager')) return 'mid_level';
    if (content.includes('senior') || content.includes('director')) return 'senior_level';
    if (content.includes('executive') || content.includes('c-level')) return 'executive';
    if (content.includes('career change') || content.includes('transition')) return 'career_change';
    
    return 'mid_level'; // Default
  }

  private detectIndustry(ragContext: any): string {
    const content = ragContext.originalQuery?.toLowerCase() || '';
    
    if (content.includes('tech') || content.includes('software')) return 'technology';
    if (content.includes('finance') || content.includes('banking')) return 'finance';
    if (content.includes('healthcare') || content.includes('medical')) return 'healthcare';
    if (content.includes('education') || content.includes('teaching')) return 'education';
    if (content.includes('consulting')) return 'consulting';
    
    return 'other';
  }
}

/**
 * Relationship Coaching Domain Adapter
 */
class RelationshipCoachingAdapter extends LifeCoachingAdapter {
  constructor() {
    super('relationship_coaching');
  }

  enhanceQuery(originalQuery: string, ragContext: any): any {
    const baseEnhancement = super.enhanceQuery(originalQuery, ragContext);
    
    // Add relationship-specific enhancements
    const relationshipKeywords = this.extractRelationshipKeywords(originalQuery);
    const relationshipType = this.detectRelationshipType(ragContext);
    const communicationFocus = this.detectCommunicationFocus(ragContext);
    
    return {
      ...baseEnhancement,
      enhancedQuery: `${baseEnhancement.enhancedQuery} ${relationshipKeywords.join(' ')}`,
      addedContext: [
        ...baseEnhancement.addedContext,
        `relationship_type:${relationshipType}`,
        `communication_focus:${communicationFocus}`,
      ],
      relationshipSpecific: {
        relationshipType,
        communicationFocus,
        relationshipKeywords,
      },
    };
  }

  filterResults(results: any[], ragContext: any): any[] {
    const baseFiltered = super.filterResults(results, ragContext);
    
    // Apply relationship-specific filtering
    return baseFiltered.filter(result => {
      const metadata = result.metadata || {};
      
      // Boost relationship-relevant content
      if (metadata.relationship_type === ragContext.relationshipType) {
        result.similarity *= 1.25;
      }
      
      if (metadata.communication_focus === ragContext.communicationFocus) {
        result.similarity *= 1.15;
      }
      
      return result.similarity >= 0.6; // Relationship coaching threshold
    });
  }

  private extractRelationshipKeywords(query: string): string[] {
    const relationshipTerms = [
      'communication', 'conflict', 'trust', 'intimacy', 'boundaries',
      'empathy', 'listening', 'respect', 'compromise', 'understanding',
      'love language', 'quality time', 'emotional support',
    ];
    
    return relationshipTerms.filter(term => 
      query.toLowerCase().includes(term.toLowerCase())
    );
  }

  private detectRelationshipType(ragContext: any): string {
    const content = ragContext.originalQuery?.toLowerCase() || '';
    
    if (content.includes('romantic') || content.includes('partner') || content.includes('spouse')) return 'romantic';
    if (content.includes('family') || content.includes('parent') || content.includes('sibling')) return 'family';
    if (content.includes('friend') || content.includes('friendship')) return 'friendship';
    if (content.includes('work') || content.includes('colleague') || content.includes('boss')) return 'professional';
    
    return 'general';
  }

  private detectCommunicationFocus(ragContext: any): string {
    const content = ragContext.originalQuery?.toLowerCase() || '';
    
    if (content.includes('conflict') || content.includes('argument') || content.includes('fight')) return 'conflict_resolution';
    if (content.includes('express') || content.includes('feelings') || content.includes('emotion')) return 'emotional_expression';
    if (content.includes('listen') || content.includes('hear') || content.includes('understand')) return 'active_listening';
    if (content.includes('boundary') || content.includes('limit') || content.includes('space')) return 'boundary_setting';
    
    return 'emotional_expression';
  }
}

describe('Multi-Domain Architecture Validation', () => {
  let configLoader: DomainConfigLoaderService;
  let mockUserInput: UserInput;
  let mockContext: AgentContext;

  beforeEach(() => {
    configLoader = new DomainConfigLoaderService();
    
    mockUserInput = {
      mentalState: 'I am struggling with communication in my relationships and need help',
      sleepPattern: 7,
      stressLevel: 6,
      supportSystem: ['family', 'friends'],
      recentChanges: 'Started having more conflicts with my partner',
      currentSymptoms: ['relationship stress', 'communication difficulties'],
    };

    mockContext = {
      sessionId: 'multi-domain-test-session',
      userId: 'multi-domain-test-user',
      previousResponses: [],
    };
  });

  describe('Domain Configuration Loading', () => {
    it('should load different domain configurations', async () => {
      // Mock file system for different domains
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(yaml.dump(mockCareerCoachingConfig))
        .mockReturnValueOnce(yaml.dump(mockRelationshipCoachingConfig));
      jest.spyOn(yaml, 'load')
        .mockReturnValueOnce(mockCareerCoachingConfig)
        .mockReturnValueOnce(mockRelationshipCoachingConfig);

      const careerConfig = await configLoader.loadDomainConfig('career_coaching');
      const relationshipConfig = await configLoader.loadDomainConfig('relationship_coaching');

      expect(careerConfig.config.name).toBe('career_coaching');
      expect(careerConfig.config.methodologies).toContain('Career Anchors Assessment');
      
      expect(relationshipConfig.config.name).toBe('relationship_coaching');
      expect(relationshipConfig.config.methodologies).toContain('Gottman Method');
      
      // Verify configurations are different
      expect(careerConfig.config.filtering_rules.minimum_relevance_score).not.toBe(
        relationshipConfig.config.filtering_rules.minimum_relevance_score
      );
    });

    it('should validate domain-specific metadata schemas', async () => {
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockCareerCoachingConfig));
      jest.spyOn(yaml, 'load').mockReturnValue(mockCareerCoachingConfig);

      const result = await configLoader.loadDomainConfig('career_coaching');
      const validation = configLoader.validateDomainConfig(result.config);

      expect(validation.valid).toBe(true);
      expect(result.config.metadata_schema.career_stage).toBeDefined();
      expect(result.config.metadata_schema.career_stage.values).toContain('entry_level');
      expect(result.config.metadata_schema.industry).toBeDefined();
    });

    it('should handle domain-specific personalization weights', async () => {
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockRelationshipCoachingConfig));
      jest.spyOn(yaml, 'load').mockReturnValue(mockRelationshipCoachingConfig);

      const result = await configLoader.loadDomainConfig('relationship_coaching');

      expect(result.config.personalization.relationship_type_weight).toBe(0.3);
      expect(result.config.personalization.communication_style_weight).toBe(0.25);
      
      // Verify different from life coaching defaults
      expect(result.config.personalization).not.toEqual({
        methodology_preference_weight: 0.3,
        complexity_preference_weight: 0.2,
        goal_alignment_weight: 0.25,
      });
    });
  });

  describe('Domain Adapter Factory', () => {
    it('should create domain-specific adapters', () => {
      // Register custom adapters
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());

      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');
      const lifeCoachingAdapter = DomainAdapterFactory.getAdapter('life_coaching');

      expect(careerAdapter).toBeInstanceOf(CareerCoachingAdapter);
      expect(relationshipAdapter).toBeInstanceOf(RelationshipCoachingAdapter);
      expect(lifeCoachingAdapter).toBeInstanceOf(LifeCoachingAdapter);
    });

    it('should fallback to base adapter for unknown domains', () => {
      const unknownAdapter = DomainAdapterFactory.getAdapter('unknown_domain');
      expect(unknownAdapter).toBeInstanceOf(LifeCoachingAdapter);
    });

    it('should maintain adapter instances (singleton pattern)', () => {
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());

      const adapter1 = DomainAdapterFactory.getAdapter('career_coaching');
      const adapter2 = DomainAdapterFactory.getAdapter('career_coaching');

      expect(adapter1).toBe(adapter2);
    });
  });

  describe('Domain-Specific Query Enhancement', () => {
    beforeEach(() => {
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());
    });

    it('should enhance queries differently for different domains', () => {
      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');

      const careerQuery = 'I need help with my career advancement and job search';
      const relationshipQuery = 'I need help with communication in my relationship';

      const careerRagContext = { originalQuery: careerQuery, domainId: 'career_coaching' };
      const relationshipRagContext = { originalQuery: relationshipQuery, domainId: 'relationship_coaching' };

      const careerEnhancement = careerAdapter.enhanceQuery(careerQuery, careerRagContext);
      const relationshipEnhancement = relationshipAdapter.enhanceQuery(relationshipQuery, relationshipRagContext);

      // Career enhancement should include career-specific context
      expect(careerEnhancement.addedContext).toContain('career_stage:mid_level');
      expect(careerEnhancement.careerSpecific).toBeDefined();
      expect(careerEnhancement.careerSpecific.careerKeywords).toContain('job search');

      // Relationship enhancement should include relationship-specific context
      expect(relationshipEnhancement.addedContext).toContain('relationship_type:romantic');
      expect(relationshipEnhancement.addedContext).toContain('communication_focus:emotional_expression');
      expect(relationshipEnhancement.relationshipSpecific).toBeDefined();
      expect(relationshipEnhancement.relationshipSpecific.relationshipKeywords).toContain('communication');
    });

    it('should apply domain-specific keyword detection', () => {
      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      
      const careerQuery = 'I need help with salary negotiation and networking for my promotion';
      const ragContext = { originalQuery: careerQuery, domainId: 'career_coaching' };

      const enhancement = careerAdapter.enhanceQuery(careerQuery, ragContext);

      expect(enhancement.careerSpecific.careerKeywords).toContain('promotion');
      expect(enhancement.careerSpecific.careerKeywords).toContain('networking');
      expect(enhancement.careerSpecific.careerKeywords).toContain('salary negotiation');
    });

    it('should detect domain-specific contexts accurately', () => {
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');
      
      const familyQuery = 'I have conflicts with my family members and need boundary setting help';
      const romanticQuery = 'My partner and I struggle with intimacy and trust issues';

      const familyRagContext = { originalQuery: familyQuery, domainId: 'relationship_coaching' };
      const romanticRagContext = { originalQuery: romanticQuery, domainId: 'relationship_coaching' };

      const familyEnhancement = relationshipAdapter.enhanceQuery(familyQuery, familyRagContext);
      const romanticEnhancement = relationshipAdapter.enhanceQuery(romanticQuery, romanticRagContext);

      expect(familyEnhancement.relationshipSpecific.relationshipType).toBe('family');
      expect(familyEnhancement.relationshipSpecific.communicationFocus).toBe('boundary_setting');

      expect(romanticEnhancement.relationshipSpecific.relationshipType).toBe('romantic');
      expect(romanticEnhancement.relationshipSpecific.communicationFocus).toBe('emotional_expression');
    });
  });

  describe('Domain-Specific Result Filtering', () => {
    beforeEach(() => {
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());
    });

    it('should apply different filtering rules for different domains', () => {
      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');

      const mockResults = [
        {
          id: '1',
          content: 'Career advancement strategies',
          similarity: 0.7,
          metadata: { career_stage: 'mid_level', industry: 'technology' },
        },
        {
          id: '2',
          content: 'Communication in relationships',
          similarity: 0.65,
          metadata: { relationship_type: 'romantic', communication_focus: 'emotional_expression' },
        },
        {
          id: '3',
          content: 'General life advice',
          similarity: 0.6,
          metadata: {},
        },
      ];

      const careerRagContext = { careerStage: 'mid_level', industry: 'technology' };
      const relationshipRagContext = { relationshipType: 'romantic', communicationFocus: 'emotional_expression' };

      const careerFiltered = careerAdapter.filterResults([...mockResults], careerRagContext);
      const relationshipFiltered = relationshipAdapter.filterResults([...mockResults], relationshipRagContext);

      // Career adapter should boost career-relevant results and filter by higher threshold
      const careerResult = careerFiltered.find(r => r.id === '1');
      expect(careerResult.similarity).toBeGreaterThan(0.7); // Boosted due to matching metadata

      // Relationship adapter should boost relationship-relevant results
      const relationshipResult = relationshipFiltered.find(r => r.id === '2');
      expect(relationshipResult.similarity).toBeGreaterThan(0.65); // Boosted due to matching metadata

      // Career adapter filters more strictly (0.65 threshold)
      expect(careerFiltered.length).toBeLessThanOrEqual(relationshipFiltered.length);
    });

    it('should maintain domain-specific similarity thresholds', () => {
      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');

      const lowSimilarityResults = [
        { id: '1', content: 'Low relevance content', similarity: 0.5, metadata: {} },
        { id: '2', content: 'Medium relevance content', similarity: 0.63, metadata: {} },
        { id: '3', content: 'High relevance content', similarity: 0.8, metadata: {} },
      ];

      const careerFiltered = careerAdapter.filterResults([...lowSimilarityResults], {});
      const relationshipFiltered = relationshipAdapter.filterResults([...lowSimilarityResults], {});

      // Career coaching has higher threshold (0.65)
      expect(careerFiltered.length).toBe(1); // Only the 0.8 result passes
      
      // Relationship coaching has lower threshold (0.6)
      expect(relationshipFiltered.length).toBe(2); // 0.63 and 0.8 results pass
    });
  });

  describe('Multi-Domain Agent Integration', () => {
    class CareerCoachingAgent extends EnhancedBaseAgent {
      constructor() {
        super(
          'CareerCoachingAgent',
          'Career Development Specialist',
          'You are a career development specialist focusing on professional growth and advancement.',
          { ragEnabled: true, hybridSearchEnabled: true }
        );
      }

      protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
        return {
          ...ragContext,
          domainId: 'career_coaching',
          preferredMethodology: 'Career Anchors Assessment',
          careerStage: 'mid_level',
          industry: 'technology',
        };
      }

      protected filterKnowledgeForRole(knowledgeResults: any[], ragContext: any): any[] {
        return knowledgeResults.filter(result => 
          result.document.category === 'methodologies' ||
          result.content.toLowerCase().includes('career') ||
          result.content.toLowerCase().includes('professional')
        );
      }
    }

    class RelationshipCoachingAgent extends EnhancedBaseAgent {
      constructor() {
        super(
          'RelationshipCoachingAgent',
          'Relationship Development Specialist',
          'You are a relationship development specialist focusing on interpersonal skills and communication.',
          { ragEnabled: true, hybridSearchEnabled: true }
        );
      }

      protected customizeRAGContext(ragContext: any, input: UserInput, context?: AgentContext): any {
        return {
          ...ragContext,
          domainId: 'relationship_coaching',
          preferredMethodology: 'Gottman Method',
          relationshipType: 'romantic',
          communicationFocus: 'emotional_expression',
        };
      }

      protected filterKnowledgeForRole(knowledgeResults: any[], ragContext: any): any[] {
        return knowledgeResults.filter(result => 
          result.document.category === 'methodologies' ||
          result.content.toLowerCase().includes('relationship') ||
          result.content.toLowerCase().includes('communication')
        );
      }
    }

    beforeEach(() => {
      // Mock RAG services
      jest.spyOn(ragFoundationService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(ragFoundationService, 'isReady').mockReturnValue(true);
      
      // Register domain adapters
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());
    });

    it('should use different domain adapters for different agents', async () => {
      const careerAgent = new CareerCoachingAgent();
      const relationshipAgent = new RelationshipCoachingAgent();

      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([
        {
          id: 'test-result',
          content: 'Test knowledge content',
          similarity: 0.8,
          document: { title: 'Test Document', category: 'methodologies' },
          metadata: {},
          chunk_index: 0,
        },
      ]);

      const careerInput = {
        ...mockUserInput,
        mentalState: 'I need help with career advancement and professional development',
      };

      const relationshipInput = {
        ...mockUserInput,
        mentalState: 'I need help with communication in my romantic relationship',
      };

      // Get domain adapters used by each agent
      const careerAdapter = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');

      expect(careerAdapter).toBeInstanceOf(CareerCoachingAdapter);
      expect(relationshipAdapter).toBeInstanceOf(RelationshipCoachingAdapter);
      expect(careerAdapter).not.toBe(relationshipAdapter);
    });

    it('should maintain domain-specific context across agent processing', async () => {
      const careerAgent = new CareerCoachingAgent();
      
      // Mock feature flags
      const { featureFlagService } = require('../../services/feature-flag.service');
      jest.spyOn(featureFlagService, 'isEnabled').mockResolvedValue(true);

      // Mock knowledge retrieval
      jest.spyOn(ragFoundationService, 'hybridSearch').mockResolvedValue([]);

      // Mock domain adapter
      const mockDomainAdapter = {
        enhanceQuery: jest.fn().mockReturnValue({
          enhancedQuery: 'enhanced career query',
          originalQuery: 'original query',
          addedContext: ['career_stage:mid_level', 'industry:technology'],
          confidence: 0.8,
        }),
        filterResults: jest.fn().mockImplementation((results) => results),
      };
      
      jest.spyOn(DomainAdapterFactory, 'getAdapter').mockReturnValue(mockDomainAdapter);

      const careerInput = {
        ...mockUserInput,
        mentalState: 'I need help with career advancement strategies',
      };

      await careerAgent.process(careerInput, mockContext);

      // Verify domain adapter was called with career-specific context
      expect(mockDomainAdapter.enhanceQuery).toHaveBeenCalled();
      const enhanceQueryCall = mockDomainAdapter.enhanceQuery.mock.calls[0];
      const ragContext = enhanceQueryCall[1];

      expect(ragContext.domainId).toBe('career_coaching');
      expect(ragContext.preferredMethodology).toBe('Career Anchors Assessment');
      expect(ragContext.careerStage).toBe('mid_level');
      expect(ragContext.industry).toBe('technology');
    });
  });

  describe('Domain Switching and Isolation', () => {
    it('should maintain separate configurations for each domain', async () => {
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(yaml.dump(mockCareerCoachingConfig))
        .mockReturnValueOnce(yaml.dump(mockRelationshipCoachingConfig));
      jest.spyOn(yaml, 'load')
        .mockReturnValueOnce(mockCareerCoachingConfig)
        .mockReturnValueOnce(mockRelationshipCoachingConfig);

      const careerConfig = await configLoader.loadDomainConfig('career_coaching');
      const relationshipConfig = await configLoader.loadDomainConfig('relationship_coaching');

      // Verify configurations are isolated
      expect(careerConfig.config.name).toBe('career_coaching');
      expect(relationshipConfig.config.name).toBe('relationship_coaching');
      
      expect(careerConfig.config.methodologies).not.toEqual(relationshipConfig.config.methodologies);
      expect(careerConfig.config.metadata_schema).not.toEqual(relationshipConfig.config.metadata_schema);
      expect(careerConfig.config.filtering_rules).not.toEqual(relationshipConfig.config.filtering_rules);
    });

    it('should handle domain switching without cross-contamination', () => {
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());

      const careerAdapter1 = DomainAdapterFactory.getAdapter('career_coaching');
      const relationshipAdapter = DomainAdapterFactory.getAdapter('relationship_coaching');
      const careerAdapter2 = DomainAdapterFactory.getAdapter('career_coaching');

      // Verify same domain returns same instance
      expect(careerAdapter1).toBe(careerAdapter2);
      
      // Verify different domains return different instances
      expect(careerAdapter1).not.toBe(relationshipAdapter);
      
      // Verify instances maintain their domain-specific behavior
      expect(careerAdapter1.domainId).toBe('career_coaching');
      expect(relationshipAdapter.domainId).toBe('relationship_coaching');
    });

    it('should support dynamic domain detection and switching', () => {
      DomainAdapterFactory.registerAdapter('career_coaching', () => new CareerCoachingAdapter());
      DomainAdapterFactory.registerAdapter('relationship_coaching', () => new RelationshipCoachingAdapter());

      const detectDomain = (userInput: UserInput): string => {
        const content = userInput.mentalState.toLowerCase();
        
        if (content.includes('career') || content.includes('job') || content.includes('work')) {
          return 'career_coaching';
        }
        if (content.includes('relationship') || content.includes('partner') || content.includes('communication')) {
          return 'relationship_coaching';
        }
        return 'life_coaching';
      };

      const careerInput = { ...mockUserInput, mentalState: 'I need help with my career development' };
      const relationshipInput = { ...mockUserInput, mentalState: 'I need help with my relationship communication' };
      const generalInput = { ...mockUserInput, mentalState: 'I need help with general life balance' };

      expect(detectDomain(careerInput)).toBe('career_coaching');
      expect(detectDomain(relationshipInput)).toBe('relationship_coaching');
      expect(detectDomain(generalInput)).toBe('life_coaching');
    });
  });

  describe('Scalability and Performance', () => {
    it('should handle multiple domains efficiently', () => {
      // Register multiple domains
      const domains = ['career_coaching', 'relationship_coaching', 'health_coaching', 'financial_coaching'];
      
      domains.forEach(domain => {
        DomainAdapterFactory.registerAdapter(domain, () => new LifeCoachingAdapter(domain));
      });

      // Test concurrent access to different domains
      const adapters = domains.map(domain => DomainAdapterFactory.getAdapter(domain));
      
      // Verify all adapters are created and unique
      expect(adapters.length).toBe(4);
      expect(new Set(adapters).size).toBe(4); // All unique instances
      
      // Verify performance (adapters should be cached)
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        domains.forEach(domain => DomainAdapterFactory.getAdapter(domain));
      }
      const endTime = Date.now();
      
      // Should be very fast due to caching
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should support configuration caching across domains', async () => {
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockCareerCoachingConfig));
      jest.spyOn(yaml, 'load').mockReturnValue(mockCareerCoachingConfig);

      // Load same configuration multiple times
      await configLoader.loadDomainConfig('career_coaching');
      await configLoader.loadDomainConfig('career_coaching');
      await configLoader.loadDomainConfig('career_coaching');

      // File should only be read once due to caching
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });
});

// Export utility functions for domain testing
export function createDomainTestInput(domain: string, overrides: Partial<UserInput> = {}): UserInput {
  const domainSpecificInputs = {
    career_coaching: {
      mentalState: 'I need help with career advancement and professional development',
      currentSymptoms: ['work stress', 'career uncertainty'],
    },
    relationship_coaching: {
      mentalState: 'I need help with communication in my relationships',
      currentSymptoms: ['relationship stress', 'communication difficulties'],
    },
    life_coaching: {
      mentalState: 'I need help with overall life balance and personal growth',
      currentSymptoms: ['general stress', 'life direction uncertainty'],
    },
  };

  return {
    sleepPattern: 7,
    stressLevel: 6,
    supportSystem: ['family', 'friends'],
    recentChanges: 'Recent life changes requiring coaching support',
    ...domainSpecificInputs[domain] || domainSpecificInputs.life_coaching,
    ...overrides,
  };
}

export function validateDomainConfiguration(config: any, expectedDomain: string): boolean {
  return (
    config.name === expectedDomain &&
    Array.isArray(config.methodologies) &&
    config.methodologies.length > 0 &&
    typeof config.filtering_rules === 'object' &&
    typeof config.personalization === 'object' &&
    Array.isArray(config.assessment_frameworks)
  );
}