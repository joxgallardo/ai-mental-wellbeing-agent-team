/**
 * Feature Rollout Controller
 * 
 * Provides REST API endpoints for managing feature rollouts in production.
 * Includes monitoring, A/B testing, and emergency rollback capabilities.
 */

import { Request, Response } from 'express';
import { featureRolloutService, RolloutConfig, UserFeedback } from '../services/feature-rollout.service';
import { validateBody } from '../middleware/validation.middleware';
import { authenticateApiKey, AuthenticatedRequest } from '../middleware/auth.middleware';
import { createLogger } from '../utils/logger';
import { z } from 'zod';

const logger = createLogger('RolloutController');

// Validation schemas
const StartRolloutSchema = z.object({
  featureKey: z.string().min(1),
  targetPercentage: z.number().min(0).max(100),
  incrementPercentage: z.number().min(1).max(50).default(5),
  incrementInterval: z.number().min(1).max(1440).default(30), // max 24 hours
});

const UserFeedbackSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  rating: z.number().min(1).max(5),
  feedback: z.string().optional().default(''),
  ragEnabled: z.boolean(),
});

/**
 * Feature Rollout Controller
 * 
 * Handles production feature rollout management with safety controls.
 */
export class RolloutController {
  /**
   * Start a new feature rollout
   * POST /api/admin/rollout/start
   */
  async startRollout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = StartRolloutSchema.parse(req.body);
      
      logger.info('Starting rollout request', {
        featureKey: validatedData.featureKey,
        requestedBy: req.user?.id,
      });

      const config: RolloutConfig = {
        featureKey: validatedData.featureKey,
        targetPercentage: validatedData.targetPercentage,
        incrementPercentage: validatedData.incrementPercentage,
        incrementInterval: validatedData.incrementInterval,
        maxRollbackThreshold: 5, // 5% error rate threshold
        monitoringMetrics: [
          'error_rate',
          'avg_response_time',
          'user_satisfaction',
          'rag_retrieval_success_rate',
          'knowledge_quality_score',
        ],
        rollbackConditions: [
          {
            metric: 'error_rate',
            threshold: 5,
            operator: 'gt',
            timeWindow: 15,
          },
          {
            metric: 'user_satisfaction',
            threshold: 3.0,
            operator: 'lt',
            timeWindow: 60,
          },
        ],
      };

      await featureRolloutService.startRollout(config);

      res.status(200).json({
        success: true,
        message: 'Feature rollout started successfully',
        config: {
          featureKey: config.featureKey,
          targetPercentage: config.targetPercentage,
          incrementPercentage: config.incrementPercentage,
          incrementInterval: config.incrementInterval,
        },
      });

    } catch (error) {
      logger.error('Failed to start rollout', { error: error.message, stack: error.stack });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get rollout status
   * GET /api/admin/rollout/status/:featureKey
   */
  async getRolloutStatus(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      
      const status = featureRolloutService.getRolloutStatus(featureKey);
      
      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Rollout not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        status,
      });

    } catch (error) {
      logger.error('Failed to get rollout status', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all active rollouts
   * GET /api/admin/rollout/active
   */
  async getActiveRollouts(req: Request, res: Response): Promise<void> {
    try {
      const activeRollouts = featureRolloutService.getActiveRollouts();
      
      res.status(200).json({
        success: true,
        rollouts: activeRollouts,
        count: activeRollouts.length,
      });

    } catch (error) {
      logger.error('Failed to get active rollouts', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Pause a rollout
   * POST /api/admin/rollout/pause/:featureKey
   */
  async pauseRollout(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      
      logger.warn('Pausing rollout', {
        featureKey,
        requestedBy: req.user?.id,
      });

      await featureRolloutService.pauseRollout(featureKey);

      res.status(200).json({
        success: true,
        message: 'Rollout paused successfully',
      });

    } catch (error) {
      logger.error('Failed to pause rollout', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Resume a rollout
   * POST /api/admin/rollout/resume/:featureKey
   */
  async resumeRollout(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      
      logger.info('Resuming rollout', {
        featureKey,
        requestedBy: req.user?.id,
      });

      await featureRolloutService.resumeRollout(featureKey);

      res.status(200).json({
        success: true,
        message: 'Rollout resumed successfully',
      });

    } catch (error) {
      logger.error('Failed to resume rollout', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Emergency rollback
   * POST /api/admin/rollout/rollback/:featureKey
   */
  async emergencyRollback(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      const { reason } = req.body;
      
      logger.error('Emergency rollback initiated', {
        featureKey,
        reason,
        requestedBy: req.user?.id,
      });

      await featureRolloutService.initiateRollback(featureKey, reason || 'Manual emergency rollback');

      res.status(200).json({
        success: true,
        message: 'Emergency rollback completed successfully',
      });

    } catch (error) {
      logger.error('Failed to execute emergency rollback', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Submit user feedback
   * POST /api/feedback/rollout
   */
  async submitUserFeedback(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = UserFeedbackSchema.parse(req.body);
      
      const feedback: UserFeedback = {
        ...validatedData,
        timestamp: new Date(),
      };

      featureRolloutService.recordUserFeedback(feedback);

      res.status(200).json({
        success: true,
        message: 'Feedback recorded successfully',
      });

    } catch (error) {
      logger.error('Failed to record user feedback', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get A/B test results
   * GET /api/admin/rollout/ab-results/:featureKey
   */
  async getABTestResults(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      
      const results = await featureRolloutService.getABTestResults(featureKey);
      
      res.status(200).json({
        success: true,
        results,
        summary: {
          totalTests: results.length,
          significantResults: results.filter(r => r.statisticalSignificance >= 0.95).length,
          averageImprovement: results.reduce((sum, r) => sum + r.improvement, 0) / results.length,
        },
      });

    } catch (error) {
      logger.error('Failed to get A/B test results', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get rollout dashboard data
   * GET /api/admin/rollout/dashboard
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const activeRollouts = featureRolloutService.getActiveRollouts();
      const ragStatus = featureRolloutService.getRolloutStatus('rag_enhancement');
      
      // Calculate summary metrics
      const dashboardData = {
        summary: {
          activeRollouts: activeRollouts.length,
          completedRollouts: ragStatus?.status === 'completed' ? 1 : 0,
          pausedRollouts: activeRollouts.filter(r => r.status === 'paused').length,
          totalUsers: ragStatus ? Math.floor(ragStatus.currentPercentage * 1000) : 0, // Mock user count
        },
        ragEnhancement: ragStatus ? {
          status: ragStatus.status,
          currentPercentage: ragStatus.currentPercentage,
          targetPercentage: ragStatus.targetPercentage,
          metrics: ragStatus.metrics,
          lastUpdate: ragStatus.lastUpdateTime,
          userFeedbackCount: ragStatus.userFeedback.length,
          averageRating: ragStatus.userFeedback.length > 0 
            ? ragStatus.userFeedback.reduce((sum, f) => sum + f.rating, 0) / ragStatus.userFeedback.length
            : 0,
        } : null,
        activeRollouts,
      };

      res.status(200).json({
        success: true,
        data: dashboardData,
      });

    } catch (error) {
      logger.error('Failed to get dashboard data', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Start RAG enhancement rollout with predefined safe configuration
   * POST /api/admin/rollout/start-rag
   */
  async startRAGRollout(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Starting RAG enhancement rollout', {
        requestedBy: req.user?.id,
      });

      const ragConfig: RolloutConfig = {
        featureKey: 'rag_enhancement',
        targetPercentage: 100,
        incrementPercentage: 5, // 5% increments
        incrementInterval: 30, // 30 minutes between increments
        maxRollbackThreshold: 3, // 3% error rate threshold (conservative)
        monitoringMetrics: [
          'error_rate',
          'avg_response_time',
          'user_satisfaction',
          'rag_retrieval_success_rate',
          'knowledge_quality_score',
          'session_completion_rate',
        ],
        rollbackConditions: [
          {
            metric: 'error_rate',
            threshold: 3,
            operator: 'gt',
            timeWindow: 15,
          },
          {
            metric: 'user_satisfaction',
            threshold: 3.5,
            operator: 'lt',
            timeWindow: 60,
          },
          {
            metric: 'rag_retrieval_success_rate',
            threshold: 85,
            operator: 'lt',
            timeWindow: 30,
          },
          {
            metric: 'avg_response_time',
            threshold: 3000, // 3 seconds
            operator: 'gt',
            timeWindow: 15,
          },
        ],
      };

      await featureRolloutService.startRollout(ragConfig);

      res.status(200).json({
        success: true,
        message: 'RAG enhancement rollout started successfully',
        config: {
          featureKey: ragConfig.featureKey,
          targetPercentage: ragConfig.targetPercentage,
          incrementPercentage: ragConfig.incrementPercentage,
          incrementInterval: ragConfig.incrementInterval,
          estimatedCompletionTime: `${Math.ceil(ragConfig.targetPercentage / ragConfig.incrementPercentage) * ragConfig.incrementInterval} minutes`,
        },
      });

    } catch (error) {
      logger.error('Failed to start RAG rollout', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const rolloutController = new RolloutController();