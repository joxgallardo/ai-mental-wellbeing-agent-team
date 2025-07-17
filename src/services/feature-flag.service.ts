import { createLogger } from '../utils/logger';
import { ragConfig } from '../config/index';

/**
 * Feature Flag Service - Manage feature toggles for gradual rollout
 * 
 * Features:
 * - Environment-based feature flags
 * - Runtime feature toggling
 * - Domain-specific feature control
 * - Rollback capabilities
 * - Performance monitoring
 */

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  category: 'core' | 'experimental' | 'deprecated';
  rolloutPercentage?: number;
  requiredVersion?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface FeatureFlagContext {
  domainId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  version?: string;
  environment?: string;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private logger = createLogger('FeatureFlags');
  private rolloutCache: Map<string, boolean> = new Map();

  constructor() {
    this.initializeFlags();
  }

  /**
   * Initialize feature flags from configuration
   */
  private initializeFlags(): void {
    // Core RAG features
    this.setFlag({
      name: 'rag_enhancement',
      enabled: ragConfig.enabled,
      description: 'Enable RAG-enhanced responses from knowledge base',
      category: 'core',
      rolloutPercentage: ragConfig.enabled ? 100 : 0,
      dependencies: ['supabase_connection'],
    });

    this.setFlag({
      name: 'hybrid_search',
      enabled: ragConfig.hybridSearchEnabled,
      description: 'Enable hybrid search (semantic + full-text)',
      category: 'core',
      rolloutPercentage: ragConfig.hybridSearchEnabled ? 100 : 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'advanced_personalization',
      enabled: false,
      description: 'Enable advanced user personalization features',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'content_caching',
      enabled: true,
      description: 'Enable embedding and search result caching',
      category: 'core',
      rolloutPercentage: 100,
    });

    this.setFlag({
      name: 'performance_monitoring',
      enabled: true,
      description: 'Enable detailed performance monitoring and metrics',
      category: 'core',
      rolloutPercentage: 100,
    });

    this.setFlag({
      name: 'auto_knowledge_update',
      enabled: false,
      description: 'Automatically update knowledge base from approved sources',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'multi_language_support',
      enabled: false,
      description: 'Enable multi-language content and responses',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'crisis_detection_enhanced',
      enabled: false,
      description: 'Enhanced crisis detection using RAG context',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'conversation_memory',
      enabled: false,
      description: 'Enable conversation memory and context persistence',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.setFlag({
      name: 'content_quality_scoring',
      enabled: false,
      description: 'Enable automated content quality scoring and filtering',
      category: 'experimental',
      rolloutPercentage: 0,
      dependencies: ['rag_enhancement'],
    });

    this.logger.info('Feature flags initialized', {
      totalFlags: this.flags.size,
      enabledFlags: Array.from(this.flags.values()).filter(f => f.enabled).length,
      experimentalFlags: Array.from(this.flags.values()).filter(f => f.category === 'experimental').length,
    });
  }

  /**
   * Check if a feature is enabled
   */
  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      this.logger.warn('Unknown feature flag requested', { flagName });
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check dependencies
    if (flag.dependencies && flag.dependencies.length > 0) {
      for (const dependency of flag.dependencies) {
        const dependencyEnabled = await this.isEnabled(dependency, context);
        if (!dependencyEnabled) {
          this.logger.debug('Feature flag disabled due to dependency', {
            flagName,
            dependency,
          });
          return false;
        }
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const rolloutEnabled = this.checkRollout(flagName, context);
      if (!rolloutEnabled) {
        return false;
      }
    }

    return true;
  }

  /**
   * Enable a feature flag
   */
  async enableFeature(flagName: string, rolloutPercentage: number = 100): Promise<void> {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }

    flag.enabled = true;
    flag.rolloutPercentage = rolloutPercentage;
    
    this.logger.info('Feature flag enabled', {
      flagName,
      rolloutPercentage,
      category: flag.category,
    });

    // Clear rollout cache for this flag
    this.clearRolloutCache(flagName);
  }

  /**
   * Disable a feature flag
   */
  async disableFeature(flagName: string): Promise<void> {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }

    flag.enabled = false;
    flag.rolloutPercentage = 0;
    
    this.logger.info('Feature flag disabled', {
      flagName,
      category: flag.category,
    });

    // Clear rollout cache for this flag
    this.clearRolloutCache(flagName);
  }

  /**
   * Set rollout percentage for gradual feature deployment
   */
  async setRolloutPercentage(flagName: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    const flag = this.flags.get(flagName);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${flagName}`);
    }

    flag.rolloutPercentage = percentage;
    
    this.logger.info('Feature flag rollout percentage updated', {
      flagName,
      percentage,
      category: flag.category,
    });

    // Clear rollout cache for this flag
    this.clearRolloutCache(flagName);
  }

  /**
   * Set percentage for a feature flag (alias for setRolloutPercentage)
   */
  async setPercentage(flagName: string, percentage: number): Promise<void> {
    return this.setRolloutPercentage(flagName, percentage);
  }

  /**
   * Get all feature flags
   */
  getFlags(): Record<string, FeatureFlag> {
    return Object.fromEntries(this.flags);
  }

  /**
   * Get feature flag by name
   */
  getFlag(flagName: string): FeatureFlag | null {
    return this.flags.get(flagName) || null;
  }

  /**
   * Set a feature flag
   */
  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  /**
   * Remove a feature flag
   */
  removeFlag(flagName: string): boolean {
    this.clearRolloutCache(flagName);
    return this.flags.delete(flagName);
  }

  /**
   * Get enabled flags by category
   */
  async getEnabledFlagsByCategory(category: string, context?: FeatureFlagContext): Promise<string[]> {
    const enabledFlags: string[] = [];
    
    for (const [flagName, flag] of this.flags.entries()) {
      if (flag.category === category && await this.isEnabled(flagName, context)) {
        enabledFlags.push(flagName);
      }
    }
    
    return enabledFlags;
  }

  /**
   * Get feature flag statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    experimental: number;
    core: number;
    deprecated: number;
  } {
    const flags = Array.from(this.flags.values());
    
    return {
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      disabled: flags.filter(f => !f.enabled).length,
      experimental: flags.filter(f => f.category === 'experimental').length,
      core: flags.filter(f => f.category === 'core').length,
      deprecated: flags.filter(f => f.category === 'deprecated').length,
    };
  }

  /**
   * Check if user/session should be included in rollout
   */
  private checkRollout(flagName: string, context?: FeatureFlagContext): boolean {
    const flag = this.flags.get(flagName);
    
    if (!flag || !flag.rolloutPercentage) {
      return false;
    }

    // Use deterministic rollout based on stable identifier
    const identifier = this.getRolloutIdentifier(context);
    const cacheKey = `${flagName}:${identifier}`;
    
    // Check cache first
    if (this.rolloutCache.has(cacheKey)) {
      return this.rolloutCache.get(cacheKey)!;
    }

    // Calculate rollout inclusion
    const hash = this.simpleHash(identifier + flagName);
    const rolloutValue = (hash % 100) + 1;
    const included = rolloutValue <= flag.rolloutPercentage;
    
    // Cache result
    this.rolloutCache.set(cacheKey, included);
    
    return included;
  }

  /**
   * Get stable identifier for rollout determination
   */
  private getRolloutIdentifier(context?: FeatureFlagContext): string {
    if (context?.userId) {
      return `user:${context.userId}`;
    }
    
    if (context?.sessionId) {
      return `session:${context.sessionId}`;
    }
    
    if (context?.domainId) {
      return `domain:${context.domainId}`;
    }
    
    return 'anonymous';
  }

  /**
   * Simple hash function for rollout determination
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear rollout cache for a specific flag
   */
  private clearRolloutCache(flagName: string): void {
    for (const key of this.rolloutCache.keys()) {
      if (key.startsWith(`${flagName}:`)) {
        this.rolloutCache.delete(key);
      }
    }
  }

  /**
   * Clear all rollout cache
   */
  clearCache(): void {
    this.rolloutCache.clear();
    this.logger.debug('Feature flag rollout cache cleared');
  }

  /**
   * Evaluate multiple feature flags at once
   */
  async evaluateFlags(
    flagNames: string[],
    context?: FeatureFlagContext
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      flagNames.map(async (flagName) => {
        results[flagName] = await this.isEnabled(flagName, context);
      })
    );
    
    return results;
  }

  /**
   * Get feature flag evaluation context for debugging
   */
  async getEvaluationContext(
    flagName: string,
    context?: FeatureFlagContext
  ): Promise<{
    flagExists: boolean;
    globallyEnabled: boolean;
    dependenciesMet: boolean;
    rolloutIncluded: boolean;
    finalResult: boolean;
    flag?: FeatureFlag;
  }> {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      return {
        flagExists: false,
        globallyEnabled: false,
        dependenciesMet: false,
        rolloutIncluded: false,
        finalResult: false,
      };
    }

    const globallyEnabled = flag.enabled;
    
    let dependenciesMet = true;
    if (flag.dependencies && flag.dependencies.length > 0) {
      for (const dependency of flag.dependencies) {
        const dependencyEnabled = await this.isEnabled(dependency, context);
        if (!dependencyEnabled) {
          dependenciesMet = false;
          break;
        }
      }
    }

    const rolloutIncluded = flag.rolloutPercentage === undefined || 
                           flag.rolloutPercentage >= 100 || 
                           this.checkRollout(flagName, context);

    const finalResult = globallyEnabled && dependenciesMet && rolloutIncluded;

    return {
      flagExists: true,
      globallyEnabled,
      dependenciesMet,
      rolloutIncluded,
      finalResult,
      flag,
    };
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();