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
  userInput?: UserInput;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
  ragContext?: {
    domain: string;
    relevantDocuments: any[];
    searchQuery: string;
    domainId?: string;
    sessionHistory?: any[];
    assessmentInsights?: any;
    recoveryStage?: string;
  };
}

export interface AgentResponse {
  agentName: string;
  content: string;
  recommendations: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  urgency?: 'low' | 'medium' | 'high';
  timestamp: Date;
  ragMetadata?: {
    useRag: boolean;
    queryEnhanced?: boolean;
    knowledgeUsed?: boolean;
    domainSpecific?: boolean;
    contextualFactors?: string[];
    qualityScore?: number;
    sources?: any[];
    fallbackReason?: string;
    searchResults?: any[];
    retrievalTime?: number;
    agentVersions?: Record<string, string>;
    ragQuality?: {
      relevance: number;
      completeness: number;
      accuracy: number;
      threshold: number;
    };
    threshold?: number;
  };
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

// Error types
export class AgentError extends Error {
  public source: string | undefined;
  public code: string | undefined;
  public details?: unknown;

  constructor(
    message: string,
    source?: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AgentError';
    this.source = source;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
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
  metadata?: {
    complexity: string;
    domain: string;
    confidence: number;
    ragEnabled?: boolean;
    agentVersions?: Record<string, string>;
    ragQuality?: {
      relevance: number;
      completeness: number;
      accuracy: number;
      threshold: number;
    };
  };
} 