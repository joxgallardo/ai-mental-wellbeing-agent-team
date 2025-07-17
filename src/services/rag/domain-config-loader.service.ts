import yaml from 'js-yaml';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createLogger } from '../../utils/logger';
import { DomainConfig, DomainConfigError } from '../../types/database';

/**
 * Domain Configuration Loader Service - YAML-driven domain configuration
 * 
 * Features:
 * - YAML configuration loading with validation
 * - Hot reloading and file watching
 * - Configuration inheritance and merging
 * - Environment-specific overrides
 * - Caching with invalidation
 * - Error handling and fallbacks
 */

export interface DomainConfigLoaderOptions {
  baseConfigPath: string;
  enableCaching: boolean;
  enableHotReload: boolean;
  environmentOverrides: boolean;
  validateOnLoad: boolean;
  cacheTimeout: number;
}

export interface ConfigLoadResult {
  config: DomainConfig;
  loadTime: number;
  source: string;
  cached: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
}

/**
 * Domain Configuration Loader Service
 */
export class DomainConfigLoaderService {
  private logger = createLogger('DomainConfigLoader');
  private configCache = new Map<string, { config: DomainConfig; timestamp: number; source: string }>();
  private fileWatchers = new Map<string, NodeJS.Timeout>();
  private defaultOptions: DomainConfigLoaderOptions = {
    baseConfigPath: join(process.cwd(), 'config', 'domains'),
    enableCaching: true,
    enableHotReload: false,
    environmentOverrides: true,
    validateOnLoad: true,
    cacheTimeout: 300000, // 5 minutes
  };

  private options: DomainConfigLoaderOptions;

  constructor(options: Partial<DomainConfigLoaderOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
    
    this.logger.info('Domain Config Loader initialized', {
      baseConfigPath: this.options.baseConfigPath,
      enableCaching: this.options.enableCaching,
      enableHotReload: this.options.enableHotReload,
      environmentOverrides: this.options.environmentOverrides,
    });
  }

  /**
   * Load domain configuration by name
   */
  async loadDomainConfig(domainName: string): Promise<ConfigLoadResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Loading domain configuration', { domainName });

      // Check cache first
      if (this.options.enableCaching) {
        const cachedConfig = this.getCachedConfig(domainName);
        if (cachedConfig) {
          this.logger.debug('Configuration loaded from cache', { domainName });
          return {
            config: cachedConfig.config,
            loadTime: Date.now() - startTime,
            source: cachedConfig.source,
            cached: true,
            errors: [],
            warnings: [],
          };
        }
      }

      // Load configuration from file system
      const configResult = await this.loadConfigFromFiles(domainName);
      
      // Validate configuration
      const validationResult = this.options.validateOnLoad
        ? this.validateDomainConfig(configResult.config)
        : { valid: true, errors: [], warnings: [], completeness: 1.0 };

      // Cache the configuration
      if (this.options.enableCaching) {
        this.cacheConfig(domainName, configResult.config, configResult.source);
      }

      // Set up hot reload if enabled
      if (this.options.enableHotReload) {
        this.setupHotReload(domainName, configResult.source);
      }

      const loadTime = Date.now() - startTime;
      this.logger.info('Domain configuration loaded successfully', {
        domainName,
        loadTime,
        source: configResult.source,
        cached: false,
        valid: validationResult.valid,
        completeness: validationResult.completeness,
        errorsCount: validationResult.errors.length,
        warningsCount: validationResult.warnings.length,
      });

      return {
        config: configResult.config,
        loadTime,
        source: configResult.source,
        cached: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      };
    } catch (error) {
      const loadTime = Date.now() - startTime;
      this.logger.error('Failed to load domain configuration', {
        domainName,
        loadTime,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      });

      throw new DomainConfigError(
        `Failed to load domain configuration for ${domainName}: ${error}`,
        { domainName, loadTime, originalError: error }
      );
    }
  }

  /**
   * Load all available domain configurations
   */
  async loadAllDomainConfigs(): Promise<Record<string, ConfigLoadResult>> {
    const results: Record<string, ConfigLoadResult> = {};
    
    try {
      const availableDomains = this.getAvailableDomains();
      
      this.logger.info('Loading all domain configurations', {
        domainsCount: availableDomains.length,
        domains: availableDomains,
      });

      for (const domainName of availableDomains) {
        try {
          results[domainName] = await this.loadDomainConfig(domainName);
        } catch (error) {
          this.logger.error('Failed to load domain configuration', {
            domainName,
            error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to load all domain configurations', {
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reload domain configuration (bypass cache)
   */
  async reloadDomainConfig(domainName: string): Promise<ConfigLoadResult> {
    this.logger.info('Reloading domain configuration', { domainName });
    
    // Clear cache
    this.configCache.delete(domainName);
    
    // Clear file watcher
    if (this.fileWatchers.has(domainName)) {
      clearTimeout(this.fileWatchers.get(domainName)!);
      this.fileWatchers.delete(domainName);
    }
    
    // Load fresh configuration
    return this.loadDomainConfig(domainName);
  }

  /**
   * Get available domains from file system
   */
  getAvailableDomains(): string[] {
    try {
      const { readdirSync } = require('fs');
      const domains: string[] = [];
      
      if (!existsSync(this.options.baseConfigPath)) {
        this.logger.warn('Base configuration path does not exist', {
          baseConfigPath: this.options.baseConfigPath,
        });
        return domains;
      }

      const entries = readdirSync(this.options.baseConfigPath);
      
      for (const entry of entries) {
        const entryPath = join(this.options.baseConfigPath, entry);
        const stat = statSync(entryPath);
        
        if (stat.isDirectory()) {
          const configPath = join(entryPath, 'domain_config.yml');
          if (existsSync(configPath)) {
            domains.push(entry);
          }
        }
      }

      return domains;
    } catch (error) {
      this.logger.error('Failed to get available domains', {
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Validate domain configuration
   */
  validateDomainConfig(config: DomainConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    const requiredFields = ['name', 'display_name', 'description', 'knowledge_sources'];
    for (const field of requiredFields) {
      if (!config[field as keyof DomainConfig]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Knowledge sources validation
    if (config.knowledge_sources) {
      if (!Array.isArray(config.knowledge_sources)) {
        errors.push('knowledge_sources must be an array');
      } else if (config.knowledge_sources.length === 0) {
        warnings.push('knowledge_sources array is empty');
      }
    }

    // Methodologies validation
    if (config.methodologies) {
      if (!Array.isArray(config.methodologies)) {
        errors.push('methodologies must be an array');
      } else if (config.methodologies.length === 0) {
        warnings.push('methodologies array is empty');
      }
    }

    // Retrieval preferences validation
    if (config.retrieval_preferences) {
      const weights = Object.values(config.retrieval_preferences);
      const sum = weights.reduce((a, b) => a + b, 0);
      
      if (Math.abs(sum - 1.0) > 0.01) {
        warnings.push(`Retrieval preference weights sum to ${sum.toFixed(2)}, should be 1.0`);
      }
    }

    // Filtering rules validation
    if (config.filtering_rules) {
      if (config.filtering_rules.minimum_relevance_score !== undefined) {
        const score = config.filtering_rules.minimum_relevance_score;
        if (score < 0 || score > 1) {
          errors.push('minimum_relevance_score must be between 0 and 1');
        }
      }
    }

    // Personalization settings validation
    if (config.personalization) {
      const personalizedWeights = [
        'methodology_preference_weight',
        'complexity_preference_weight',
        'goal_alignment_weight',
      ];
      
      for (const weight of personalizedWeights) {
        const value = config.personalization[weight as keyof typeof config.personalization];
        if (typeof value === 'number' && (value < 0 || value > 1)) {
          errors.push(`${weight} must be between 0 and 1`);
        }
      }
    }

    // Calculate completeness
    const totalFields = 10; // Total expected fields
    const presentFields = [
      config.name,
      config.display_name,
      config.description,
      config.knowledge_sources,
      config.methodologies,
      config.retrieval_preferences,
      config.filtering_rules,
      config.personalization,
      config.assessment_frameworks,
      config.escalation_triggers,
    ].filter(field => field !== undefined && field !== null).length;

    const completeness = presentFields / totalFields;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      completeness,
    };
  }

  /**
   * Load configuration from files
   */
  private async loadConfigFromFiles(domainName: string): Promise<{
    config: DomainConfig;
    source: string;
  }> {
    const configPath = join(this.options.baseConfigPath, domainName, 'domain_config.yml');
    
    if (!existsSync(configPath)) {
      throw new DomainConfigError(
        `Configuration file not found: ${configPath}`,
        { domainName, configPath }
      );
    }

    try {
      // Load base configuration
      const baseConfig = this.loadYAMLFile(configPath);
      
      // Apply environment-specific overrides
      const finalConfig = this.options.environmentOverrides
        ? this.applyEnvironmentOverrides(baseConfig, domainName)
        : baseConfig;

      // Validate basic structure
      if (!finalConfig || typeof finalConfig !== 'object') {
        throw new DomainConfigError(
          'Invalid configuration structure',
          { domainName, configPath }
        );
      }

      return {
        config: finalConfig as DomainConfig,
        source: configPath,
      };
    } catch (error) {
      throw new DomainConfigError(
        `Failed to load configuration file: ${error}`,
        { domainName, configPath, originalError: error }
      );
    }
  }

  /**
   * Load YAML file
   */
  private loadYAMLFile(filePath: string): any {
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      return yaml.load(fileContent);
    } catch (error) {
      throw new DomainConfigError(
        `Failed to parse YAML file: ${error}`,
        { filePath, originalError: error }
      );
    }
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironmentOverrides(baseConfig: any, domainName: string): any {
    const environment = process.env.NODE_ENV || 'development';
    const overridePath = join(
      this.options.baseConfigPath,
      domainName,
      `domain_config.${environment}.yml`
    );

    if (!existsSync(overridePath)) {
      return baseConfig;
    }

    try {
      const overrideConfig = this.loadYAMLFile(overridePath);
      
      this.logger.debug('Applying environment overrides', {
        domainName,
        environment,
        overridePath,
      });

      // Deep merge configurations
      return this.deepMerge(baseConfig, overrideConfig);
    } catch (error) {
      this.logger.warn('Failed to apply environment overrides', {
        domainName,
        environment,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      });
      return baseConfig;
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Get cached configuration
   */
  private getCachedConfig(domainName: string): { config: DomainConfig; source: string } | null {
    const cached = this.configCache.get(domainName);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - cached.timestamp > this.options.cacheTimeout;
    
    if (isExpired) {
      this.configCache.delete(domainName);
      return null;
    }

    return {
      config: cached.config,
      source: cached.source,
    };
  }

  /**
   * Cache configuration
   */
  private cacheConfig(domainName: string, config: DomainConfig, source: string): void {
    this.configCache.set(domainName, {
      config,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Setup hot reload for configuration file
   */
  private setupHotReload(domainName: string, configPath: string): void {
    if (this.fileWatchers.has(domainName)) {
      clearTimeout(this.fileWatchers.get(domainName)!);
    }

    // Note: In a real implementation, you would use fs.watchFile or chokidar
    // For now, we'll implement a simple polling mechanism
    const watcherId = setInterval(async () => {
      try {
        const stats = statSync(configPath);
        const cached = this.configCache.get(domainName);
        
        if (cached && stats.mtime.getTime() > cached.timestamp) {
          this.logger.info('Configuration file changed, reloading', {
            domainName,
            configPath,
          });
          
          await this.reloadDomainConfig(domainName);
        }
      } catch (error) {
        this.logger.error('Error checking configuration file', {
          domainName,
          configPath,
          error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
        });
      }
    }, 5000); // Check every 5 seconds

    this.fileWatchers.set(domainName, watcherId);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.configCache.clear();
    
    // Clear file watchers
    for (const [domainName, watcherId] of this.fileWatchers) {
      clearTimeout(watcherId);
    }
    this.fileWatchers.clear();
    
    this.logger.info('All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedDomains: number;
    activeWatchers: number;
    totalCacheSize: number;
  } {
    return {
      cachedDomains: this.configCache.size,
      activeWatchers: this.fileWatchers.size,
      totalCacheSize: Array.from(this.configCache.values()).reduce(
        (size, cached) => size + JSON.stringify(cached.config).length,
        0
      ),
    };
  }

  /**
   * Get configuration
   */
  getConfiguration(): DomainConfigLoaderOptions {
    return { ...this.options };
  }
}

// Export singleton instance
export const domainConfigLoaderService = new DomainConfigLoaderService();