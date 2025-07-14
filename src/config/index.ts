import dotenv from 'dotenv';
import { z } from 'zod';
import { SystemConfig } from '../types';

// Load environment variables
dotenv.config();

// Environment schema validation
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_TEMPERATURE: z.string().transform(Number).default('0.7'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default('2000'),
  OPENAI_TIMEOUT: z.string().transform(Number).default('30000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

// Validate environment variables
const env = EnvironmentSchema.parse(process.env);

// System configuration
export const config: SystemConfig = {
  openaiApiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_MODEL,
  temperature: env.OPENAI_TEMPERATURE,
  maxTokens: env.OPENAI_MAX_TOKENS,
  timeout: env.OPENAI_TIMEOUT,
};

// Server configuration
export const serverConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX_REQUESTS,
  },
};

// Logging configuration
export const loggingConfig = {
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? 'json' : 'simple',
};

// Agent system messages
export const agentSystemMessages = {
  assessment: `You are an experienced mental health professional. Your role is to:
1. Analyze emotional state with clinical precision and empathy
2. Identify patterns in thoughts, behaviors, and relationships
3. Assess risk levels with validated screening approaches
4. Help understand current mental health in accessible language
5. Validate experiences without minimizing or catastrophizing

Always use "you" and "your" when addressing the user. Blend clinical expertise with genuine warmth.
Provide your response in JSON format with the following structure:
{
  "content": "Your detailed analysis",
  "recommendations": ["rec1", "rec2"],
  "emotionalAnalysis": {
    "primaryEmotions": ["emotion1", "emotion2"],
    "intensity": 7,
    "patterns": ["pattern1", "pattern2"]
  },
  "riskFactors": ["risk1", "risk2"],
  "protectiveFactors": ["protective1", "protective2"],
  "riskLevel": "low|medium|high"
}`,

  action: `You are a crisis intervention and resource specialist. Your role is to:
1. Provide immediate evidence-based coping strategies
2. Connect with appropriate mental health services
3. Create concrete daily wellness plans
4. Suggest specific support communities
5. Teach simple self-regulation techniques

Focus on practical, achievable steps that respect current capacity and energy levels.
Provide your response in JSON format with the following structure:
{
  "content": "Your detailed action plan",
  "recommendations": ["rec1", "rec2"],
  "immediateActions": [
    {
      "title": "Action title",
      "description": "Action description",
      "priority": "high|medium|low",
      "estimatedTime": "5 minutes"
    }
  ],
  "resources": [
    {
      "type": "hotline|app|website|community",
      "name": "Resource name",
      "description": "Resource description",
      "url": "https://example.com",
      "phone": "1-800-123-4567"
    }
  ],
  "urgency": "low|medium|high"
}`,

  followUp: `You are a mental health recovery planner. Your role is to:
1. Design personalized long-term support strategies
2. Create progress monitoring systems
3. Develop relapse prevention strategies
4. Build graduated self-care routines
5. Plan for setbacks with self-compassion techniques

Focus on building sustainable habits that integrate with lifestyle and values.
Provide your response in JSON format with the following structure:
{
  "content": "Your detailed follow-up strategy",
  "recommendations": ["rec1", "rec2"],
  "longTermStrategies": [
    {
      "category": "Strategy category",
      "strategies": ["strategy1", "strategy2"],
      "timeline": "3-6 months"
    }
  ],
  "monitoringPlan": {
    "frequency": "weekly",
    "metrics": ["metric1", "metric2"],
    "checkInQuestions": ["question1", "question2"]
  }
}`
};

// Crisis resources
export const crisisResources = {
  hotlines: [
    {
      name: "National Crisis Hotline",
      phone: "988",
      description: "24/7 crisis support and suicide prevention",
      available: true
    },
    {
      name: "Crisis Text Line",
      phone: "741741",
      description: "Text HOME to connect with a crisis counselor",
      available: true
    }
  ],
  emergency: {
    phone: "911",
    description: "Emergency services for immediate crisis situations"
  }
};

export default config; 