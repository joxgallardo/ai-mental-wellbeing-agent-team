/**
 * Health Check Routes
 * 
 * Defines all health check endpoints for monitoring and observability.
 */

import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { rolloutController } from '../controllers/rollout.controller';
// import { requireAuth } from '../middleware/auth.middleware';
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

// Admin-only health endpoints (temporarily disabled auth)
router.get('/health/detailed', adminRateLimit, healthController.getDetailedHealth);
router.post('/health/cache/clear', adminRateLimit, healthController.clearHealthCache);

// Feature rollout endpoints (admin only) - temporarily disabled auth
router.post('/admin/rollout/start', adminRateLimit, rolloutController.startRollout);
router.post('/admin/rollout/start-rag', adminRateLimit, rolloutController.startRAGRollout);
router.get('/admin/rollout/status/:featureKey', adminRateLimit, rolloutController.getRolloutStatus);
router.get('/admin/rollout/active', adminRateLimit, rolloutController.getActiveRollouts);
router.post('/admin/rollout/pause/:featureKey', adminRateLimit, rolloutController.pauseRollout);
router.post('/admin/rollout/resume/:featureKey', adminRateLimit, rolloutController.resumeRollout);
router.post('/admin/rollout/rollback/:featureKey', adminRateLimit, rolloutController.emergencyRollback);
router.get('/admin/rollout/ab-results/:featureKey', adminRateLimit, rolloutController.getABTestResults);
router.get('/admin/rollout/dashboard', adminRateLimit, rolloutController.getDashboardData);

// Public feedback endpoint (for A/B testing)
router.post('/feedback/rollout', healthRateLimit, rolloutController.submitUserFeedback);

export default router;