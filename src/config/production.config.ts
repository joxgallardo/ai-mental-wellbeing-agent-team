/**
 * Production Configuration
 * 
 * Comprehensive production environment configuration for the Mental Health AI Agent system
 * with RAG enhancement and LangGraph workflow capabilities.
 */

import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

/**
 * Environment validation schema
 */
const ProductionConfigSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  PORT: z.string().transform(Number).default(3000),
  API_VERSION: z.string().default('v1'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.string().transform(Number).default(20),
  DATABASE_SSL: z.enum(['true', 'false']).transform(Boolean).default(true),
  
  // Supabase (Vector Database)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // OpenAI
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default(2000),
  OPENAI_TEMPERATURE: z.string().transform(Number).default(0.7),
  
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGINS: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // RAG Configuration
  RAG_ENABLED: z.enum(['true', 'false']).transform(Boolean).default(true),
  RAG_CHUNK_SIZE: z.string().transform(Number).default(1000),
  RAG_CHUNK_OVERLAP: z.string().transform(Number).default(200),
  RAG_SIMILARITY_THRESHOLD: z.string().transform(Number).default(0.7),
  RAG_MAX_RESULTS: z.string().transform(Number).default(5),
  
  // LangGraph Configuration
  LANGGRAPH_ENABLED: z.enum(['true', 'false']).transform(Boolean).default(true),
  LANGGRAPH_MAX_RETRIES: z.string().transform(Number).default(3),
  LANGGRAPH_TIMEOUT_MS: z.string().transform(Number).default(30000),
  
  // Feature Flags
  FEATURE_FLAG_PROVIDER: z.enum(['local', 'remote']).default('local'),
  FEATURE_FLAG_REFRESH_INTERVAL_MS: z.string().transform(Number).default(60000),
  
  // Monitoring
  MONITORING_ENABLED: z.enum(['true', 'false']).transform(Boolean).default(true),
  METRICS_PORT: z.string().transform(Number).default(9090),
  HEALTH_CHECK_INTERVAL_MS: z.string().transform(Number).default(30000),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  LOG_FILE_ENABLED: z.enum(['true', 'false']).transform(Boolean).default(true),
  
  // Cache
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.string().transform(Number).default(3600),
  
  // Error Tracking
  SENTRY_DSN: z.string().url().optional(),
  ERROR_REPORTING_ENABLED: z.enum(['true', 'false']).transform(Boolean).default(true),
  
  // Performance
  MAX_CONCURRENT_REQUESTS: z.string().transform(Number).default(100),
  REQUEST_TIMEOUT_MS: z.string().transform(Number).default(30000),
  MEMORY_LIMIT_MB: z.string().transform(Number).default(512),
  
  // Deployment
  DEPLOYMENT_ENVIRONMENT: z.string().default('production'),
  BUILD_VERSION: z.string().default('1.0.0'),
  DEPLOYMENT_DATE: z.string().default(new Date().toISOString()),
});

/**
 * Validate and parse environment variables
 */
const env = ProductionConfigSchema.parse(process.env);

/**
 * Production Configuration Object
 */
export const productionConfig = {
  // Application Configuration
  app: {
    name: 'Mental Health AI Agent',
    version: env.BUILD_VERSION,
    environment: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    deploymentDate: env.DEPLOYMENT_DATE,
  },

  // Database Configuration
  database: {
    url: env.DATABASE_URL,
    poolSize: env.DATABASE_POOL_SIZE,
    ssl: env.DATABASE_SSL,
    connectionTimeout: 10000,
    idleTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },

  // Supabase Configuration
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'mental-health-ai-agent',
      },
    },
  },

  // OpenAI Configuration
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    maxTokens: env.OPENAI_MAX_TOKENS,
    temperature: env.OPENAI_TEMPERATURE,
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },

  // Telegram Configuration
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN,
    webhookUrl: env.TELEGRAM_WEBHOOK_URL,
    polling: !env.TELEGRAM_WEBHOOK_URL, // Use polling if no webhook
    pollingTimeout: 10,
    maxConnections: 100,
  },

  // Security Configuration
  security: {
    jwtSecret: env.JWT_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
    cors: {
      origin: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
      credentials: true,
      optionsSuccessStatus: 200,
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => req.ip === '127.0.0.1', // Skip localhost
  },

  // Enhanced RAG Configuration for Agent Integration
  rag: {
    enabled: env.RAG_ENABLED,
    foundation: {
      enabled: true,
      fallbackEnabled: true,
      qualityThreshold: 0.8,
      maxRetries: 3,
      timeoutMs: 10000,
    },
    chunking: {
      chunkSize: env.RAG_CHUNK_SIZE,
      chunkOverlap: env.RAG_CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ': ', ' ', ''],
      minChunkSize: 100,
      maxChunkSize: 2000,
    },
    retrieval: {
      similarityThreshold: env.RAG_SIMILARITY_THRESHOLD,
      maxResults: env.RAG_MAX_RESULTS,
      hybridSearchWeight: 0.7, // Weight for semantic vs keyword search
      rerankingEnabled: true,
      diversityThreshold: 0.3,
    },
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
      batchSize: 50,
      normalize: true,
      poolingStrategy: 'mean',
    },
    agents: {
      assessment: {
        focusCategories: ['assessment_tools', 'risk_evaluation', 'methodologies'],
        maxResults: 8,
        similarityThreshold: 0.75,
        roleSpecificFiltering: true,
      },
      action: {
        focusCategories: ['best_practices', 'interventions', 'resources', 'crisis_management'],
        maxResults: 10,
        similarityThreshold: 0.72,
        urgencyAwareRanking: true,
      },
      followUp: {
        focusCategories: ['best_practices', 'methodologies', 'long_term_strategies', 'monitoring'],
        maxResults: 8,
        similarityThreshold: 0.73,
        timeframeAwareFiltering: true,
      },
    },
    domainAdapters: {
      enabled: true,
      defaultDomain: 'life_coaching',
      adaptiveThresholds: true,
      contextualEnhancement: true,
    },
    cache: {
      enabled: true,
      ttlSeconds: env.CACHE_TTL_SECONDS,
      maxSize: 1000,
      compressionEnabled: true,
      layeredCaching: {
        embedding: { ttl: 86400 }, // 24 hours
        search: { ttl: 3600 },     // 1 hour
        results: { ttl: 1800 },    // 30 minutes
      },
    },
    monitoring: {
      enabled: true,
      logSearchQueries: true,
      trackQualityMetrics: true,
      alertOnFailures: true,
    },
  },

  // LangGraph Configuration
  langgraph: {
    enabled: env.LANGGRAPH_ENABLED,
    maxRetries: env.LANGGRAPH_MAX_RETRIES,
    timeoutMs: env.LANGGRAPH_TIMEOUT_MS,
    checkpointing: {
      enabled: true,
      provider: 'memory', // In production, use database
    },
    tracing: {
      enabled: env.NODE_ENV === 'production',
      provider: 'langsmith',
    },
  },

  // Enhanced Feature Flags Configuration for RAG Integration
  featureFlags: {
    provider: env.FEATURE_FLAG_PROVIDER,
    refreshIntervalMs: env.FEATURE_FLAG_REFRESH_INTERVAL_MS,
    defaults: {
      rag_enhancement: false, // Start disabled, enable via rollout
      rag_agent_assessment: false, // Enhanced assessment agent
      rag_agent_action: false, // Enhanced action agent
      rag_agent_followup: false, // Enhanced follow-up agent
      langgraph_workflow: false, // Start disabled, enable gradually
      domain_adapters: true, // Multi-domain support
      hybrid_search: true, // Hybrid semantic + keyword search
      advanced_analytics: true,
      user_feedback_collection: true,
      performance_monitoring: true,
    },
    rollout: {
      enabled: true,
      gradualActivation: {
        enabled: true,
        defaultIncrements: [5, 10, 25, 50, 100],
        defaultInterval: 30, // minutes
        maxErrorRate: 5,
        maxResponseTime: 5000,
        minUserSatisfaction: 3.5,
      },
      safetyThresholds: {
        errorRate: 5, // 5% max error rate
        responseTime: 5000, // 5 second max response time
        userSatisfaction: 3.5, // Minimum 3.5/5 rating
        ragFailureRate: 10, // 10% max RAG failure rate
        memoryUsage: 80, // 80% max memory usage
      },
      monitoring: {
        enabled: true,
        healthCheckInterval: 30000, // 30 seconds
        metricsCollection: true,
        alerting: {
          enabled: true,
          channels: ['email', 'slack'],
          escalationLevels: ['warning', 'critical', 'emergency'],
        },
      },
    },
  },

  // Monitoring Configuration
  monitoring: {
    enabled: env.MONITORING_ENABLED,
    metricsPort: env.METRICS_PORT,
    healthCheck: {
      intervalMs: env.HEALTH_CHECK_INTERVAL_MS,
      timeout: 5000,
      endpoints: [
        '/health',
        '/health/ready',
        '/health/live',
        '/metrics',
      ],
    },
    prometheus: {
      enabled: true,
      path: '/metrics',
      collectDefaultMetrics: true,
    },
    alerts: {
      enabled: true,
      channels: ['email', 'slack'],
      thresholds: {
        errorRate: 5, // 5%
        responseTime: 2000, // 2 seconds
        memoryUsage: 80, // 80%
        cpuUsage: 80, // 80%
      },
    },
  },

  // Logging Configuration
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
    fileEnabled: env.LOG_FILE_ENABLED,
    transports: {
      console: {
        enabled: true,
        colorize: env.NODE_ENV !== 'production',
      },
      file: {
        enabled: env.LOG_FILE_ENABLED,
        filename: '/var/log/mental-health-ai/app.log',
        maxSize: '20m',
        maxFiles: '14d',
      },
      cloudWatch: {
        enabled: env.NODE_ENV === 'production',
        logGroup: '/aws/ec2/mental-health-ai',
        logStream: env.DEPLOYMENT_ENVIRONMENT,
      },
    },
    sampling: {
      enabled: true,
      rate: 0.1, // Sample 10% of debug logs in production
    },
  },

  // Cache Configuration
  cache: {
    enabled: !!env.REDIS_URL,
    redis: {
      url: env.REDIS_URL,
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    },
    memory: {
      enabled: true,
      maxSize: 100, // MB
      ttlSeconds: env.CACHE_TTL_SECONDS,
    },
  },

  // Error Tracking Configuration
  errorTracking: {
    enabled: env.ERROR_REPORTING_ENABLED,
    sentry: {
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      release: env.BUILD_VERSION,
      tracesSampleRate: 0.1,
      integrations: ['http', 'express', 'postgres'],
    },
  },

  // Performance Configuration
  performance: {
    maxConcurrentRequests: env.MAX_CONCURRENT_REQUESTS,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    memoryLimitMB: env.MEMORY_LIMIT_MB,
    compression: {
      enabled: true,
      level: 6,
      threshold: 1024, // Compress responses > 1KB
    },
    clustering: {
      enabled: env.NODE_ENV === 'production',
      workers: 'auto', // Use CPU count
    },
  },

  // Health Check Endpoints
  healthChecks: {
    '/health': {
      timeout: 5000,
      checks: ['database', 'openai', 'supabase'],
    },
    '/health/ready': {
      timeout: 10000,
      checks: ['database', 'openai', 'supabase', 'rag', 'featureFlags', 'ragFoundation', 'enhancedAgents'],
    },
    '/health/live': {
      timeout: 1000,
      checks: ['memory', 'cpu'],
    },
  },

  // Graceful Shutdown Configuration
  gracefulShutdown: {
    enabled: true,
    timeoutMs: 15000,
    signals: ['SIGTERM', 'SIGINT'],
    cleanup: {
      database: true,
      cache: true,
      monitoring: true,
      fileHandles: true,
    },
  },
};

/**
 * Configuration validation
 */
export function validateProductionConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required environment variables
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if (!env.SUPABASE_URL) errors.push('SUPABASE_URL is required');
  if (!env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY is required');
  if (!env.TELEGRAM_BOT_TOKEN) errors.push('TELEGRAM_BOT_TOKEN is required');
  if (!env.JWT_SECRET) errors.push('JWT_SECRET is required');

  // Validate security requirements
  if (env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (env.ENCRYPTION_KEY.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters');
  }

  // Validate performance settings
  if (env.MAX_CONCURRENT_REQUESTS > 1000) {
    errors.push('MAX_CONCURRENT_REQUESTS should not exceed 1000');
  }
  if (env.REQUEST_TIMEOUT_MS > 60000) {
    errors.push('REQUEST_TIMEOUT_MS should not exceed 60 seconds');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export configuration for different environments
 */
export function getConfigForEnvironment(environment: string) {
  const baseConfig = productionConfig;

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        logging: { ...baseConfig.logging, level: 'debug' },
        monitoring: { ...baseConfig.monitoring, enabled: false },
        security: { 
          ...baseConfig.security,
          cors: { ...baseConfig.security.cors, origin: '*' },
        },
      };

    case 'staging':
      return {
        ...baseConfig,
        logging: { ...baseConfig.logging, level: 'info' },
        featureFlags: {
          ...baseConfig.featureFlags,
          defaults: {
            ...baseConfig.featureFlags.defaults,
            rag_enhancement: true, // Enable in staging
            langgraph_workflow: true,
          },
        },
      };

    case 'production':
    default:
      return baseConfig;
  }
}

// Export the configuration for the current environment
export default getConfigForEnvironment(env.NODE_ENV);