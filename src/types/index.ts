import { z } from 'zod';

// User input schema
export const UserInputSchema = z.object({
  mentalState: z.string().min(1, "Mental state is required"),
  sleepPattern: z.number().min(0).max(12),
  stressLevel: z.number().min(1).max(10),
  supportSystem: z.array(z.string()),
  recentChanges: z.string().optional(),
  currentSymptoms: z.array(z.string())
});

export type UserInput = z.infer<typeof UserInputSchema>;

// Agent types
export interface Agent {
  name: string;
  role: string;
  systemMessage: string;
  process(input: UserInput, context?: AgentContext): Promise<AgentResponse>;
}

export interface AgentContext {
  previousResponses?: AgentResponse[];
  userInput: UserInput;
  sessionId: string;
}

export interface AgentResponse {
  agentName: string;
  content: string;
  recommendations: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  urgency?: 'low' | 'medium' | 'high';
  timestamp: Date;
}

// Assessment specific types
export interface AssessmentResponse extends AgentResponse {
  emotionalAnalysis: {
    primaryEmotions: string[];
    intensity: number;
    patterns: string[];
  };
  riskFactors: string[];
  protectiveFactors: string[];
}

// Action plan specific types
export interface ActionResponse extends AgentResponse {
  immediateActions: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimatedTime: string;
  }[];
  resources: {
    type: 'hotline' | 'app' | 'website' | 'community';
    name: string;
    description: string;
    url?: string;
    phone?: string;
  }[];
}

// Follow-up specific types
export interface FollowUpResponse extends AgentResponse {
  longTermStrategies: {
    category: string;
    strategies: string[];
    timeline: string;
  }[];
  monitoringPlan: {
    frequency: string;
    metrics: string[];
    checkInQuestions: string[];
  };
}

// System configuration
export interface SystemConfig {
  openaiApiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

// Session management
export interface Session {
  id: string;
  userId?: string;
  userInput: UserInput;
  responses: AgentResponse[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived';
}

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public agentName: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: Date;
}

export interface MentalHealthPlan {
  sessionId: string;
  assessment: AssessmentResponse;
  actionPlan: ActionResponse;
  followUp: FollowUpResponse;
  summary: {
    keyInsights: string[];
    immediateNextSteps: string[];
    longTermGoals: string[];
  };
}

// Logging types
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  agentName?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
} 