/**
 * Health Check Routes
 * 
 * Defines all health check endpoints for monitoring and observability.
 */

import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { rolloutController } from '../controllers/rollout.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for health endpoints (more lenient for monitoring)
const healthRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many health check requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin rate limiting (more restrictive)
const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  message: 'Too many admin requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public health endpoints (no auth required for monitoring)
router.get('/health', healthRateLimit, healthController.getHealth);
router.get('/health/ready', healthRateLimit, healthController.getReadiness);
router.get('/health/live', healthRateLimit, healthController.getLiveness);
router.get('/health/metrics', healthRateLimit, healthController.getMetrics);
router.get('/health/summary', healthRateLimit, healthController.getHealthSummary);
router.get('/health/component/:component', healthRateLimit, healthController.getComponentHealth);
router.get('/health/config', healthRateLimit, healthController.getHealthConfig);

// Admin-only health endpoints
router.get('/health/detailed', adminRateLimit, requireAuth, healthController.getDetailedHealth);
router.post('/health/cache/clear', adminRateLimit, requireAuth, healthController.clearHealthCache);

// Feature rollout endpoints (admin only)
router.post('/admin/rollout/start', adminRateLimit, requireAuth, rolloutController.startRollout);
router.post('/admin/rollout/start-rag', adminRateLimit, requireAuth, rolloutController.startRAGRollout);
router.get('/admin/rollout/status/:featureKey', adminRateLimit, requireAuth, rolloutController.getRolloutStatus);
router.get('/admin/rollout/active', adminRateLimit, requireAuth, rolloutController.getActiveRollouts);
router.post('/admin/rollout/pause/:featureKey', adminRateLimit, requireAuth, rolloutController.pauseRollout);
router.post('/admin/rollout/resume/:featureKey', adminRateLimit, requireAuth, rolloutController.resumeRollout);
router.post('/admin/rollout/rollback/:featureKey', adminRateLimit, requireAuth, rolloutController.emergencyRollback);
router.get('/admin/rollout/ab-results/:featureKey', adminRateLimit, requireAuth, rolloutController.getABTestResults);
router.get('/admin/rollout/dashboard', adminRateLimit, requireAuth, rolloutController.getDashboardData);

// Public feedback endpoint (for A/B testing)
router.post('/feedback/rollout', healthRateLimit, rolloutController.submitUserFeedback);

export default router;