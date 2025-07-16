-- =====================================================
-- Mental Health RAG Database Schema for Supabase
-- Generated: 2025-07-15
-- PostgreSQL + pgvector extension
-- =====================================================

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- DOMAINS TABLE - Multi-tenant domain management
-- =====================================================
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT domains_domain_name_check CHECK (domain_name ~ '^[a-z0-9_]+$'),
  CONSTRAINT domains_display_name_check CHECK (LENGTH(display_name) >= 3)
);

-- =====================================================
-- DOCUMENTS TABLE - Knowledge base documents
-- =====================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text/plain',
  source_url TEXT,
  author VARCHAR(255),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  tags TEXT[],
  language VARCHAR(10) DEFAULT 'en',
  word_count INTEGER GENERATED ALWAYS AS (
    array_length(string_to_array(trim(content), ' '), 1)
  ) STORED,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT documents_title_check CHECK (LENGTH(title) >= 5),
  CONSTRAINT documents_content_check CHECK (LENGTH(content) >= 50),
  CONSTRAINT documents_category_check CHECK (category IS NULL OR LENGTH(category) >= 3),
  CONSTRAINT documents_language_check CHECK (language ~ '^[a-z]{2}$')
);

-- =====================================================
-- DOCUMENT_EMBEDDINGS TABLE - Vector embeddings storage
-- =====================================================
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  chunk_content TEXT NOT NULL,
  chunk_word_count INTEGER GENERATED ALWAYS AS (
    array_length(string_to_array(trim(chunk_content), ' '), 1)
  ) STORED,
  embedding VECTOR(384), -- all-MiniLM-L6-v2 dimensions
  embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
  embedding_hash VARCHAR(64), -- For deduplication
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT embeddings_chunk_content_check CHECK (LENGTH(chunk_content) >= 10),
  CONSTRAINT embeddings_chunk_index_check CHECK (chunk_index >= 0),
  CONSTRAINT embeddings_model_check CHECK (LENGTH(embedding_model) >= 5)
);

-- =====================================================
-- CONVERSATIONS TABLE - User interactions and analytics
-- =====================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  user_id UUID,
  session_id VARCHAR(255) NOT NULL,
  query_text TEXT NOT NULL,
  query_intent VARCHAR(100),
  retrieved_chunks JSONB,
  response_text TEXT,
  response_type VARCHAR(50) DEFAULT 'standard',
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  risk_level VARCHAR(20) DEFAULT 'low',
  urgency VARCHAR(20) DEFAULT 'low',
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
  feedback_text TEXT,
  processing_time_ms INTEGER,
  rag_enabled BOOLEAN DEFAULT false,
  retrieval_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT conversations_query_text_check CHECK (LENGTH(query_text) >= 3),
  CONSTRAINT conversations_risk_level_check CHECK (
    risk_level IN ('low', 'medium', 'high', 'crisis')
  ),
  CONSTRAINT conversations_urgency_check CHECK (
    urgency IN ('low', 'medium', 'high')
  ),
  CONSTRAINT conversations_response_type_check CHECK (
    response_type IN ('standard', 'rag_enhanced', 'crisis', 'fallback')
  )
);

-- =====================================================
-- KNOWLEDGE_SOURCES TABLE - Track knowledge source metadata
-- =====================================================
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  source_name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'methodology', 'best_practices', 'resources', 'templates'
  source_url TEXT,
  author VARCHAR(255),
  publication_date DATE,
  evidence_level VARCHAR(50) DEFAULT 'practical', -- 'research-based', 'expert-validated', 'practical', 'theoretical'
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
  document_count INTEGER DEFAULT 0,
  total_word_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT knowledge_sources_name_check CHECK (LENGTH(source_name) >= 3),
  CONSTRAINT knowledge_sources_type_check CHECK (
    source_type IN ('methodology', 'best_practices', 'resources', 'templates', 'assessment', 'intervention')
  ),
  CONSTRAINT knowledge_sources_evidence_check CHECK (
    evidence_level IN ('research-based', 'expert-validated', 'practical', 'theoretical')
  )
);

-- =====================================================
-- PERFORMANCE INDEXES - Optimized for RAG operations
-- =====================================================

-- Vector similarity search indexes (HNSW for best performance)
CREATE INDEX idx_document_embeddings_vector_hnsw 
ON document_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative IVFFlat index for smaller datasets
-- CREATE INDEX idx_document_embeddings_vector_ivfflat 
-- ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Multi-column indexes for filtered queries
CREATE INDEX idx_embeddings_domain_category 
ON document_embeddings (domain_id, (metadata->>'category'));

CREATE INDEX idx_embeddings_domain_model 
ON document_embeddings (domain_id, embedding_model, created_at DESC);

CREATE INDEX idx_embeddings_hash_dedup
ON document_embeddings (embedding_hash) WHERE embedding_hash IS NOT NULL;

-- Document search and filtering
CREATE INDEX idx_documents_domain_active 
ON documents (domain_id, is_active, category, created_at DESC);

CREATE INDEX idx_documents_content_gin 
ON documents USING gin(to_tsvector('english', content));

CREATE INDEX idx_documents_title_gin 
ON documents USING gin(to_tsvector('english', title));

CREATE INDEX idx_documents_tags_gin 
ON documents USING gin(tags);

-- Conversation analytics indexes
CREATE INDEX idx_conversations_domain_session 
ON conversations (domain_id, session_id, created_at DESC);

CREATE INDEX idx_conversations_risk_urgency 
ON conversations (domain_id, risk_level, urgency, created_at DESC);

CREATE INDEX idx_conversations_feedback 
ON conversations (domain_id, feedback_score, created_at DESC) 
WHERE feedback_score IS NOT NULL;

CREATE INDEX idx_conversations_rag_enabled 
ON conversations (domain_id, rag_enabled, created_at DESC);

-- Domain and knowledge source indexes
CREATE INDEX idx_domains_active 
ON domains (is_active, domain_name);

CREATE INDEX idx_knowledge_sources_domain_type 
ON knowledge_sources (domain_id, source_type, is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Multi-tenant data isolation
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Domain-based access policies
CREATE POLICY "Domain isolation for domains" ON domains
FOR ALL USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::UUID 
  OR auth.jwt() ->> 'role' = 'service_role'
);

CREATE POLICY "Domain isolation for documents" ON documents
FOR ALL USING (
  domain_id IN (
    SELECT id FROM domains WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  ) OR auth.jwt() ->> 'role' = 'service_role'
);

CREATE POLICY "Domain isolation for embeddings" ON document_embeddings
FOR ALL USING (
  domain_id IN (
    SELECT id FROM domains WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  ) OR auth.jwt() ->> 'role' = 'service_role'
);

CREATE POLICY "Domain isolation for conversations" ON conversations
FOR ALL USING (
  domain_id IN (
    SELECT id FROM domains WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  ) OR auth.jwt() ->> 'role' = 'service_role'
);

CREATE POLICY "Domain isolation for knowledge sources" ON knowledge_sources
FOR ALL USING (
  domain_id IN (
    SELECT id FROM domains WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  ) OR auth.jwt() ->> 'role' = 'service_role'
);

-- =====================================================
-- UTILITY FUNCTIONS - RAG operations and search
-- =====================================================

-- Semantic search function with hybrid capabilities
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5,
  domain_filter uuid DEFAULT NULL,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_content text,
  similarity float,
  metadata jsonb,
  document_title text,
  document_category text,
  document_author text,
  chunk_index integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_content,
    1 - (de.embedding <=> query_embedding) as similarity,
    de.metadata,
    d.title as document_title,
    d.category as document_category,
    d.author as document_author,
    de.chunk_index
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE d.is_active = true
    AND (domain_filter IS NULL OR de.domain_id = domain_filter)
    AND (category_filter IS NULL OR d.category = category_filter)
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Text search function for hybrid search
CREATE OR REPLACE FUNCTION text_search(
  search_query text,
  match_count int DEFAULT 5,
  domain_filter uuid DEFAULT NULL,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_content text,
  similarity float,
  metadata jsonb,
  document_title text,
  document_category text,
  document_author text,
  chunk_index integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_content,
    ts_rank(to_tsvector('english', de.chunk_content), plainto_tsquery('english', search_query)) as similarity,
    de.metadata,
    d.title as document_title,
    d.category as document_category,
    d.author as document_author,
    de.chunk_index
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE d.is_active = true
    AND (domain_filter IS NULL OR de.domain_id = domain_filter)
    AND (category_filter IS NULL OR d.category = category_filter)
    AND to_tsvector('english', de.chunk_content) @@ plainto_tsquery('english', search_query)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Get domain statistics
CREATE OR REPLACE FUNCTION get_domain_stats(domain_uuid uuid)
RETURNS TABLE (
  total_documents bigint,
  total_embeddings bigint,
  total_conversations bigint,
  avg_processing_time float,
  rag_usage_rate float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM documents WHERE domain_id = domain_uuid AND is_active = true),
    (SELECT COUNT(*) FROM document_embeddings WHERE domain_id = domain_uuid),
    (SELECT COUNT(*) FROM conversations WHERE domain_id = domain_uuid),
    (SELECT AVG(processing_time_ms) FROM conversations WHERE domain_id = domain_uuid AND processing_time_ms IS NOT NULL),
    (SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0.0
        ELSE COUNT(*) FILTER (WHERE rag_enabled = true)::float / COUNT(*)::float
      END
     FROM conversations WHERE domain_id = domain_uuid
    );
END;
$$;

-- Update document statistics trigger
CREATE OR REPLACE FUNCTION update_document_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_sources 
    SET document_count = document_count + 1,
        total_word_count = total_word_count + NEW.word_count,
        updated_at = NOW()
    WHERE domain_id = NEW.domain_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_sources 
    SET document_count = document_count - 1,
        total_word_count = total_word_count - OLD.word_count,
        updated_at = NOW()
    WHERE domain_id = OLD.domain_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document statistics
CREATE TRIGGER update_document_stats_trigger
  AFTER INSERT OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_document_stats();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers for tables with updated_at
CREATE TRIGGER update_domains_updated_at 
  BEFORE UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_sources_updated_at 
  BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA - Default domain setup
-- =====================================================

-- Insert default life_coaching domain
INSERT INTO domains (domain_name, tenant_id, display_name, description, config) VALUES (
  'life_coaching',
  uuid_generate_v4(),
  'Life Coaching',
  'Personal development and life goal achievement coaching',
  '{
    "methodologies": ["GROW Model", "Values Clarification", "Life Wheel Assessment", "Solution-Focused Coaching"],
    "knowledge_sources": ["methodologies", "best_practices", "resources", "templates"],
    "retrieval_preferences": {
      "methodology_weight": 0.4,
      "best_practices_weight": 0.3,
      "resources_weight": 0.2,
      "templates_weight": 0.1
    },
    "features": {
      "rag_enhancement": false,
      "hybrid_search": false,
      "advanced_personalization": false
    }
  }'
) ON CONFLICT (domain_name) DO NOTHING;

-- Insert sample knowledge source
INSERT INTO knowledge_sources (
  domain_id,
  source_name,
  source_type,
  evidence_level,
  quality_score
) 
SELECT 
  d.id,
  'GROW Model Framework',
  'methodology',
  'expert-validated',
  0.9
FROM domains d 
WHERE d.domain_name = 'life_coaching'
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE domains IS 'Multi-tenant domain management for whitelabel deployments';
COMMENT ON TABLE documents IS 'Knowledge base documents with full-text search capabilities';
COMMENT ON TABLE document_embeddings IS 'Vector embeddings for semantic search with 384-dimensional vectors';
COMMENT ON TABLE conversations IS 'User interaction logs with RAG enhancement tracking';
COMMENT ON TABLE knowledge_sources IS 'Metadata tracking for knowledge sources and quality metrics';

COMMENT ON COLUMN document_embeddings.embedding IS 'Vector embedding using all-MiniLM-L6-v2 model (384 dimensions)';
COMMENT ON COLUMN conversations.sentiment_score IS 'Sentiment analysis score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN conversations.risk_level IS 'Mental health risk assessment: low, medium, high, crisis';

-- Schema version for migration tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_version (version, description) VALUES 
('1.0.0', 'Initial RAG Foundation schema with pgvector support')
ON CONFLICT (version) DO NOTHING;