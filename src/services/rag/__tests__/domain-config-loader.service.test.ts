import { DomainConfigLoaderService } from '../domain-config-loader.service';
import { DomainConfigError } from '../../../types/database';
import { readFileSync, existsSync, statSync } from 'fs';
import yaml from 'js-yaml';
import { DomainConfig } from '../../../types/database';

// Mock file system operations
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn(),
}));

jest.mock('js-yaml', () => ({
  load: jest.fn(),
}));

describe('DomainConfigLoaderService', () => {
  let service: DomainConfigLoaderService;
  let mockReadFileSync: jest.MockedFunction<typeof readFileSync>;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;
  let mockStatSync: jest.MockedFunction<typeof statSync>;
  let mockYamlLoad: jest.MockedFunction<typeof yaml.load>;

  const mockDomainConfig: DomainConfig = {
    name: 'test_domain',
    display_name: 'Test Domain',
    description: 'A test domain for unit testing',
    knowledge_sources: ['methodologies', 'best_practices', 'resources'],
    methodologies: ['GROW Model', 'Life Wheel Assessment', 'Values Clarification'],
    retrieval_preferences: {
      semantic_similarity: 0.4,
      methodology_match: 0.3,
      life_area_relevance: 0.2,
      evidence_quality: 0.1,
    },
    filtering_rules: {
      minimum_relevance_score: 0.7,
      boost_factors: {
        methodology_match: 1.2,
        life_area_match: 1.1,
        evidence_level: 1.15,
      },
      penalty_factors: {
        complexity_mismatch: 0.9,
        outdated_content: 0.8,
      },
    },
    personalization: {
      methodology_preference_weight: 0.3,
      complexity_preference_weight: 0.2,
      goal_alignment_weight: 0.25,
      historical_preference_weight: 0.15,
      experience_level_weight: 0.1,
      learning_factors: {
        session_rating_influence: 0.3,
        content_engagement_influence: 0.4,
        goal_achievement_influence: 0.3,
      },
    },
    assessment_frameworks: [
      {
        name: 'Life Satisfaction Assessment',
        description: 'Comprehensive life satisfaction evaluation',
        dimensions: ['health', 'relationships', 'career', 'finances', 'personal_growth'],
      },
    ],
    escalation_triggers: ['high_risk', 'crisis_indicator', 'repeated_issues'],
    metadata_schema: {
      life_area: {
        type: 'string',
        values: ['health', 'relationships', 'career', 'finances', 'personal_growth'],
      },
      complexity_level: {
        type: 'string',
        values: ['beginner', 'intermediate', 'advanced'],
      },
    },
    query_enhancement: {
      keywords: {
        stress: ['anxiety', 'overwhelm', 'pressure'],
        relationships: ['communication', 'conflict', 'intimacy'],
      },
      context_mapping: {
        work: 'career',
        family: 'relationships',
        health: 'wellness',
      },
    },
    resource_categories: {
      methodologies: {
        description: 'Evidence-based coaching methodologies',
        examples: ['GROW Model', 'Life Wheel Assessment'],
      },
      best_practices: {
        description: 'Proven strategies and techniques',
        examples: ['Active Listening', 'Goal Setting'],
      },
    },
    integrations: {
      external_apis: ['calendar', 'health_tracker'],
      notification_systems: ['email', 'sms'],
    },
    validation: {
      required_methodologies: 3,
      required_resources: 5,
      content_quality_threshold: 0.8,
      evidence_level_distribution: {
        'research-based': 0.4,
        'expert-validated': 0.4,
        'practical': 0.2,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DomainConfigLoaderService();
    
    mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
    mockStatSync = statSync as jest.MockedFunction<typeof statSync>;
    mockYamlLoad = yaml.load as jest.MockedFunction<typeof yaml.load>;
  });

  describe('Constructor', () => {
    it('should create service with default options', () => {
      const newService = new DomainConfigLoaderService();
      const config = newService.getConfiguration();
      
      expect(config.enableCaching).toBe(true);
      expect(config.enableHotReload).toBe(false);
      expect(config.environmentOverrides).toBe(true);
      expect(config.validateOnLoad).toBe(true);
      expect(config.cacheTimeout).toBe(300000);
    });

    it('should create service with custom options', () => {
      const customOptions = {
        enableCaching: false,
        enableHotReload: true,
        environmentOverrides: false,
        cacheTimeout: 600000,
      };
      
      const newService = new DomainConfigLoaderService(customOptions);
      const config = newService.getConfiguration();
      
      expect(config.enableCaching).toBe(false);
      expect(config.enableHotReload).toBe(true);
      expect(config.environmentOverrides).toBe(false);
      expect(config.cacheTimeout).toBe(600000);
    });
  });

  describe('Domain Configuration Loading', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('yaml content');
      mockYamlLoad.mockReturnValue(mockDomainConfig);
    });

    it('should load domain configuration successfully', async () => {
      const result = await service.loadDomainConfig('test_domain');
      
      expect(result.config).toEqual(mockDomainConfig);
      expect(result.loadTime).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should return cached configuration on second load', async () => {
      // First load
      await service.loadDomainConfig('test_domain');
      
      // Second load (should use cache)
      const result = await service.loadDomainConfig('test_domain');
      
      expect(result.cached).toBe(true);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle file not found error', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await expect(service.loadDomainConfig('nonexistent_domain'))
        .rejects.toThrow(DomainConfigError);
    });

    it('should handle YAML parsing error', async () => {
      mockYamlLoad.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });
      
      await expect(service.loadDomainConfig('test_domain'))
        .rejects.toThrow(DomainConfigError);
    });

    it('should handle empty configuration', async () => {
      mockYamlLoad.mockReturnValue(null);
      
      await expect(service.loadDomainConfig('test_domain'))
        .rejects.toThrow(DomainConfigError);
    });

    it('should apply environment overrides when enabled', async () => {
      const baseConfig = { ...mockDomainConfig };
      const overrideConfig = {
        filtering_rules: {
          minimum_relevance_score: 0.8,
        },
      };
      
      mockYamlLoad
        .mockReturnValueOnce(baseConfig)
        .mockReturnValueOnce(overrideConfig);
      
      // Mock environment override file exists
      mockExistsSync
        .mockReturnValueOnce(true) // base config exists
        .mockReturnValueOnce(true); // override config exists
      
      const result = await service.loadDomainConfig('test_domain');
      
      expect(result.config.filtering_rules.minimum_relevance_score).toBe(0.8);
    });

    it('should skip environment overrides when disabled', async () => {
      const serviceWithoutOverrides = new DomainConfigLoaderService({
        environmentOverrides: false,
      });
      
      const result = await serviceWithoutOverrides.loadDomainConfig('test_domain');
      
      expect(result.config).toEqual(mockDomainConfig);
      expect(mockExistsSync).toHaveBeenCalledTimes(1); // Only base config checked
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration successfully', () => {
      const validationResult = service.validateDomainConfig(mockDomainConfig);
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toEqual([]);
      expect(validationResult.completeness).toBeGreaterThan(0.5);
    });

    it('should detect missing required fields', () => {
      const invalidConfig = {
        name: 'test_domain',
        // Missing required fields
      };
      
      const validationResult = service.validateDomainConfig(invalidConfig as any);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors[0]).toContain('Missing required field');
    });

    it('should validate knowledge sources array', () => {
      const configWithInvalidSources = {
        ...mockDomainConfig,
        knowledge_sources: 'invalid', // Should be array
      };
      
      const validationResult = service.validateDomainConfig(configWithInvalidSources as any);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('knowledge_sources'))).toBe(true);
    });

    it('should validate methodologies array', () => {
      const configWithInvalidMethodologies = {
        ...mockDomainConfig,
        methodologies: 'invalid', // Should be array
      };
      
      const validationResult = service.validateDomainConfig(configWithInvalidMethodologies as any);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('methodologies'))).toBe(true);
    });

    it('should validate retrieval preferences weights', () => {
      const configWithInvalidWeights = {
        ...mockDomainConfig,
        retrieval_preferences: {
          semantic_similarity: 0.5,
          methodology_match: 0.7, // Total > 1.0
        },
      };
      
      const validationResult = service.validateDomainConfig(configWithInvalidWeights);
      
      expect(validationResult.warnings.some(warning => warning.includes('weights'))).toBe(true);
    });

    it('should validate filtering rules', () => {
      const configWithInvalidFiltering = {
        ...mockDomainConfig,
        filtering_rules: {
          minimum_relevance_score: 1.5, // Should be 0-1
          boost_factors: { methodology_match: 1.2 },
        },
      };
      
      const validationResult = service.validateDomainConfig(configWithInvalidFiltering);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('minimum_relevance_score'))).toBe(true);
    });

    it('should validate personalization weights', () => {
      const configWithInvalidPersonalization = {
        ...mockDomainConfig,
        personalization: {
          methodology_preference_weight: 1.5, // Should be 0-1
          complexity_preference_weight: 0.2,
          goal_alignment_weight: 0.25,
          historical_preference_weight: 0.15,
          experience_level_weight: 0.1,
          learning_factors: {
            session_rating_influence: 0.3,
            content_engagement_influence: 0.4,
            goal_achievement_influence: 0.3,
          },
        },
      };
      
      const validationResult = service.validateDomainConfig(configWithInvalidPersonalization);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('methodology_preference_weight'))).toBe(true);
    });

    it('should calculate completeness score', () => {
      const partialConfig: Partial<DomainConfig> = {
        name: 'test_domain',
        display_name: 'Test Domain',
        description: 'Test description',
        knowledge_sources: ['source1'],
        // Missing some optional fields
      };
      
      const validationResult = service.validateDomainConfig(partialConfig as DomainConfig);
      
      expect(validationResult.completeness).toBeGreaterThan(0);
      expect(validationResult.completeness).toBeLessThan(1);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('yaml content');
      mockYamlLoad.mockReturnValue(mockDomainConfig);
    });

    it('should cache configurations when enabled', async () => {
      const serviceWithCache = new DomainConfigLoaderService({
        enableCaching: true,
      });
      
      // First load
      await serviceWithCache.loadDomainConfig('test_domain');
      
      // Second load should use cache
      const result = await serviceWithCache.loadDomainConfig('test_domain');
      
      expect(result.cached).toBe(true);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const serviceWithoutCache = new DomainConfigLoaderService({
        enableCaching: false,
      });
      
      // First load
      await serviceWithoutCache.loadDomainConfig('test_domain');
      
      // Second load should not use cache
      const result = await serviceWithoutCache.loadDomainConfig('test_domain');
      
      expect(result.cached).toBe(false);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after timeout', async () => {
      const serviceWithShortTimeout = new DomainConfigLoaderService({
        enableCaching: true,
        cacheTimeout: 100, // 100ms
      });
      
      // First load
      await serviceWithShortTimeout.loadDomainConfig('test_domain');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second load should not use cache
      const result = await serviceWithShortTimeout.loadDomainConfig('test_domain');
      
      expect(result.cached).toBe(false);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should clear cache manually', async () => {
      // Load and cache configuration
      await service.loadDomainConfig('test_domain');
      
      // Clear cache
      service.clearCache();
      
      // Next load should not use cache
      const result = await service.loadDomainConfig('test_domain');
      
      expect(result.cached).toBe(false);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', async () => {
      await service.loadDomainConfig('test_domain');
      
      const stats = service.getCacheStats();
      
      expect(stats.cachedDomains).toBe(1);
      expect(stats.totalCacheSize).toBeGreaterThan(0);
    });
  });

  describe('Available Domains', () => {
    it('should return available domains', () => {
      const { readdirSync } = require('fs');
      
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      readdirSync.mockReturnValue(['domain1', 'domain2', 'domain3']);
      
      const domains = service.getAvailableDomains();
      
      expect(domains).toEqual(['domain1', 'domain2', 'domain3']);
    });

    it('should handle non-existent base path', () => {
      mockExistsSync.mockReturnValue(false);
      
      const domains = service.getAvailableDomains();
      
      expect(domains).toEqual([]);
    });

    it('should filter out non-directory entries', () => {
      const { readdirSync } = require('fs');
      
      mockExistsSync.mockReturnValue(true);
      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true } as any)
        .mockReturnValueOnce({ isDirectory: () => false } as any)
        .mockReturnValueOnce({ isDirectory: () => true } as any);
      
      readdirSync.mockReturnValue(['domain1', 'file.txt', 'domain2']);
      
      const domains = service.getAvailableDomains();
      
      expect(domains).toEqual(['domain1', 'domain2']);
    });
  });

  describe('Load All Domains', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('yaml content');
      mockYamlLoad.mockReturnValue(mockDomainConfig);
    });

    it('should load all available domains', async () => {
      const { readdirSync } = require('fs');
      
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      readdirSync.mockReturnValue(['domain1', 'domain2']);
      
      const results = await service.loadAllDomainConfigs();
      
      expect(Object.keys(results)).toEqual(['domain1', 'domain2']);
      expect(results.domain1.config.name).toBe('test_domain');
      expect(results.domain2.config.name).toBe('test_domain');
    });

    it('should handle individual domain loading failures', async () => {
      const { readdirSync } = require('fs');
      
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      readdirSync.mockReturnValue(['domain1', 'domain2']);
      
      // Make domain2 fail to load
      mockExistsSync
        .mockReturnValueOnce(true)  // domain1 exists
        .mockReturnValueOnce(false); // domain2 doesn't exist
      
      const results = await service.loadAllDomainConfigs();
      
      expect(Object.keys(results)).toEqual(['domain1']);
      expect(results.domain1.config.name).toBe('test_domain');
    });
  });

  describe('Configuration Reloading', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('yaml content');
      mockYamlLoad.mockReturnValue(mockDomainConfig);
    });

    it('should reload configuration bypassing cache', async () => {
      // First load and cache
      await service.loadDomainConfig('test_domain');
      
      // Reload should bypass cache
      const result = await service.reloadDomainConfig('test_domain');
      
      expect(result.cached).toBe(false);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should clear cache and watchers on reload', async () => {
      // Load with hot reload enabled
      const serviceWithHotReload = new DomainConfigLoaderService({
        enableHotReload: true,
      });
      
      await serviceWithHotReload.loadDomainConfig('test_domain');
      
      const statsBefore = serviceWithHotReload.getCacheStats();
      expect(statsBefore.cachedDomains).toBe(1);
      
      await serviceWithHotReload.reloadDomainConfig('test_domain');
      
      // Cache should be cleared and rebuilt
      const statsAfter = serviceWithHotReload.getCacheStats();
      expect(statsAfter.cachedDomains).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      await expect(service.loadDomainConfig('test_domain'))
        .rejects.toThrow(DomainConfigError);
    });

    it('should handle YAML parsing errors with context', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid yaml content');
      mockYamlLoad.mockImplementation(() => {
        throw new Error('YAML parsing failed');
      });
      
      try {
        await service.loadDomainConfig('test_domain');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainConfigError);
        expect(error instanceof Error ? error.message : String(error)).toContain('test_domain');
      }
    });

    it('should provide helpful error messages', async () => {
      mockExistsSync.mockReturnValue(false);
      
      try {
        await service.loadDomainConfig('nonexistent_domain');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainConfigError);
        expect(error instanceof Error ? error.message : String(error)).toContain('Configuration file not found');
        expect(error instanceof Error ? error.message : String(error)).toContain('nonexistent_domain');
      }
    });
  });

  describe('Deep Merge Functionality', () => {
    it('should merge nested objects correctly', async () => {
      const baseConfig = {
        name: 'test_domain',
        display_name: 'Test Domain',
        description: 'Test description',
        knowledge_sources: ['source1'],
        filtering_rules: {
          minimum_relevance_score: 0.6,
          boost_factors: {
            methodology_match: 1.2,
            life_area_match: 1.15,
          },
        },
      };
      
      const overrideConfig = {
        filtering_rules: {
          minimum_relevance_score: 0.8,
          boost_factors: {
            methodology_match: 1.3,
            // life_area_match should remain 1.15
          },
          penalty_factors: {
            complexity_mismatch: 0.9,
          },
        },
      };
      
      mockYamlLoad
        .mockReturnValueOnce(baseConfig)
        .mockReturnValueOnce(overrideConfig);
      
      mockExistsSync
        .mockReturnValueOnce(true) // base config exists
        .mockReturnValueOnce(true); // override config exists
      
      const result = await service.loadDomainConfig('test_domain');
      
      expect(result.config.filtering_rules.minimum_relevance_score).toBe(0.8);
      expect(result.config.filtering_rules.boost_factors['methodology_match']).toBe(1.3);
      expect(result.config.filtering_rules.boost_factors['life_area_match']).toBe(1.15);
      expect(result.config.filtering_rules.penalty_factors?.['complexity_mismatch']).toBe(0.9);
    });
  });

  describe('Configuration Options', () => {
    it('should return current configuration', () => {
      const config = service.getConfiguration();
      
      expect(config.baseConfigPath).toBeDefined();
      expect(config.enableCaching).toBe(true);
      expect(config.enableHotReload).toBe(false);
      expect(config.environmentOverrides).toBe(true);
      expect(config.validateOnLoad).toBe(true);
      expect(config.cacheTimeout).toBe(300000);
    });
  });
});