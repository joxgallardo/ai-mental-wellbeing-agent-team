import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../../utils/logger';
import { SearchResult, DomainConfig, DomainConfigError } from '../../types/database';

/**
 * Domain Adapter System - YAML-driven configuration for RAG domains
 * 
 * Features:
 * - Abstract base class for domain-specific behavior
 * - YAML configuration loading and validation
 * - Query enhancement and result filtering
 * - Personalization and context awareness
 * - Extensible domain registration system
 */

export interface DomainContext {
  sessionId: string;
  userId?: string;
  preferredMethodology?: string;
  lifeArea?: string;
  complexityLevel?: 'beginner' | 'intermediate' | 'advanced';
  currentGoals?: string[];
  sessionHistory?: string[];
  userProfile?: Record<string, any>;
}

export interface QueryEnhancementResult {
  enhancedQuery: string;
  originalQuery: string;
  addedContext: string[];
  confidence: number;
}

export interface FilteredResult extends SearchResult {
  originalScore: number;
  boostedScore: number;
  boostFactors: Record<string, number>;
  filterReasons: string[];
}

/**
 * Abstract base class for domain-specific RAG behavior
 */
export abstract class BaseDomainAdapter {
  protected config: DomainConfig;
  protected logger = createLogger('DomainAdapter');
  protected domainName: string;

  constructor(domainName: string) {
    this.domainName = domainName;
    this.config = this.loadDomainConfig(domainName);
    this.validateConfig();
    
    this.logger.info('Domain adapter initialized', {
      domain: domainName,
      methodologies: this.config.methodologies?.length || 0,
      knowledgeSources: this.config.knowledge_sources?.length || 0,
    });
  }

  /**
   * Load domain configuration from YAML file
   */
  private loadDomainConfig(domainName: string): DomainConfig {
    try {
      const configPath = join(
        process.cwd(),
        'config',
        'domains',
        domainName,
        'domain_config.yml'
      );
      
      const configFile = readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile) as DomainConfig;
      
      if (!config) {
        throw new Error('Empty configuration file');
      }
      
      return config;
    } catch (error) {
      this.logger.error('Failed to load domain configuration', {
        domain: domainName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new DomainConfigError(
        `Failed to load domain config for ${domainName}: ${error}`,
        { domainName, originalError: error }
      );
    }
  }

  /**
   * Validate domain configuration
   */
  private validateConfig(): void {
    const requiredFields = ['name', 'display_name', 'description', 'knowledge_sources'];
    
    for (const field of requiredFields) {
      if (!this.config[field as keyof DomainConfig]) {
        throw new DomainConfigError(
          `Missing required field: ${field}`,
          { domainName: this.domainName, field }
        );
      }
    }

    // Validate knowledge sources
    if (!Array.isArray(this.config.knowledge_sources) || this.config.knowledge_sources.length === 0) {
      throw new DomainConfigError(
        'knowledge_sources must be a non-empty array',
        { domainName: this.domainName }
      );
    }

    // Validate methodologies
    if (this.config.methodologies && !Array.isArray(this.config.methodologies)) {
      throw new DomainConfigError(
        'methodologies must be an array',
        { domainName: this.domainName }
      );
    }

    // Validate retrieval preferences
    if (this.config.retrieval_preferences) {
      const weights = Object.values(this.config.retrieval_preferences);
      const sum = weights.reduce((a, b) => a + b, 0);
      
      if (Math.abs(sum - 1.0) > 0.01) {
        this.logger.warn('Retrieval preference weights do not sum to 1.0', {
          domain: this.domainName,
          sum,
          weights: this.config.retrieval_preferences,
        });
      }
    }

    this.logger.debug('Domain configuration validated successfully', {
      domain: this.domainName,
    });
  }

  /**
   * Abstract methods to be implemented by specific domain adapters
   */
  abstract enhanceQuery(query: string, context: DomainContext): QueryEnhancementResult;
  abstract filterResults(results: SearchResult[], context: DomainContext): FilteredResult[];
  abstract detectLifeArea(query: string, context: DomainContext): string | null;
  abstract getRecommendedMethodology(query: string, context: DomainContext): string | null;

  /**
   * Get knowledge collections for this domain
   */
  getKnowledgeCollections(): string[] {
    return this.config.knowledge_sources.map(source => 
      `${this.config.name}_${source}`
    );
  }

  /**
   * Get metadata schema for this domain
   */
  getMetadataSchema(): Record<string, any> {
    return this.config.metadata_schema || {};
  }

  /**
   * Get retrieval preferences with weights
   */
  getRetrievalPreferences(): Record<string, number> {
    return this.config.retrieval_preferences || {};
  }

  /**
   * Get personalization settings
   */
  getPersonalizationSettings(): Record<string, any> {
    return this.config.personalization || {};
  }

  /**
   * Get filtering rules
   */
  getFilteringRules(): Record<string, any> {
    return this.config.filtering_rules || {};
  }

  /**
   * Get escalation triggers
   */
  getEscalationTriggers(): string[] {
    return this.config.escalation_triggers || [];
  }

  /**
   * Check if query requires escalation
   */
  checkEscalationTriggers(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const triggers = this.getEscalationTriggers();
    
    return triggers.some(trigger => 
      lowerQuery.includes(trigger.toLowerCase())
    );
  }

  /**
   * Get domain configuration
   */
  getConfig(): DomainConfig {
    return { ...this.config };
  }

  /**
   * Get domain name
   */
  getDomainName(): string {
    return this.domainName;
  }

  /**
   * Get domain display name
   */
  getDisplayName(): string {
    return this.config.display_name;
  }

  /**
   * Get domain description
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * Get supported methodologies
   */
  getMethodologies(): string[] {
    return this.config.methodologies || [];
  }

  /**
   * Calculate personalization score for a result
   */
  protected calculatePersonalizationScore(
    result: SearchResult,
    context: DomainContext
  ): number {
    const personalization = this.getPersonalizationSettings();
    let score = 0;

    // Methodology preference
    if (context.preferredMethodology && result.metadata['methodology']) {
      if (result.metadata['methodology'] === context.preferredMethodology) {
        score += personalization['methodology_preference_weight'] || 0.3;
      }
    }

    // Complexity preference
    if (context.complexityLevel && result.metadata['complexity_level']) {
      if (result.metadata['complexity_level'] === context.complexityLevel) {
        score += personalization['complexity_preference_weight'] || 0.2;
      }
    }

    // Goal alignment
    if (context.currentGoals && result.metadata['goal_type']) {
      const goalMatch = context.currentGoals.some(goal => 
        result.metadata['goal_type'].toLowerCase().includes(goal.toLowerCase()) ||
        result.content.toLowerCase().includes(goal.toLowerCase())
      );
      
      if (goalMatch) {
        score += personalization['goal_alignment_weight'] || 0.25;
      }
    }

    // Life area alignment
    if (context.lifeArea && result.metadata['life_area']) {
      if (result.metadata['life_area'] === context.lifeArea) {
        score += 0.15; // Additional boost for life area match
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Apply boost factors to a result
   */
  protected applyBoostFactors(
    result: SearchResult,
    context: DomainContext
  ): { boostedScore: number; boostFactors: Record<string, number> } {
    const rules = this.getFilteringRules();
    const boostFactors: Record<string, number> = {};
    let boostedScore = result.similarity;

    // Apply boost factors from configuration
    if (rules.boost_factors) {
      // Methodology match
      if (context.preferredMethodology && result.metadata['methodology'] === context.preferredMethodology) {
        const factor = rules.boost_factors['methodology_match'] || 1.2;
        boostedScore *= factor;
        boostFactors.methodology_match = factor;
      }

      // Life area match
      if (context.lifeArea && result.metadata['life_area'] === context.lifeArea) {
        const factor = rules.boost_factors['life_area_match'] || 1.15;
        boostedScore *= factor;
        boostFactors.life_area_match = factor;
      }

      // Evidence level boost
      if (result.metadata['evidence_level'] === 'research-based') {
        const factor = rules.boost_factors['evidence_level_high'] || 1.1;
        boostedScore *= factor;
        boostFactors.evidence_level_high = factor;
      }

      // Complexity match
      if (context.complexityLevel && result.metadata['complexity_level'] === context.complexityLevel) {
        const factor = rules.boost_factors['complexity_match'] || 1.05;
        boostedScore *= factor;
        boostFactors.complexity_match = factor;
      }
    }

    // Apply penalty factors
    if (rules.penalty_factors) {
      // Complexity mismatch
      if (context.complexityLevel && result.metadata['complexity_level'] && 
          result.metadata['complexity_level'] !== context.complexityLevel) {
        const factor = rules.penalty_factors['complexity_mismatch'] || 0.9;
        boostedScore *= factor;
        boostFactors.complexity_mismatch = factor;
      }
    }

    return {
      boostedScore: Math.min(boostedScore, 1.0),
      boostFactors,
    };
  }
}

/**
 * Factory for creating domain adapters
 */
export class DomainAdapterFactory {
  private static adapters: Map<string, new () => BaseDomainAdapter> = new Map();
  private static instances: Map<string, BaseDomainAdapter> = new Map();
  private static logger = createLogger('DomainAdapterFactory');

  /**
   * Register a domain adapter class
   */
  static registerAdapter(domainName: string, adapterClass: new () => BaseDomainAdapter): void {
    this.adapters.set(domainName, adapterClass);
    this.logger.info('Domain adapter registered', { domain: domainName });
  }

  /**
   * Get domain adapter instance (singleton)
   */
  static getAdapter(domainName: string): BaseDomainAdapter {
    // Check if instance already exists
    if (this.instances.has(domainName)) {
      return this.instances.get(domainName)!;
    }

    // Check if adapter is registered
    const AdapterClass = this.adapters.get(domainName);
    if (!AdapterClass) {
      throw new DomainConfigError(
        `No adapter registered for domain: ${domainName}`,
        { domainName, availableDomains: Array.from(this.adapters.keys()) }
      );
    }

    // Create instance
    try {
      const instance = new AdapterClass();
      this.instances.set(domainName, instance);
      
      this.logger.info('Domain adapter instance created', { domain: domainName });
      return instance;
    } catch (error) {
      this.logger.error('Failed to create domain adapter instance', {
        domain: domainName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new DomainConfigError(
        `Failed to create adapter for domain: ${domainName}`,
        { domainName, originalError: error }
      );
    }
  }

  /**
   * Get all registered domain names
   */
  static getRegisteredDomains(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if domain is registered
   */
  static isDomainRegistered(domainName: string): boolean {
    return this.adapters.has(domainName);
  }

  /**
   * Clear all instances (for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
    this.logger.debug('All domain adapter instances cleared');
  }

  /**
   * Get adapter statistics
   */
  static getStats(): {
    registered: number;
    instantiated: number;
    domains: string[];
  } {
    return {
      registered: this.adapters.size,
      instantiated: this.instances.size,
      domains: Array.from(this.adapters.keys()),
    };
  }
}

/**
 * Domain configuration loader utility
 */
export class DomainConfigLoader {
  private static cache: Map<string, DomainConfig> = new Map();
  private static logger = createLogger('DomainConfigLoader');

  /**
   * Load domain configuration with caching
   */
  static loadConfig(domainName: string, useCache: boolean = true): DomainConfig {
    if (useCache && this.cache.has(domainName)) {
      return this.cache.get(domainName)!;
    }

    try {
      const configPath = join(
        process.cwd(),
        'config',
        'domains',
        domainName,
        'domain_config.yml'
      );
      
      const configFile = readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile) as DomainConfig;
      
      if (!config) {
        throw new Error('Empty configuration file');
      }

      // Cache the config
      this.cache.set(domainName, config);
      
      this.logger.debug('Domain configuration loaded', {
        domain: domainName,
        methodologies: config.methodologies?.length || 0,
        knowledgeSources: config.knowledge_sources?.length || 0,
      });

      return config;
    } catch (error) {
      this.logger.error('Failed to load domain configuration', {
        domain: domainName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new DomainConfigError(
        `Failed to load domain config for ${domainName}: ${error}`,
        { domainName, originalError: error }
      );
    }
  }

  /**
   * Reload configuration (bypass cache)
   */
  static reloadConfig(domainName: string): DomainConfig {
    this.cache.delete(domainName);
    return this.loadConfig(domainName, false);
  }

  /**
   * Clear configuration cache
   */
  static clearCache(): void {
    this.cache.clear();
    this.logger.debug('Domain configuration cache cleared');
  }

  /**
   * Get cached domains
   */
  static getCachedDomains(): string[] {
    return Array.from(this.cache.keys());
  }
}

// =====================================================
// Concrete Domain Adapter Implementations
// =====================================================

/**
 * Life Coaching Domain Adapter
 */
export class LifeCoachingAdapter extends BaseDomainAdapter {
  constructor() {
    super('life_coaching');
  }

  override enhanceQuery(query: string, context: DomainContext): QueryEnhancementResult {
    const addedContext: string[] = [];
    let enhancedQuery = query;

    // Add life area context
    if (context.lifeArea) {
      enhancedQuery += ` life area: ${context.lifeArea}`;
      addedContext.push(`life_area:${context.lifeArea}`);
    }

    // Add preferred methodology
    if (context.preferredMethodology) {
      enhancedQuery += ` methodology: ${context.preferredMethodology}`;
      addedContext.push(`methodology:${context.preferredMethodology}`);
    }

    return {
      enhancedQuery,
      originalQuery: query,
      addedContext,
      confidence: 0.85,
    };
  }

  override filterResults(results: SearchResult[], context: DomainContext): FilteredResult[] {
    return results
      .map(result => {
        const { boostedScore, boostFactors } = this.applyBoostFactors(result, context);
        const personalizationScore = this.calculatePersonalizationScore(result, context);
        
        return {
          ...result,
          originalScore: result.similarity,
          boostedScore: boostedScore + personalizationScore,
          boostFactors,
          filterReasons: [],
        };
      })
      .filter(result => result.boostedScore >= this.getFilteringRules().minimum_relevance_score)
      .sort((a, b) => b.boostedScore - a.boostedScore);
  }

  detectLifeArea(query: string, context: DomainContext): string | null {
    const lifeAreas = ['career', 'relationships', 'health', 'finances', 'personal_growth'];
    const queryLower = query.toLowerCase();

    for (const area of lifeAreas) {
      if (queryLower.includes(area)) {
        return area;
      }
    }

    return context.lifeArea || null;
  }

  getRecommendedMethodology(query: string, context: DomainContext): string | null {
    const methodologies = this.config.methodologies || [];
    
    if (context.preferredMethodology && methodologies.includes(context.preferredMethodology)) {
      return context.preferredMethodology;
    }

    // Default methodology selection logic
    if (query.toLowerCase().includes('goal')) {
      return 'GROW Model';
    }

    return methodologies.length > 0 ? methodologies[0] : null;
  }
}

/**
 * Career Coaching Domain Adapter  
 */
export class CareerCoachingAdapter extends BaseDomainAdapter {
  constructor() {
    super('career_coaching');
  }

  override enhanceQuery(query: string, context: DomainContext): QueryEnhancementResult {
    const addedContext: string[] = [];
    let enhancedQuery = query;

    // Add career-specific context
    if (context.userProfile?.['career_stage']) {
      enhancedQuery += ` career stage: ${context.userProfile['career_stage']}`;
      addedContext.push(`career_stage:${context.userProfile['career_stage']}`);
    }

    if (context.userProfile?.['industry']) {
      enhancedQuery += ` industry: ${context.userProfile['industry']}`;
      addedContext.push(`industry:${context.userProfile['industry']}`);
    }

    return {
      enhancedQuery,
      originalQuery: query,
      addedContext,
      confidence: 0.9,
      careerSpecific: true,
    } as QueryEnhancementResult & { careerSpecific: boolean };
  }

  override filterResults(results: SearchResult[], context: DomainContext): FilteredResult[] {
    return results
      .map(result => {
        const { boostedScore, boostFactors } = this.applyBoostFactors(result, context);
        
        return {
          ...result,
          originalScore: result.similarity,
          boostedScore,
          boostFactors,
          filterReasons: [],
        };
      })
      .filter(result => result.boostedScore >= 0.6)
      .sort((a, b) => b.boostedScore - a.boostedScore);
  }

  detectLifeArea(): string | null {
    return 'career';
  }

  getRecommendedMethodology(query: string, context: DomainContext): string | null {
    if (query.toLowerCase().includes('skill')) {
      return 'Skills Gap Analysis';
    }
    if (query.toLowerCase().includes('brand')) {
      return 'Personal Branding';
    }
    return 'GROW Model';
  }
}

/**
 * Relationship Coaching Domain Adapter
 */
export class RelationshipCoachingAdapter extends BaseDomainAdapter {
  constructor() {
    super('relationship_coaching');
  }

  override enhanceQuery(query: string, context: DomainContext): QueryEnhancementResult {
    const addedContext: string[] = [];
    let enhancedQuery = query;

    // Add relationship-specific context
    if (context.userProfile?.['relationship_type']) {
      enhancedQuery += ` relationship type: ${context.userProfile['relationship_type']}`;
      addedContext.push(`relationship_type:${context.userProfile['relationship_type']}`);
    }

    return {
      enhancedQuery,
      originalQuery: query,
      addedContext,
      confidence: 0.88,
      relationshipSpecific: true,
    } as QueryEnhancementResult & { relationshipSpecific: boolean };
  }

  override filterResults(results: SearchResult[], context: DomainContext): FilteredResult[] {
    return results
      .map(result => {
        const { boostedScore, boostFactors } = this.applyBoostFactors(result, context);
        
        return {
          ...result,
          originalScore: result.similarity,
          boostedScore,
          boostFactors,
          filterReasons: [],
        };
      })
      .filter(result => result.boostedScore >= 0.65)
      .sort((a, b) => b.boostedScore - a.boostedScore);
  }

  detectLifeArea(): string | null {
    return 'relationships';
  }

  getRecommendedMethodology(): string | null {
    return 'Communication Coaching';
  }
}