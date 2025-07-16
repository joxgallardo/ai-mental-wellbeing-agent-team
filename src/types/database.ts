// =====================================================
// Database Types for Supabase + pgvector RAG System
// Auto-generated from schema.sql
// =====================================================

export interface Database {
  public: {
    Tables: {
      domains: {
        Row: {
          id: string;
          domain_name: string;
          tenant_id: string;
          display_name: string;
          description: string | null;
          config: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_name: string;
          tenant_id: string;
          display_name: string;
          description?: string | null;
          config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          domain_name?: string;
          tenant_id?: string;
          display_name?: string;
          description?: string | null;
          config?: Record<string, any>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          domain_id: string;
          title: string;
          content: string;
          content_type: string;
          source_url: string | null;
          author: string | null;
          category: string | null;
          subcategory: string | null;
          tags: string[] | null;
          language: string;
          word_count: number;
          is_active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          title: string;
          content: string;
          content_type?: string;
          source_url?: string | null;
          author?: string | null;
          category?: string | null;
          subcategory?: string | null;
          tags?: string[] | null;
          language?: string;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          title?: string;
          content?: string;
          content_type?: string;
          source_url?: string | null;
          author?: string | null;
          category?: string | null;
          subcategory?: string | null;
          tags?: string[] | null;
          language?: string;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      document_embeddings: {
        Row: {
          id: string;
          document_id: string;
          domain_id: string;
          chunk_index: number;
          chunk_content: string;
          chunk_word_count: number;
          embedding: number[];
          embedding_model: string;
          embedding_hash: string | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          domain_id: string;
          chunk_index?: number;
          chunk_content: string;
          embedding: number[];
          embedding_model?: string;
          embedding_hash?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          domain_id?: string;
          chunk_index?: number;
          chunk_content?: string;
          embedding?: number[];
          embedding_model?: string;
          embedding_hash?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          domain_id: string;
          user_id: string | null;
          session_id: string;
          query_text: string;
          query_intent: string | null;
          retrieved_chunks: Record<string, any> | null;
          response_text: string | null;
          response_type: string;
          sentiment_score: number | null;
          risk_level: string;
          urgency: string;
          feedback_score: number | null;
          feedback_text: string | null;
          processing_time_ms: number | null;
          rag_enabled: boolean;
          retrieval_count: number;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          user_id?: string | null;
          session_id: string;
          query_text: string;
          query_intent?: string | null;
          retrieved_chunks?: Record<string, any> | null;
          response_text?: string | null;
          response_type?: string;
          sentiment_score?: number | null;
          risk_level?: string;
          urgency?: string;
          feedback_score?: number | null;
          feedback_text?: string | null;
          processing_time_ms?: number | null;
          rag_enabled?: boolean;
          retrieval_count?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          user_id?: string | null;
          session_id?: string;
          query_text?: string;
          query_intent?: string | null;
          retrieved_chunks?: Record<string, any> | null;
          response_text?: string | null;
          response_type?: string;
          sentiment_score?: number | null;
          risk_level?: string;
          urgency?: string;
          feedback_score?: number | null;
          feedback_text?: string | null;
          processing_time_ms?: number | null;
          rag_enabled?: boolean;
          retrieval_count?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      knowledge_sources: {
        Row: {
          id: string;
          domain_id: string;
          source_name: string;
          source_type: string;
          source_url: string | null;
          author: string | null;
          publication_date: string | null;
          evidence_level: string;
          quality_score: number | null;
          document_count: number;
          total_word_count: number;
          is_active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          source_name: string;
          source_type: string;
          source_url?: string | null;
          author?: string | null;
          publication_date?: string | null;
          evidence_level?: string;
          quality_score?: number | null;
          document_count?: number;
          total_word_count?: number;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          source_name?: string;
          source_type?: string;
          source_url?: string | null;
          author?: string | null;
          publication_date?: string | null;
          evidence_level?: string;
          quality_score?: number | null;
          document_count?: number;
          total_word_count?: number;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      schema_version: {
        Row: {
          version: string;
          applied_at: string;
          description: string | null;
        };
        Insert: {
          version: string;
          applied_at?: string;
          description?: string | null;
        };
        Update: {
          version?: string;
          applied_at?: string;
          description?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      semantic_search: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          domain_filter?: string;
          category_filter?: string;
        };
        Returns: {
          id: string;
          document_id: string;
          chunk_content: string;
          similarity: number;
          metadata: Record<string, any>;
          document_title: string;
          document_category: string;
          document_author: string;
          chunk_index: number;
        }[];
      };
      text_search: {
        Args: {
          search_query: string;
          match_count?: number;
          domain_filter?: string;
          category_filter?: string;
        };
        Returns: {
          id: string;
          document_id: string;
          chunk_content: string;
          similarity: number;
          metadata: Record<string, any>;
          document_title: string;
          document_category: string;
          document_author: string;
          chunk_index: number;
        }[];
      };
      get_domain_stats: {
        Args: {
          domain_uuid: string;
        };
        Returns: {
          total_documents: number;
          total_embeddings: number;
          total_conversations: number;
          avg_processing_time: number;
          rag_usage_rate: number;
        }[];
      };
    };
    Enums: {
      risk_level_enum: 'low' | 'medium' | 'high' | 'crisis';
      urgency_enum: 'low' | 'medium' | 'high';
      response_type_enum: 'standard' | 'rag_enhanced' | 'crisis' | 'fallback';
      source_type_enum: 'methodology' | 'best_practices' | 'resources' | 'templates' | 'assessment' | 'intervention';
      evidence_level_enum: 'research-based' | 'expert-validated' | 'practical' | 'theoretical';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// =====================================================
// Type Aliases and Utility Types
// =====================================================

export type Domain = Database['public']['Tables']['domains']['Row'];
export type DomainInsert = Database['public']['Tables']['domains']['Insert'];
export type DomainUpdate = Database['public']['Tables']['domains']['Update'];

export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

export type DocumentEmbedding = Database['public']['Tables']['document_embeddings']['Row'];
export type DocumentEmbeddingInsert = Database['public']['Tables']['document_embeddings']['Insert'];
export type DocumentEmbeddingUpdate = Database['public']['Tables']['document_embeddings']['Update'];

export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];

export type KnowledgeSource = Database['public']['Tables']['knowledge_sources']['Row'];
export type KnowledgeSourceInsert = Database['public']['Tables']['knowledge_sources']['Insert'];
export type KnowledgeSourceUpdate = Database['public']['Tables']['knowledge_sources']['Update'];

// Function return types
export type SemanticSearchResult = Database['public']['Functions']['semantic_search']['Returns'][0];
export type TextSearchResult = Database['public']['Functions']['text_search']['Returns'][0];
export type DomainStats = Database['public']['Functions']['get_domain_stats']['Returns'][0];

// Enum types for better type safety
export type RiskLevel = Database['public']['Enums']['risk_level_enum'];
export type Urgency = Database['public']['Enums']['urgency_enum'];
export type ResponseType = Database['public']['Enums']['response_type_enum'];
export type SourceType = Database['public']['Enums']['source_type_enum'];
export type EvidenceLevel = Database['public']['Enums']['evidence_level_enum'];

// =====================================================
// RAG-Specific Types and Interfaces
// =====================================================

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
  document: {
    id: string;
    title: string;
    category: string | null;
    author: string | null;
  };
  chunk_index: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface DocumentChunk {
  content: string;
  index: number;
  metadata: Record<string, any>;
}

export interface RAGContext {
  domainId: string;
  sessionId: string;
  userPreferences?: {
    methodology?: string;
    lifeArea?: string;
    complexityLevel?: 'beginner' | 'intermediate' | 'advanced';
    evidenceLevel?: EvidenceLevel;
  };
  searchHistory?: string[];
  riskLevel?: RiskLevel;
  urgency?: Urgency;
}

export interface RAGEnhancedResponse {
  content: string;
  sources: SearchResult[];
  confidence: number;
  processingTime: number;
  ragEnabled: boolean;
  retrievalCount: number;
  fallbackUsed: boolean;
}

export interface DomainConfig {
  name: string;
  display_name: string;
  description: string;
  knowledge_sources: string[];
  methodologies: string[];
  assessment_frameworks?: Array<{
    name: string;
    description: string;
    scoring?: string;
    dimensions?: string[];
    method?: string;
    top_values_count?: number;
    categories?: string[];
    model?: string;
    stages?: string[];
  }>;
  retrieval_preferences: Record<string, number>;
  metadata_schema: Record<string, {
    type: string;
    required?: boolean;
    description?: string;
    values?: string[];
    default?: string;
  }>;
  query_enhancement: {
    keywords: Record<string, string[]>;
    context_mapping: Record<string, string>;
  };
  filtering_rules: {
    minimum_relevance_score: number;
    boost_factors: Record<string, number>;
    penalty_factors?: Record<string, number>;
  };
  personalization: {
    methodology_preference_weight: number;
    complexity_preference_weight: number;
    goal_alignment_weight: number;
    historical_preference_weight: number;
    experience_level_weight: number;
    learning_factors: {
      session_rating_influence: number;
      content_engagement_influence: number;
      goal_achievement_influence: number;
    };
  };
  resource_categories: Record<string, {
    description: string;
    examples?: string[];
    types?: string[];
    categories?: string[];
  }>;
  escalation_triggers: string[];
  integrations: Record<string, string[]>;
  validation: {
    required_methodologies: number;
    required_resources: number;
    content_quality_threshold: number;
    evidence_level_distribution: Record<string, number>;
  };
}

// =====================================================
// Error Types
// =====================================================

export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

export class EmbeddingError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'EMBEDDING_ERROR', details);
  }
}

export class SearchError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'SEARCH_ERROR', details);
  }
}

export class DomainConfigError extends RAGError {
  constructor(message: string, details?: any) {
    super(message, 'DOMAIN_CONFIG_ERROR', details);
  }
}

// =====================================================
// Configuration Interfaces
// =====================================================

export interface RAGConfiguration {
  enabled: boolean;
  hybridSearchEnabled: boolean;
  embeddingModel: string;
  maxResults: number;
  minRelevanceScore: number;
  collectionPrefix: string;
  cacheTTL?: number;
  retryAttempts?: number;
  timeoutMs?: number;
}

export interface SupabaseConfiguration {
  url?: string;
  anonKey?: string;
  serviceKey?: string;
  schema?: string;
  retryAttempts?: number;
  timeoutMs?: number;
}

export interface PerformanceMetrics {
  searchLatency: number;
  embeddingLatency: number;
  cacheHitRate: number;
  errorRate: number;
  queryVolume: number;
  averageRelevanceScore: number;
  userSatisfactionScore?: number;
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}