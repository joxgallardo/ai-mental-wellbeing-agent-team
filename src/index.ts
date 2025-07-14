import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { serverConfig } from './config/index';
import { agentCoordinator } from './services/agent-coordinator.service';
import { UserInput, ApiResponse, MentalHealthPlan, AgentError, ValidationError, UserInputSchema } from './types/index';
import { logger } from './utils/logger';

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: serverConfig.corsOrigin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple rate limiting middleware
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  
  const userRequests = requestCounts.get(ip);
  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else if (userRequests.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      timestamp: new Date(),
    });
  } else {
    userRequests.count++;
  }
  
  return next();
});

// Health check endpoint
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      version: '1.0.0',
    },
    timestamp: new Date(),
  });
});

// Agent status endpoint
app.get('/agents/status', (_req: express.Request, res: express.Response) => {
  try {
    const status = agentCoordinator.getAgentStatus();
    const response: ApiResponse<Record<string, string>> = {
      success: true,
      data: status,
      timestamp: new Date(),
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get agent status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get agent status',
        code: 'INTERNAL_ERROR',
      },
      timestamp: new Date(),
    });
  }
});

// Main endpoint for generating mental health plans
app.post('/api/mental-health-plan', async (req: express.Request, res: express.Response) => {
  const sessionId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    logger.info('Received mental health plan request', {
      sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Validate request body
    const userInput: UserInput = req.body;
    
    if (!userInput || Object.keys(userInput).length === 0) {
      throw new ValidationError('Request body is required', 'body', req.body);
    }

    // Validate input structure using Zod schema
    try {
      UserInputSchema.parse(userInput);
    } catch (validationError) {
      if (validationError instanceof Error) {
        throw new ValidationError(
          `Validation failed: ${validationError.message}`,
          'body',
          userInput
        );
      }
      throw new ValidationError('Invalid request body structure', 'body', userInput);
    }

    // Generate mental health plan
    const plan = await agentCoordinator.generateMentalHealthPlan(userInput, sessionId);

    // Validate the generated plan
    const isValid = await agentCoordinator.validatePlan(plan);
    if (!isValid) {
      logger.warn('Generated plan failed validation', { sessionId });
    }

    const duration = Date.now() - startTime;
    logger.info('Mental health plan generated successfully', {
      sessionId,
      duration,
      riskLevel: plan.assessment.riskLevel,
      urgency: plan.actionPlan.urgency,
    });

    const response: ApiResponse<MentalHealthPlan> = {
      success: true,
      data: plan,
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to generate mental health plan', {
      sessionId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (error instanceof ValidationError || (error && (error as any).name === 'ValidationError')) {
      statusCode = 400;
      errorMessage = (error as any).message || 'Validation error';
      errorCode = 'VALIDATION_ERROR';
    } else if (error instanceof AgentError) {
      statusCode = 422;
      errorMessage = error.message;
      errorCode = error.code || 'INTERNAL_ERROR';
    }

    const errorResponse: ApiResponse<null> = {
      success: false,
      error: {
        message: errorMessage,
        code: errorCode,
        details: error instanceof Error ? { field: error.message } : undefined,
      },
      timestamp: new Date(),
    };

    res.status(statusCode).json(errorResponse);
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    timestamp: new Date(),
  });
});

// 404 handler
app.use('*', (_req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
    timestamp: new Date(),
  });
});

// Start server
const PORT = serverConfig.port;
app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: serverConfig.nodeEnv,
    timestamp: new Date(),
  });
  
  console.log(`🧠 AI Mental Wellbeing Agent Team`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Agent status: http://localhost:${PORT}/agents/status`);
  console.log(`💡 API endpoint: http://localhost:${PORT}/api/mental-health-plan`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app; 