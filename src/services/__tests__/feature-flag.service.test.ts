import { FeatureFlagService } from '../feature-flag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    service = new FeatureFlagService();
  });

  describe('Initialization', () => {
    it('should initialize with default flags', () => {
      const flags = service.getFlags();
      
      expect(flags).toHaveProperty('rag_enhancement');
      expect(flags).toHaveProperty('hybrid_search');
      expect(flags).toHaveProperty('advanced_personalization');
      expect(flags).toHaveProperty('content_caching');
      expect(flags).toHaveProperty('performance_monitoring');
    });

    it('should set correct flag categories', () => {
      const ragFlag = service.getFlag('rag_enhancement');
      const experimentalFlag = service.getFlag('advanced_personalization');
      const coreFlag = service.getFlag('content_caching');
      
      expect(ragFlag?.category).toBe('core');
      expect(experimentalFlag?.category).toBe('experimental');
      expect(coreFlag?.category).toBe('core');
    });

    it('should set correct dependencies', () => {
      const hybridFlag = service.getFlag('hybrid_search');
      const personalizationFlag = service.getFlag('advanced_personalization');
      
      expect(hybridFlag?.dependencies).toContain('rag_enhancement');
      expect(personalizationFlag?.dependencies).toContain('rag_enhancement');
    });
  });

  describe('Feature Flag Evaluation', () => {
    it('should return true for enabled flag', async () => {
      const enabled = await service.isEnabled('content_caching');
      expect(enabled).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      const enabled = await service.isEnabled('advanced_personalization');
      expect(enabled).toBe(false);
    });

    it('should return false for non-existent flag', async () => {
      const enabled = await service.isEnabled('non_existent_flag');
      expect(enabled).toBe(false);
    });

    it('should handle dependency checks', async () => {
      // Enable parent dependency
      await service.enableFeature('rag_enhancement');
      
      // Enable dependent feature
      await service.enableFeature('hybrid_search');
      
      const enabled = await service.isEnabled('hybrid_search');
      expect(enabled).toBe(true);
    });

    it('should disable feature when dependency is disabled', async () => {
      // Enable both features
      await service.enableFeature('rag_enhancement');
      await service.enableFeature('hybrid_search');
      
      // Disable parent dependency
      await service.disableFeature('rag_enhancement');
      
      const enabled = await service.isEnabled('hybrid_search');
      expect(enabled).toBe(false);
    });
  });

  describe('Feature Flag Management', () => {
    it('should enable feature flag', async () => {
      await service.enableFeature('advanced_personalization');
      
      const flag = service.getFlag('advanced_personalization');
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(100);
    });

    it('should disable feature flag', async () => {
      await service.disableFeature('content_caching');
      
      const flag = service.getFlag('content_caching');
      expect(flag?.enabled).toBe(false);
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should set rollout percentage', async () => {
      await service.setRolloutPercentage('advanced_personalization', 50);
      
      const flag = service.getFlag('advanced_personalization');
      expect(flag?.rolloutPercentage).toBe(50);
    });

    it('should throw error for invalid rollout percentage', async () => {
      await expect(service.setRolloutPercentage('content_caching', 150)).rejects.toThrow();
      await expect(service.setRolloutPercentage('content_caching', -10)).rejects.toThrow();
    });

    it('should throw error for non-existent flag', async () => {
      await expect(service.enableFeature('non_existent')).rejects.toThrow();
      await expect(service.disableFeature('non_existent')).rejects.toThrow();
      await expect(service.setRolloutPercentage('non_existent', 50)).rejects.toThrow();
    });
  });

  describe('Rollout Logic', () => {
    it('should respect rollout percentage', async () => {
      await service.enableFeature('advanced_personalization');
      await service.setRolloutPercentage('advanced_personalization', 50);
      
      const results: boolean[] = [];
      
      // Test with different contexts to check rollout distribution
      for (let i = 0; i < 10; i++) {
        const enabled = await service.isEnabled('advanced_personalization', {
          userId: `user-${i}`,
        });
        results.push(enabled);
      }
      
      // Should have some enabled and some disabled (not exact 50% due to small sample)
      const enabledCount = results.filter(r => r).length;
      expect(enabledCount).toBeGreaterThan(0);
      expect(enabledCount).toBeLessThan(10);
    });

    it('should be consistent for same user', async () => {
      await service.enableFeature('advanced_personalization');
      await service.setRolloutPercentage('advanced_personalization', 50);
      
      const context = { userId: 'consistent-user' };
      
      const result1 = await service.isEnabled('advanced_personalization', context);
      const result2 = await service.isEnabled('advanced_personalization', context);
      const result3 = await service.isEnabled('advanced_personalization', context);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should handle different context types', async () => {
      await service.enableFeature('advanced_personalization');
      await service.setRolloutPercentage('advanced_personalization', 50);
      
      const userContext = { userId: 'test-user' };
      const sessionContext = { sessionId: 'test-session' };
      const domainContext = { domainId: 'test-domain' };
      
      const userResult = await service.isEnabled('advanced_personalization', userContext);
      const sessionResult = await service.isEnabled('advanced_personalization', sessionContext);
      const domainResult = await service.isEnabled('advanced_personalization', domainContext);
      
      expect(typeof userResult).toBe('boolean');
      expect(typeof sessionResult).toBe('boolean');
      expect(typeof domainResult).toBe('boolean');
    });
  });

  describe('Flag Queries', () => {
    it('should get enabled flags by category', async () => {
      await service.enableFeature('rag_enhancement');
      await service.enableFeature('hybrid_search');
      
      const coreFlags = await service.getEnabledFlagsByCategory('core');
      const experimentalFlags = await service.getEnabledFlagsByCategory('experimental');
      
      expect(coreFlags).toContain('content_caching');
      expect(coreFlags).toContain('performance_monitoring');
      expect(experimentalFlags).toHaveLength(0);
    });

    it('should get flag statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('disabled');
      expect(stats).toHaveProperty('experimental');
      expect(stats).toHaveProperty('core');
      expect(stats).toHaveProperty('deprecated');
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.enabled + stats.disabled).toBe(stats.total);
    });

    it('should evaluate multiple flags at once', async () => {
      const flagNames = ['rag_enhancement', 'hybrid_search', 'content_caching'];
      const results = await service.evaluateFlags(flagNames);
      
      expect(results).toHaveProperty('rag_enhancement');
      expect(results).toHaveProperty('hybrid_search');
      expect(results).toHaveProperty('content_caching');
      
      Object.values(results).forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Custom Flag Management', () => {
    it('should set custom flag', () => {
      const customFlag = {
        name: 'custom_feature',
        enabled: true,
        description: 'Custom test feature',
        category: 'experimental' as const,
        rolloutPercentage: 25,
      };
      
      service.setFlag(customFlag);
      
      const retrievedFlag = service.getFlag('custom_feature');
      expect(retrievedFlag).toMatchObject(customFlag);
    });

    it('should remove flag', () => {
      const customFlag = {
        name: 'removable_feature',
        enabled: true,
        description: 'Removable test feature',
        category: 'experimental' as const,
      };
      
      service.setFlag(customFlag);
      expect(service.getFlag('removable_feature')).not.toBeNull();
      
      const removed = service.removeFlag('removable_feature');
      expect(removed).toBe(true);
      expect(service.getFlag('removable_feature')).toBeNull();
    });

    it('should return false when removing non-existent flag', () => {
      const removed = service.removeFlag('non_existent_flag');
      expect(removed).toBe(false);
    });
  });

  describe('Evaluation Context', () => {
    it('should provide evaluation context for existing flag', async () => {
      await service.enableFeature('rag_enhancement');
      
      const context = await service.getEvaluationContext('rag_enhancement');
      
      expect(context.flagExists).toBe(true);
      expect(context.globallyEnabled).toBe(true);
      expect(context.dependenciesMet).toBe(true);
      expect(context.rolloutIncluded).toBe(true);
      expect(context.finalResult).toBe(true);
      expect(context.flag).toBeDefined();
    });

    it('should provide evaluation context for non-existent flag', async () => {
      const context = await service.getEvaluationContext('non_existent_flag');
      
      expect(context.flagExists).toBe(false);
      expect(context.globallyEnabled).toBe(false);
      expect(context.dependenciesMet).toBe(false);
      expect(context.rolloutIncluded).toBe(false);
      expect(context.finalResult).toBe(false);
      expect(context.flag).toBeUndefined();
    });

    it('should show dependency failure in evaluation context', async () => {
      await service.disableFeature('rag_enhancement');
      await service.enableFeature('hybrid_search');
      
      const context = await service.getEvaluationContext('hybrid_search');
      
      expect(context.flagExists).toBe(true);
      expect(context.globallyEnabled).toBe(true);
      expect(context.dependenciesMet).toBe(false);
      expect(context.finalResult).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await service.enableFeature('advanced_personalization');
      await service.setRolloutPercentage('advanced_personalization', 50);
      
      const context = { userId: 'test-user' };
      
      // Get initial result
      const result1 = await service.isEnabled('advanced_personalization', context);
      
      // Clear cache
      service.clearCache();
      
      // Get result again (should be consistent due to deterministic hash)
      const result2 = await service.isEnabled('advanced_personalization', context);
      
      expect(result1).toBe(result2);
    });
  });
});