/**
 * Health Controller
 * 
 * Provides health check endpoints for monitoring and load balancer probes.
 * Implements Kubernetes-style health check patterns.
 */

import { Request, Response } from 'express';
import { healthCheckService } from '../services/health-check.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('HealthController');

// Helper function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/**
 * Health Controller
 * 
 * Handles health check endpoints for production monitoring.
 */
export class HealthController {
  /**
   * Basic health check endpoint
   * GET /health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await healthCheckService.getBasicHealth();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        environment: health.environment,
        checks: health.checks,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Health check failed', { error: errorMessage });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check service unavailable',
      });
    }
  }

  /**
   * Readiness probe endpoint
   * GET /health/ready
   */
  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const health = await healthCheckService.getReadinessHealth();
      
      // Readiness check should return 503 if not ready
      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        environment: health.environment,
        checks: health.checks,
        ready: health.status === 'healthy',
      });

      // Log readiness status changes
      if (health.status !== 'healthy') {
        logger.warn('Service not ready', { 
          status: health.status,
          failedChecks: Object.entries(health.checks)
            .filter(([_, check]) => check.status !== 'healthy')
            .map(([name, check]) => ({ name, status: check.status, message: check.message }))
        });
      }

    } catch (error) {
      logger.error('Readiness check failed', { error: getErrorMessage(error) });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        ready: false,
        error: 'Readiness check service unavailable',
      });
    }
  }

  /**
   * Liveness probe endpoint
   * GET /health/live
   */
  async getLiveness(req: Request, res: Response): Promise<void> {
    try {
      const health = await healthCheckService.getLivenessHealth();
      
      // Liveness check should return 503 only if the service should be restarted
      const statusCode = health.status === 'unhealthy' ? 503 : 200;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        checks: health.checks,
        alive: health.status !== 'unhealthy',
      });

      // Log critical liveness failures
      if (health.status === 'unhealthy') {
        logger.error('Liveness check failed', { 
          status: health.status,
          checks: health.checks,
        });
      }

    } catch (error) {
      logger.error('Liveness check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        alive: false,
        error: 'Liveness check service unavailable',
      });
    }
  }

  /**
   * Detailed health check endpoint
   * GET /health/detailed
   */
  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await healthCheckService.getReadinessHealth();
      const metrics = await healthCheckService.getSystemMetrics();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        environment: health.environment,
        checks: health.checks,
        metrics: metrics,
        summary: {
          totalChecks: Object.keys(health.checks).length,
          healthyChecks: Object.values(health.checks).filter(check => check.status === 'healthy').length,
          degradedChecks: Object.values(health.checks).filter(check => check.status === 'degraded').length,
          unhealthyChecks: Object.values(health.checks).filter(check => check.status === 'unhealthy').length,
        },
      });

    } catch (error) {
      logger.error('Detailed health check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check service unavailable',
      });
    }
  }

  /**
   * System metrics endpoint
   * GET /health/metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await healthCheckService.getSystemMetrics();
      
      res.status(200).json({
        timestamp: new Date().toISOString(),
        metrics,
      });

    } catch (error) {
      logger.error('Metrics collection failed', { error: error.message });
      res.status(500).json({
        timestamp: new Date().toISOString(),
        error: 'Metrics collection unavailable',
      });
    }
  }

  /**
   * Component-specific health check
   * GET /health/component/:component
   */
  async getComponentHealth(req: Request, res: Response): Promise<void> {
    try {
      const { component } = req.params;
      const health = await healthCheckService.getReadinessHealth();
      
      const componentHealth = health.checks[component];
      
      if (!componentHealth) {
        res.status(404).json({
          error: `Component '${component}' not found`,
          availableComponents: Object.keys(health.checks),
        });
        return;
      }

      const statusCode = componentHealth.status === 'healthy' ? 200 : 
                        componentHealth.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        component,
        ...componentHealth,
      });

    } catch (error) {
      logger.error('Component health check failed', { 
        component: req.params.component,
        error: error.message 
      });
      res.status(503).json({
        component: req.params.component,
        status: 'unhealthy',
        error: 'Component health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Health check summary endpoint (for dashboards)
   * GET /health/summary
   */
  async getHealthSummary(req: Request, res: Response): Promise<void> {
    try {
      const health = await healthCheckService.getReadinessHealth();
      const metrics = await healthCheckService.getSystemMetrics();
      
      const summary = {
        overall: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        environment: health.environment,
        components: {
          total: Object.keys(health.checks).length,
          healthy: Object.values(health.checks).filter(check => check.status === 'healthy').length,
          degraded: Object.values(health.checks).filter(check => check.status === 'degraded').length,
          unhealthy: Object.values(health.checks).filter(check => check.status === 'unhealthy').length,
        },
        performance: {
          averageResponseTime: Object.values(health.checks)
            .reduce((sum, check) => sum + check.responseTime, 0) / Object.keys(health.checks).length,
          memoryUsage: metrics.memory.percentage,
          cpuUsage: metrics.cpu.usage,
        },
        criticalIssues: Object.entries(health.checks)
          .filter(([_, check]) => check.status === 'unhealthy')
          .map(([name, check]) => ({
            component: name,
            message: check.message,
            lastChecked: check.lastChecked,
          })),
      };

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(summary);

    } catch (error) {
      logger.error('Health summary failed', { error: error.message });
      res.status(503).json({
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health summary service unavailable',
      });
    }
  }

  /**
   * Cache control endpoint
   * POST /health/cache/clear
   */
  async clearHealthCache(req: Request, res: Response): Promise<void> {
    try {
      healthCheckService.clearCache();
      
      res.status(200).json({
        message: 'Health check cache cleared successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Cache clear failed', { error: error.message });
      res.status(500).json({
        error: 'Failed to clear health check cache',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Health check configuration endpoint
   * GET /health/config
   */
  async getHealthConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = {
        endpoints: {
          basic: '/health',
          readiness: '/health/ready',
          liveness: '/health/live',
          detailed: '/health/detailed',
          metrics: '/health/metrics',
          summary: '/health/summary',
        },
        components: [
          'application',
          'database',
          'openai',
          'supabase',
          'rag',
          'featureFlags',
          'memory',
          'cpu',
        ],
        statusCodes: {
          healthy: 200,
          degraded: 200,
          unhealthy: 503,
        },
        thresholds: {
          memory: { degraded: 80, unhealthy: 90 },
          cpu: { degraded: 80, unhealthy: 90 },
          responseTime: { degraded: 5000, unhealthy: 10000 },
        },
      };

      res.status(200).json(config);

    } catch (error) {
      logger.error('Health config request failed', { error: error.message });
      res.status(500).json({
        error: 'Failed to retrieve health check configuration',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const healthController = new HealthController();