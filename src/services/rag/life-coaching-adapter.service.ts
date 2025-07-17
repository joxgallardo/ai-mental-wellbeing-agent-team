import { 
  BaseDomainAdapter, 
  DomainContext, 
  QueryEnhancementResult, 
  FilteredResult,
  DomainAdapterFactory 
} from './domain-adapter.service';
import { SearchResult } from '../../types/database';

/**
 * Life Coaching Domain Adapter
 * 
 * Specialized adapter for life coaching domain with:
 * - Life area detection and context enhancement
 * - Methodology-based query enhancement
 * - Personal development focused filtering
 * - Goal alignment and values clarification
 * - GROW Model and other coaching framework integration
 */
export class LifeCoachingAdapter extends BaseDomainAdapter {
  private lifeAreaKeywords: Record<string, string[]>;
  private methodologyKeywords: Record<string, string[]>;
  private goalKeywords: Record<string, string[]>;

  constructor() {
    super('life_coaching');
    
    // Initialize keyword mappings from config
    this.initializeKeywordMappings();
    
    this.logger.info('Life Coaching Adapter initialized', {
      methodologies: this.getMethodologies().length,
      lifeAreas: Object.keys(this.lifeAreaKeywords).length,
    });
  }

  /**
   * Initialize keyword mappings from configuration
   */
  private initializeKeywordMappings(): void {
    // Life area keywords
    this.lifeAreaKeywords = {
      career: ['work', 'job', 'career', 'professional', 'workplace', 'promotion', 'boss', 'colleagues'],
      relationships: ['relationship', 'partner', 'family', 'friends', 'marriage', 'dating', 'social', 'love'],
      health: ['health', 'fitness', 'exercise', 'diet', 'wellness', 'medical', 'physical', 'nutrition'],
      personal_growth: ['growth', 'development', 'learning', 'skills', 'improvement', 'self', 'mindset'],
      finances: ['money', 'financial', 'budget', 'debt', 'savings', 'investment', 'income', 'expenses'],
      spirituality: ['spiritual', 'faith', 'meditation', 'mindfulness', 'religion', 'meaning', 'purpose'],
      recreation: ['hobbies', 'fun', 'entertainment', 'leisure', 'vacation', 'sports', 'games', 'travel'],
      environment: ['home', 'living', 'space', 'organization', 'environment', 'surroundings', 'clutter'],
    };

    // Methodology keywords
    this.methodologyKeywords = {
      'GROW Model': ['goal', 'reality', 'options', 'will', 'grow', 'planning', 'action'],
      'Values Clarification': ['values', 'important', 'meaning', 'priorities', 'beliefs', 'principles'],
      'Life Wheel Assessment': ['balance', 'areas', 'satisfaction', 'wheel', 'assessment', 'life domains'],
      'Solution-Focused Coaching': ['solutions', 'strengths', 'resources', 'exceptions', 'scaling', 'miracle'],
      'Appreciative Inquiry': ['strengths', 'positive', 'appreciate', 'best', 'peak', 'excellence'],
      'Cognitive Behavioral Coaching': ['thoughts', 'feelings', 'behavior', 'patterns', 'beliefs', 'cognitive'],
      'Mindfulness-Based Coaching': ['mindfulness', 'present', 'awareness', 'meditation', 'mindful', 'attention'],
    };

    // Goal type keywords
    this.goalKeywords = {
      'short-term': ['immediate', 'soon', 'quick', 'next week', 'next month', 'urgent'],
      'long-term': ['future', 'years', 'long term', 'eventually', 'someday', 'life'],
      'life-changing': ['transform', 'change', 'major', 'significant', 'life changing', 'big'],
      'skill-building': ['learn', 'skill', 'develop', 'practice', 'improve', 'master'],
      'relationship': ['relationship', 'social', 'interpersonal', 'communication', 'connection'],
      'career': ['career', 'professional', 'work', 'job', 'promotion', 'business'],
    };
  }

  /**
   * Enhance query with life coaching context
   */
  override enhanceQuery(query: string, context: DomainContext): QueryEnhancementResult {
    const originalQuery = query;
    let enhancedQuery = query;
    const addedContext: string[] = [];
    let confidence = 0.5;

    // Detect life area and add context
    const detectedLifeArea = this.detectLifeArea(query, context);
    if (detectedLifeArea) {
      const lifeAreaContext = this.config.query_enhancement?.context_mapping?.[detectedLifeArea];
      if (lifeAreaContext) {
        enhancedQuery += ` ${lifeAreaContext}`;
        addedContext.push(`life_area:${detectedLifeArea}`);
        confidence += 0.2;
      }
    }

    // Add methodology context if preferred
    if (context.preferredMethodology) {
      const methodologyKeywords = this.methodologyKeywords[context.preferredMethodology];
      if (methodologyKeywords) {
        enhancedQuery += ` focusing on ${context.preferredMethodology} approach`;
        addedContext.push(`methodology:${context.preferredMethodology}`);
        confidence += 0.15;
      }
    }

    // Add goal context if available
    if (context.currentGoals && context.currentGoals.length > 0) {
      const goalContext = context.currentGoals.join(' ');
      enhancedQuery += ` related to goals: ${goalContext}`;
      addedContext.push(`goals:${context.currentGoals.join(',')}`);
      confidence += 0.1;
    }

    // Add complexity level context
    if (context.complexityLevel) {
      const complexityContext = this.getComplexityContext(context.complexityLevel);
      enhancedQuery += ` ${complexityContext}`;
      addedContext.push(`complexity:${context.complexityLevel}`);
      confidence += 0.05;
    }

    // Add personal development keywords
    const personalDevKeywords = this.config.query_enhancement?.keywords?.personal_development;
    if (personalDevKeywords) {
      const matchedKeywords = personalDevKeywords.filter(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        enhancedQuery += ` personal development coaching`;
        addedContext.push(`pd_keywords:${matchedKeywords.join(',')}`);
        confidence += 0.1;
      }
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    this.logger.debug('Query enhanced for life coaching', {
      originalLength: originalQuery.length,
      enhancedLength: enhancedQuery.length,
      contextAdded: addedContext.length,
      confidence,
    });

    return {
      enhancedQuery,
      originalQuery,
      addedContext,
      confidence,
    };
  }

  /**
   * Filter and score results based on life coaching criteria
   */
  override filterResults(results: SearchResult[], context: DomainContext): FilteredResult[] {
    const rules = this.getFilteringRules();
    const minRelevanceScore = rules.minimum_relevance_score || 0.6;
    
    const filteredResults: FilteredResult[] = [];

    for (const result of results) {
      // Apply minimum relevance filter
      if (result.similarity < minRelevanceScore) {
        continue;
      }

      // Calculate personalization score
      const personalizationScore = this.calculatePersonalizationScore(result, context);
      
      // Apply boost factors
      const { boostedScore, boostFactors } = this.applyBoostFactors(result, context);
      
      // Combine scores
      const finalScore = (boostedScore * 0.7) + (personalizationScore * 0.3);
      
      // Create filtered result
      const filteredResult: FilteredResult = {
        ...result,
        similarity: finalScore,
        originalScore: result.similarity,
        boostedScore,
        boostFactors,
        filterReasons: this.getFilterReasons(result, context),
      };

      filteredResults.push(filteredResult);
    }

    // Sort by final score
    filteredResults.sort((a, b) => b.similarity - a.similarity);

    this.logger.debug('Results filtered for life coaching', {
      originalCount: results.length,
      filteredCount: filteredResults.length,
      averageScore: filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length,
    });

    return filteredResults;
  }

  /**
   * Detect life area from query and context
   */
  detectLifeArea(query: string, context: DomainContext): string | null {
    // Check context first
    if (context.lifeArea) {
      return context.lifeArea;
    }

    const queryLower = query.toLowerCase();
    let bestMatch: string | null = null;
    let bestScore = 0;

    // Check each life area
    for (const [lifeArea, keywords] of Object.entries(this.lifeAreaKeywords)) {
      const matchCount = keywords.filter(keyword => 
        queryLower.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = lifeArea;
      }
    }

    // Require at least one keyword match
    if (bestScore > 0) {
      this.logger.debug('Life area detected', {
        query: query.substring(0, 50),
        lifeArea: bestMatch,
        matchCount: bestScore,
      });
      return bestMatch;
    }

    return null;
  }

  /**
   * Get recommended methodology based on query and context
   */
  getRecommendedMethodology(query: string, context: DomainContext): string | null {
    // Check context first
    if (context.preferredMethodology) {
      return context.preferredMethodology;
    }

    const queryLower = query.toLowerCase();
    let bestMatch: string | null = null;
    let bestScore = 0;

    // Check each methodology
    for (const [methodology, keywords] of Object.entries(this.methodologyKeywords)) {
      const matchCount = keywords.filter(keyword => 
        queryLower.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = methodology;
      }
    }

    // Apply domain-specific logic
    if (bestMatch) {
      this.logger.debug('Methodology recommended', {
        query: query.substring(0, 50),
        methodology: bestMatch,
        matchCount: bestScore,
      });
      return bestMatch;
    }

    // Default recommendations based on life area
    const lifeArea = this.detectLifeArea(query, context);
    if (lifeArea) {
      const defaultMethodologies: Record<string, string> = {
        career: 'GROW Model',
        relationships: 'Solution-Focused Coaching',
        health: 'Mindfulness-Based Coaching',
        personal_growth: 'Values Clarification',
        finances: 'GROW Model',
        spirituality: 'Appreciative Inquiry',
        recreation: 'Life Wheel Assessment',
        environment: 'Solution-Focused Coaching',
      };

      return defaultMethodologies[lifeArea] || null;
    }

    return null;
  }

  /**
   * Get complexity context for query enhancement
   */
  private getComplexityContext(level: string): string {
    const contextMap: Record<string, string> = {
      beginner: 'with simple, basic, and easy-to-understand approaches',
      intermediate: 'with practical, actionable, and well-structured methods',
      advanced: 'with sophisticated, comprehensive, and nuanced strategies',
    };

    return contextMap[level] || '';
  }

  /**
   * Get filter reasons for debugging
   */
  private getFilterReasons(result: SearchResult, context: DomainContext): string[] {
    const reasons: string[] = [];

    // Relevance threshold
    const rules = this.getFilteringRules();
    if (result.similarity >= (rules.minimum_relevance_score || 0.6)) {
      reasons.push('passed_relevance_threshold');
    }

    // Methodology match
    if (context.preferredMethodology && result.metadata['methodology'] === context.preferredMethodology) {
      reasons.push('methodology_match');
    }

    // Life area match
    const lifeArea = this.detectLifeArea(result.content, context);
    if (lifeArea && context.lifeArea === lifeArea) {
      reasons.push('life_area_match');
    }

    // Complexity match
    if (context.complexityLevel && result.metadata['complexity_level'] === context.complexityLevel) {
      reasons.push('complexity_match');
    }

    // Evidence level
    if (result.metadata['evidence_level'] === 'research-based') {
      reasons.push('high_evidence_level');
    }

    return reasons;
  }

  /**
   * Get assessment frameworks for this domain
   */
  getAssessmentFrameworks(): any[] {
    return this.config.assessment_frameworks || [];
  }

  /**
   * Get resource categories for this domain
   */
  getResourceCategories(): Record<string, any> {
    return this.config.resource_categories || {};
  }

  /**
   * Check if query matches goal type
   */
  matchesGoalType(query: string, goalType: string): boolean {
    const keywords = this.goalKeywords[goalType];
    if (!keywords) return false;

    const queryLower = query.toLowerCase();
    return keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  }

  /**
   * Get life areas for this domain
   */
  getLifeAreas(): string[] {
    return Object.keys(this.lifeAreaKeywords);
  }

  /**
   * Get methodology keywords for debugging
   */
  getMethodologyKeywords(): Record<string, string[]> {
    return { ...this.methodologyKeywords };
  }

  /**
   * Get life area keywords for debugging
   */
  getLifeAreaKeywords(): Record<string, string[]> {
    return { ...this.lifeAreaKeywords };
  }
}

// Register the adapter with the factory
DomainAdapterFactory.registerAdapter('life_coaching', LifeCoachingAdapter);