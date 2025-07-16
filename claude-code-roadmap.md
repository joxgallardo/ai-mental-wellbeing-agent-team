# Claude Code: Roadmap de Implementación RAG + LangGraph

## 🎯 CONTEXTO DEL PROYECTO

**Proyecto:** AI Mental Wellbeing Agent Team - RAG + LangGraph Migration
**Objetivo:** Implementar especificación existente en `docs/dev/template-architecture.md`
**Stack:** TypeScript + Express + Supabase+pgvector + LangGraph
**Timeline:** 6-8 días, deployment lo más rápido posible

## 📋 ESTADO ACTUAL

### ✅ Ya Implementado:
- Express API funcionando en `src/index.ts`
- 3 agentes especializados en `src/agents/`
- Configuración whitelabel en `config/domains/life_coaching/`
- Especificación RAG completa en `docs/dev/template-architecture.md`

### 🎯 Por Implementar:
- RAG foundation con Supabase+pgvector
- Domain adapters system
- LangGraph workflow orchestration
- Knowledge population system

## 🚀 FASE 1: RAG Foundation (Días 1-2)

### Task 1.1: Dependencies Setup
```bash
npm install @supabase/supabase-js @xenova/transformers js-yaml uuid @types/js-yaml @types/uuid
```

### Task 1.2: Supabase Schema Setup
```sql
-- Ejecutar en Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla para documentos con embeddings
CREATE TABLE knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Para sentence-transformers
  metadata JSONB NOT NULL,
  domain VARCHAR(50) NOT NULL,
  knowledge_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda vectorial
CREATE INDEX knowledge_embedding_idx ON knowledge_documents 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Función de búsqueda
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_domain text DEFAULT null,
  filter_knowledge_type text DEFAULT null
) RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    knowledge_documents.id,
    knowledge_documents.content,
    knowledge_documents.metadata,
    1 - (knowledge_documents.embedding <=> query_embedding) as similarity
  FROM knowledge_documents
  WHERE 
    (filter_domain IS NULL OR domain = filter_domain) AND
    (filter_knowledge_type IS NULL OR knowledge_type = filter_knowledge_type) AND
    1 - (knowledge_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Task 1.3: RAG Foundation Implementation
**File: `src/rag/foundation/RAGFoundation.ts`**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

export class RAGFoundation {
  private supabase: SupabaseClient;
  private embedder: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeEmbedder();
  }

  private async initializeEmbedder() {
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async addDocument(document: KnowledgeDocument): Promise<string> {
    const embedding = await this.generateEmbedding(document.content);
    
    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .insert({
        content: document.content,
        embedding: embedding,
        metadata: document.metadata,
        domain: document.domain,
        knowledge_type: document.knowledge_type
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async semanticSearch(
    query: string,
    domain?: string,
    knowledgeType?: string,
    maxResults: number = 5,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: maxResults,
      filter_domain: domain,
      filter_knowledge_type: knowledgeType
    });

    if (error) throw error;
    return data;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}
```

### Task 1.4: Domain Adapter Implementation
**File: `src/rag/adapters/LifeCoachingAdapter.ts`**
```typescript
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export class LifeCoachingAdapter {
  private config: DomainConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const configPath = path.join(process.cwd(), 'config/domains/life_coaching/domain_config.yml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    this.config = yaml.load(configFile) as DomainConfig;
  }

  enhanceQuery(query: string, context?: any): string {
    // Agregar contexto de life coaching
    const enhancedQuery = `${query} [Life coaching context: personal development, goal setting, values clarification]`;
    return enhancedQuery;
  }

  filterResults(results: SearchResult[], context?: any): SearchResult[] {
    // Aplicar pesos de retrieval_preferences del config
    return results.map(result => ({
      ...result,
      adjustedScore: this.calculateAdjustedScore(result)
    })).sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  private calculateAdjustedScore(result: SearchResult): number {
    const preferences = this.config.retrieval_preferences;
    const metadata = result.metadata;
    
    let boost = 1.0;
    if (metadata.knowledge_type === 'methodology') boost *= preferences.methodology_weight;
    if (metadata.knowledge_type === 'best_practices') boost *= preferences.best_practices_weight;
    // ... otros boosts
    
    return result.similarity * boost;
  }
}
```

## 🚀 FASE 2: Agent Integration (Días 2-3)

### Task 2.1: RAG-Enhanced Agent
**File: `src/agents/RAGEnhancedAgent.ts`**
```typescript
import { BaseAgent } from './base-agent';
import { RAGFoundation } from '../rag/foundation/RAGFoundation';
import { LifeCoachingAdapter } from '../rag/adapters/LifeCoachingAdapter';

export class RAGEnhancedAgent extends BaseAgent {
  constructor(
    name: string,
    role: string,
    systemMessage: string,
    private ragFoundation: RAGFoundation,
    private domainAdapter: LifeCoachingAdapter
  ) {
    super(name, role, systemMessage);
  }

  protected async generateAIResponse(
    userInput: UserInput,
    context?: AgentContext
  ): Promise<string> {
    // 1. Buscar conocimiento relevante
    const query = this.domainAdapter.enhanceQuery(
      this.extractQueryFromInput(userInput)
    );
    
    const ragResults = await this.ragFoundation.semanticSearch(
      query,
      'life_coaching',
      undefined,
      3,
      0.7
    );

    // 2. Filtrar y ajustar resultados
    const filteredResults = this.domainAdapter.filterResults(ragResults);

    // 3. Crear prompt enriquecido
    const enhancedSystemMessage = this.buildEnhancedPrompt(
      this.systemMessage,
      filteredResults
    );

    // 4. Generar respuesta con contexto RAG
    const userMessage = this.formatUserMessage(userInput, context);
    
    return await openAIService.generateResponse(
      enhancedSystemMessage,
      userMessage,
      context ? this.formatContext(context) : undefined
    );
  }

  private buildEnhancedPrompt(basePrompt: string, ragResults: SearchResult[]): string {
    const knowledgeContext = ragResults.map(result => 
      `**${result.metadata.methodology || result.metadata.knowledge_type}**: ${result.content}`
    ).join('\n\n');

    return `${basePrompt}

**RELEVANT DOMAIN KNOWLEDGE:**
${knowledgeContext}

Use this domain-specific knowledge to enhance your response with evidence-based practices and methodologies.`;
  }
}
```

### Task 2.2: Feature Flag System
**File: `src/config/features.ts`**
```typescript
export const features = {
  useRAG: process.env.ENABLE_RAG === 'true',
  ragDomains: process.env.RAG_DOMAINS?.split(',') || ['life_coaching'],
  ragFallback: process.env.RAG_FALLBACK !== 'false', // Default true for safety
  ragThreshold: parseFloat(process.env.RAG_THRESHOLD || '0.7'),
  maxRAGResults: parseInt(process.env.MAX_RAG_RESULTS || '3')
};
```

## 🚀 FASE 3: LangGraph Integration (Días 4-5)

### Task 3.1: LangGraph Dependencies
```bash
npm install @langchain/core @langchain/community langgraph
```

### Task 3.2: Workflow Implementation
**File: `src/workflows/MentalHealthWorkflow.ts`**
```typescript
import { StateGraph } from '@langchain/langgraph';

interface WorkflowState {
  userInput: UserInput;
  domain: string;
  ragContext: any[];
  assessmentResult?: AssessmentResponse;
  actionResult?: ActionResponse;
  followUpResult?: FollowUpResponse;
  finalPlan?: MentalHealthPlan;
}

export class MentalHealthWorkflow {
  private workflow: StateGraph<WorkflowState>;

  constructor(
    private ragFoundation: RAGFoundation,
    private domainAdapter: LifeCoachingAdapter
  ) {
    this.buildWorkflow();
  }

  private buildWorkflow() {
    this.workflow = new StateGraph<WorkflowState>()
      .addNode('domain_detection', this.detectDomain.bind(this))
      .addNode('rag_context', this.buildRAGContext.bind(this))
      .addNode('assessment', this.runAssessment.bind(this))
      .addNode('action_planning', this.runActionPlanning.bind(this))
      .addNode('follow_up', this.runFollowUp.bind(this))
      .addNode('synthesis', this.synthesizeResponse.bind(this))
      .addEdge('domain_detection', 'rag_context')
      .addEdge('rag_context', 'assessment')
      .addEdge('assessment', 'action_planning')
      .addEdge('action_planning', 'follow_up')
      .addEdge('follow_up', 'synthesis');
  }

  async execute(userInput: UserInput): Promise<MentalHealthPlan> {
    const initialState: WorkflowState = {
      userInput,
      domain: 'life_coaching',
      ragContext: []
    };

    const result = await this.workflow.invoke(initialState);
    return result.finalPlan!;
  }

  private async detectDomain(state: WorkflowState): Promise<WorkflowState> {
    // Domain detection logic
    return { ...state, domain: 'life_coaching' };
  }

  private async buildRAGContext(state: WorkflowState): Promise<WorkflowState> {
    const query = this.domainAdapter.enhanceQuery(
      `${state.userInput.mentalState} ${state.userInput.currentSymptoms.join(' ')}`
    );

    const ragResults = await this.ragFoundation.semanticSearch(
      query,
      state.domain,
      undefined,
      5,
      0.7
    );

    return { ...state, ragContext: ragResults };
  }

  // ... otros nodos del workflow
}
```

## 🚀 FASE 4: Knowledge Population (Días 5-6)

### Task 4.1: Knowledge Populator
**File: `src/rag/knowledge/KnowledgePopulator.ts`**
```typescript
export class KnowledgePopulator {
  constructor(private ragFoundation: RAGFoundation) {}

  async populateLifeCoachingKnowledge(): Promise<void> {
    const methodologies = [
      {
        content: "The GROW Model is a structured conversation flow: Goal - Reality - Options - Will. It helps clients move from where they are to where they want to be through guided self-discovery.",
        metadata: {
          methodology: "GROW Model",
          complexity_level: "beginner",
          evidence_level: "expert-validated",
          target_audience: "both"
        },
        domain: "life_coaching",
        knowledge_type: "methodology"
      },
      // ... más knowledge documents
    ];

    for (const doc of methodologies) {
      await this.ragFoundation.addDocument(doc);
    }
  }
}
```

## 🚀 DEPLOYMENT COMMANDS

### Environment Setup:
```bash
# .env file
ENABLE_RAG=true
RAG_DOMAINS=life_coaching
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
RAG_THRESHOLD=0.7
MAX_RAG_RESULTS=3
```

### Build & Deploy:
```bash
npm run build
npm run populate-knowledge  # Poblar knowledge base
npm start
```

### Testing:
```bash
# Test RAG endpoint
curl -X POST http://localhost:3000/api/mental-health-plan \
  -H "Content-Type: application/json" \
  -d '{
    "mentalState": "I feel overwhelmed with my career goals",
    "sleepPattern": 6,
    "stressLevel": 8,
    "supportSystem": ["family"],
    "currentSymptoms": ["anxiety", "indecision"],
    "domain": "life_coaching"
  }'
```

## 🎯 SUCCESS METRICS

### Phase 1 Complete:
- [ ] Supabase knowledge_documents table created
- [ ] RAG Foundation can add/search documents
- [ ] Domain adapter loads YAML config
- [ ] Basic semantic search working

### Phase 2 Complete:
- [ ] RAGEnhancedAgent provides better responses than BaseAgent
- [ ] Feature flags allow gradual rollout
- [ ] API maintains full compatibility
- [ ] Response times < 2s maintained

### Phase 3 Complete:
- [ ] LangGraph workflow executes end-to-end
- [ ] Workflow state management working
- [ ] RAG context enhances all agent responses
- [ ] Performance monitoring active

### Phase 4 Complete:
- [ ] Knowledge base populated with life_coaching content
- [ ] Quality responses for life coaching queries
- [ ] Template ready for new domain addition
- [ ] Production deployment successful

## 🚨 CRITICAL PATH

1. **Day 1**: Supabase setup + RAG Foundation
2. **Day 2**: Domain adapter + Agent integration
3. **Day 3**: Feature flags + Testing
4. **Day 4**: LangGraph workflow
5. **Day 5**: Knowledge population
6. **Day 6**: Production deployment

**BLOCKER RESOLUTION**: If any phase takes longer, prioritize RAG Foundation + Agent Integration for MVP.