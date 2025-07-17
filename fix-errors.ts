// Script to fix TypeScript errors systematically
// This will be used to apply fixes across multiple files

// 1. Fix all error.message usage with proper error handling
const fixErrorHandling = `
// Helper function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
`;

// 2. Fix Zod default values (convert numbers/booleans to strings)
const fixZodDefaults = `
// All numeric defaults should be strings
PORT: z.string().transform(Number).default('3000'),
DATABASE_POOL_SIZE: z.string().transform(Number).default('20'),
DATABASE_SSL: z.enum(['true', 'false']).transform(Boolean).default('true'),
OPENAI_MAX_TOKENS: z.string().transform(Number).default('2000'),
OPENAI_TEMPERATURE: z.string().transform(Number).default('0.7'),
RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
RAG_ENABLED: z.enum(['true', 'false']).transform(Boolean).default('true'),
RAG_CHUNK_SIZE: z.string().transform(Number).default('1000'),
RAG_CHUNK_OVERLAP: z.string().transform(Number).default('200'),
RAG_SIMILARITY_THRESHOLD: z.string().transform(Number).default('0.7'),
RAG_MAX_RESULTS: z.string().transform(Number).default('5'),
LANGGRAPH_ENABLED: z.enum(['true', 'false']).transform(Boolean).default('true'),
LANGGRAPH_MAX_RETRIES: z.string().transform(Number).default('3'),
LANGGRAPH_TIMEOUT_MS: z.string().transform(Number).default('30000'),
FEATURE_FLAG_REFRESH_INTERVAL_MS: z.string().transform(Number).default('60000'),
MONITORING_ENABLED: z.enum(['true', 'false']).transform(Boolean).default('true'),
METRICS_PORT: z.string().transform(Number).default('9090'),
HEALTH_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),
LOG_FILE_ENABLED: z.enum(['true', 'false']).transform(Boolean).default('true'),
CACHE_TTL_SECONDS: z.string().transform(Number).default('3600'),
ERROR_REPORTING_ENABLED: z.enum(['true', 'false']).transform(Boolean).default('true'),
MAX_CONCURRENT_REQUESTS: z.string().transform(Number).default('100'),
REQUEST_TIMEOUT_MS: z.string().transform(Number).default('30000'),
MEMORY_LIMIT_MB: z.string().transform(Number).default('512'),
`;

// 3. Fix import issues
const fixImports = `
// Fix import paths and missing exports
import { KnowledgeDocument } from '../../services/rag/knowledge-population.service';
import { agentCoordinator } from './agent-coordinator.service';
`;

// 4. Fix type issues
const fixTypes = `
// Add missing properties to interfaces
interface AgentContext {
  ragContext?: {
    domain: string;
    relevantDocuments: any[];
    searchQuery: string;
  };
  // ... other properties
}

interface MentalHealthPlan {
  metadata?: {
    complexity: string;
    domain: string;
    confidence: number;
  };
  // ... other properties
}
`;

export { fixErrorHandling, fixZodDefaults, fixImports, fixTypes }; 