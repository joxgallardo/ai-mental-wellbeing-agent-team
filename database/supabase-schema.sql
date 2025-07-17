-- =====================================================
-- Mental Health RAG Database Schema for Supabase
-- COMPLETE SCHEMA - Run this in Supabase SQL Editor
-- =====================================================

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

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
  urgency VARCHAR(20) DEFAULT 'medium',
  rag_enabled BOOLEAN DEFAULT false,
  rag_quality_score FLOAT,
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
  feedback_text TEXT,
  agent_versions JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT conversations_query_text_check CHECK (LENGTH(query_text) >= 5),
  CONSTRAINT conversations_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high', 'crisis')),
  CONSTRAINT conversations_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'crisis')),
  CONSTRAINT conversations_response_type_check CHECK (response_type IN ('standard', 'crisis', 'escalated', 'automated'))
);

-- =====================================================
-- KNOWLEDGE_SOURCES TABLE - Source metadata tracking
-- =====================================================
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  source_name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_url TEXT,
  source_description TEXT,
  author VARCHAR(255),
  license VARCHAR(100),
  last_crawled TIMESTAMP WITH TIME ZONE,
  document_count INTEGER DEFAULT 0,
  quality_score FLOAT DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT knowledge_sources_name_check CHECK (LENGTH(source_name) >= 3),
  CONSTRAINT knowledge_sources_type_check CHECK (source_type IN ('web', 'pdf', 'book', 'article', 'video', 'course', 'manual', 'api')),
  CONSTRAINT knowledge_sources_quality_check CHECK (quality_score >= 0 AND quality_score <= 1)
);

-- =====================================================
-- SCHEMA_VERSION TABLE - Migration tracking
-- =====================================================
CREATE TABLE schema_version (
  version VARCHAR(50) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Embeddings indexes for vector search
CREATE INDEX idx_embeddings_domain_model 
ON document_embeddings (domain_id, embedding_model, created_at DESC);

CREATE INDEX idx_embeddings_hash_dedup
ON document_embeddings (embedding_hash) WHERE embedding_hash IS NOT NULL;

-- Document full-text search indexes
CREATE INDEX idx_documents_content_gin 
ON documents USING gin(to_tsvector('english', content));

CREATE INDEX idx_documents_title_gin 
ON documents USING gin(to_tsvector('english', title));

CREATE INDEX idx_documents_tags_gin 
ON documents USING gin(tags);

-- Conversation analytics indexes
CREATE INDEX idx_conversations_risk_urgency 
ON conversations (domain_id, risk_level, urgency, created_at DESC);

CREATE INDEX idx_conversations_feedback 
ON conversations (domain_id, feedback_score, created_at DESC) 
WHERE feedback_score IS NOT NULL;

CREATE INDEX idx_conversations_rag_enabled 
ON conversations (domain_id, rag_enabled, created_at DESC);

-- Knowledge source indexes
CREATE INDEX idx_knowledge_sources_domain_type 
ON knowledge_sources (domain_id, source_type, is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow service_role full access)
CREATE POLICY "Service role can do anything" ON domains FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON document_embeddings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can do anything" ON knowledge_sources FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
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
-- VECTOR SEARCH FUNCTIONS
-- =====================================================

-- Semantic search function
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding VECTOR(384),
  similarity_threshold FLOAT DEFAULT 0.5,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  document_id UUID,
  chunk_content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.document_id,
    de.chunk_content,
    (de.embedding <=> query_embedding) AS similarity,
    de.metadata
  FROM document_embeddings de
  WHERE (de.embedding <=> query_embedding) < (1 - similarity_threshold)
  ORDER BY de.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Text search function
CREATE OR REPLACE FUNCTION text_search(
  query_text TEXT,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  document_id UUID,
  title TEXT,
  content TEXT,
  rank FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.content,
    ts_rank(to_tsvector('english', d.content), to_tsquery('english', query_text)) AS rank
  FROM documents d
  WHERE to_tsvector('english', d.content) @@ to_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ANALYTICS FUNCTIONS
-- =====================================================

-- Get domain statistics
CREATE OR REPLACE FUNCTION get_domain_stats(domain_uuid UUID)
RETURNS TABLE(
  documents_count BIGINT,
  embeddings_count BIGINT,
  conversations_count BIGINT,
  avg_feedback_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM documents WHERE domain_id = domain_uuid),
    (SELECT COUNT(*) FROM document_embeddings WHERE domain_id = domain_uuid),
    (SELECT COUNT(*) FROM conversations WHERE domain_id = domain_uuid),
    (SELECT AVG(feedback_score::FLOAT) FROM conversations WHERE domain_id = domain_uuid AND feedback_score IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert schema version
INSERT INTO schema_version (version, description) VALUES 
('1.0.0', 'Initial RAG Foundation schema with pgvector support')
ON CONFLICT (version) DO NOTHING;

-- Insert default domain
INSERT INTO domains (
  domain_name, 
  tenant_id, 
  display_name, 
  description, 
  config
) VALUES (
  'life_coaching',
  '00000000-0000-0000-0000-000000000000',
  'Life Coaching',
  'Personal development and life goal achievement coaching',
  '{
    "methodologies": ["GROW Model", "Values Clarification", "Life Wheel Assessment"],
    "knowledge_sources": ["methodologies", "best_practices", "resources", "templates"],
    "retrieval_preferences": {
      "methodology_weight": 0.4,
      "best_practices_weight": 0.3,
      "resources_weight": 0.2,
      "templates_weight": 0.1
    }
  }'::jsonb
) ON CONFLICT (domain_name) DO NOTHING;