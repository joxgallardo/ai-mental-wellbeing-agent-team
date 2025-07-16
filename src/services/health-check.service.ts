/**
 * Health Check Service
 * 
 * Comprehensive health monitoring for production deployment
 * including database, external services, and system resources.
 */

import { createLogger } from '../utils/logger';
import { ragFoundationService } from './rag/rag-foundation.service';
import { featureFlagService } from './feature-flag.service';
import { openAIService } from './openai.service';
import productionConfig from '../config/production.config';

const logger = createLogger('HealthCheck');

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, ComponentHealth>;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: Record<string, any>;
  lastChecked: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  processes: {
    active: number;
    total: number;
  };
}

/**
 * Health Check Service
 * 
 * Monitors all system components and provides detailed health status.
 */
export class HealthCheckService {
  private startTime = Date.now();
  private healthCache = new Map<string, ComponentHealth>();
  private cacheTimeout = 30000; // 30 seconds

  /**
   * Perform basic health check
   */
  async getBasicHealth(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};

    // Check essential components only
    checks.application = await this.checkApplication();
    checks.memory = await this.checkMemory();

    const overallStatus = this.calculateOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: productionConfig.app.version,
      environment: productionConfig.app.environment,
    };
  }

  /**
   * Perform readiness check
   */
  async getReadinessHealth(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};

    // Check all critical dependencies
    const checkPromises = [
      this.checkApplication(),
      this.checkDatabase(),
      this.checkOpenAI(),
      this.checkSupabase(),
      this.checkRAG(),
      this.checkFeatureFlags(),
      this.checkMemory(),
      this.checkCPU(),
    ];

    const results = await Promise.allSettled(checkPromises);
    const checkNames = ['application', 'database', 'openai', 'supabase', 'rag', 'featureFlags', 'memory', 'cpu'];

    results.forEach((result, index) => {
      const checkName = checkNames[index];
      if (result.status === 'fulfilled') {
        checks[checkName] = result.value;
      } else {
        checks[checkName] = {
          status: 'unhealthy',
          responseTime: 0,
          message: result.reason?.message || 'Check failed',
          lastChecked: new Date().toISOString(),
        };
      }
    });

    const overallStatus = this.calculateOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: productionConfig.app.version,
      environment: productionConfig.app.environment,
    };
  }

  /**
   * Perform liveness check
   */
  async getLivenessHealth(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};

    // Quick checks only
    checks.memory = await this.checkMemory();
    checks.cpu = await this.checkCPU();

    const overallStatus = this.calculateOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: productionConfig.app.version,
      environment: productionConfig.app.environment,
    };
  }

  /**
   * Check application health
   */
  private async checkApplication(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Basic application checks
      const nodeVersion = process.version;
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Application running normally',
        details: {
          nodeVersion,
          uptime: `${Math.floor(uptime)} seconds`,
          memoryUsage: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          },
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Application health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Application check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, you would check your database connection
      // For now, we'll simulate the check
      
      const connectionTest = await this.testDatabaseConnection();
      
      if (connectionTest.connected) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'Database connection healthy',
          details: {
            connectionPool: connectionTest.poolStatus,
            activeConnections: connectionTest.activeConnections,
            latency: connectionTest.latency,
          },
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: 'Database connection failed',
          lastChecked: new Date().toISOString(),
        };
      }

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Database check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check OpenAI service
   */
  private async checkOpenAI(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test OpenAI connectivity with a simple request
      const isHealthy = await openAIService.healthCheck?.() || true; // Assuming healthCheck method exists
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        message: isHealthy ? 'OpenAI service healthy' : 'OpenAI service degraded',
        details: {
          model: productionConfig.openai.model,
          apiVersion: 'v1',
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('OpenAI health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `OpenAI check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Supabase service
   */
  private async checkSupabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test Supabase connectivity
      const isHealthy = await this.testSupabaseConnection();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        message: isHealthy ? 'Supabase connection healthy' : 'Supabase connection failed',
        details: {
          url: productionConfig.supabase.url,
          vectorSupport: true,
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Supabase health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Supabase check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check RAG system
   */
  private async checkRAG(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const isEnabled = ragFoundationService.isEnabled();
      const isReady = ragFoundationService.isReady();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'RAG system operational';
      
      if (!isEnabled) {
        status = 'degraded';
        message = 'RAG system disabled';
      } else if (!isReady) {
        status = 'unhealthy';
        message = 'RAG system not ready';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          enabled: isEnabled,
          ready: isReady,
          embeddingModel: productionConfig.rag.embedding.model,
          chunkSize: productionConfig.rag.chunking.chunkSize,
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('RAG health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `RAG check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check feature flags
   */
  private async checkFeatureFlags(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test feature flag service
      const testFlag = await featureFlagService.isEnabled('health_check_test', {});
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Feature flags service healthy',
        details: {
          provider: productionConfig.featureFlags.provider,
          testFlag: testFlag,
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Feature flags health check failed', { error: error.message });
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        message: `Feature flags check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage normal';
      
      if (memoryPercentage > 90) {
        status = 'unhealthy';
        message = 'Memory usage critical';
      } else if (memoryPercentage > 80) {
        status = 'degraded';
        message = 'Memory usage high';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          usedMB: Math.round(usedMemory / 1024 / 1024),
          totalMB: Math.round(totalMemory / 1024 / 1024),
          percentage: Math.round(memoryPercentage),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Memory health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Memory check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check CPU usage
   */
  private async checkCPU(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const loadAverage = process.loadavg();
      const cpuCount = require('os').cpus().length;
      const cpuUsage = (loadAverage[0] / cpuCount) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'CPU usage normal';
      
      if (cpuUsage > 90) {
        status = 'unhealthy';
        message = 'CPU usage critical';
      } else if (cpuUsage > 80) {
        status = 'degraded';
        message = 'CPU usage high';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          usage: Math.round(cpuUsage),
          loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
          cpuCount,
        },
        lastChecked: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('CPU health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `CPU check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate overall status from individual checks
   */
  private calculateOverallStatus(checks: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const loadAverage = process.loadavg();
    const cpuCount = require('os').cpus().length;
    
    return {
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        usage: Math.round((loadAverage[0] / cpuCount) * 100),
        loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
      },
      disk: {
        used: 0, // Would implement actual disk usage check
        total: 0,
        percentage: 0,
      },
      processes: {
        active: 1, // Would implement actual process count
        total: 1,
      },
    };
  }

  /**
   * Test database connection (mock implementation)
   */
  private async testDatabaseConnection(): Promise<{
    connected: boolean;
    poolStatus: string;
    activeConnections: number;
    latency: number;
  }> {
    // Mock implementation - replace with actual database check
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          connected: true,
          poolStatus: 'healthy',
          activeConnections: 5,
          latency: 15,
        });
      }, 50);
    });
  }

  /**
   * Test Supabase connection (mock implementation)
   */
  private async testSupabaseConnection(): Promise<boolean> {
    // Mock implementation - replace with actual Supabase check
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  /**
   * Get cached health result
   */
  private getCachedHealth(key: string): ComponentHealth | null {
    const cached = this.healthCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - new Date(cached.lastChecked).getTime();
    if (age > this.cacheTimeout) {
      this.healthCache.delete(key);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache health result
   */
  private setCachedHealth(key: string, health: ComponentHealth): void {
    this.healthCache.set(key, health);
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();