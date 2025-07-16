# Claude Code Instructions

## PROJECT CONTEXT
- **Goal**: Implement RAG + LangGraph system following existing specification in `docs/dev/template-architecture.md`
- **Current State**: Working Express API with 3 agents, needs RAG enhancement
- **Stack Decision**: Supabase+pgvector instead of ChromaDB for simplicity
- **Timeline**: 6 days maximum for MVP deployment

## PHASE 1: RAG Foundation Setup (Priority 1)

### Step 1: Install Dependencies
```bash
npm install @supabase/supabase-js @xenova/transformers js-yaml uuid @types/js-yaml @types/uuid
```

### Step 2: Create Supabase Schema
Create the SQL schema in Supabase dashboard (copy from Claude Code Roadmap artifact above)

### Step 3: Implement RAG Foundation
Create `src/rag/foundation/RAGFoundation.ts` (copy implementation from Claude Code Roadmap)

### Step 4: Implement Domain Adapter  
Create `src/rag/adapters/LifeCoachingAdapter.ts` (copy implementation from Claude Code Roadmap)

### Step 5: Test RAG Foundation
```bash
npm run test -- --testNamePattern="RAG Foundation"
```

## PHASE 2: Agent Integration (Priority 2)

### Step 1: Create RAG-Enhanced Agent
Create `src/agents/RAGEnhancedAgent.ts` (copy implementation from Claude Code Roadmap)

### Step 2: Add Feature Flags
Create `src/config/features.ts` (copy implementation from Claude Code Roadmap)

### Step 3: Update Agent Coordinator
Modify `src/services/agent-coordinator.service.ts` to use RAGEnhancedAgent when feature flag enabled

### Step 4: Test Integration
```bash
npm run test -- --testNamePattern="Agent Integration"
```

## IMMEDIATE DEPLOYMENT (MVP)

If time is critical, deploy after Phase 2 with:
```bash
npm run build
npm start
```

## CONTINUE ONLY IF TIME ALLOWS

### Phase 3: LangGraph (Optional for MVP)
### Phase 4: Knowledge Population (Can be done post-deployment)

## ENVIRONMENT VARIABLES NEEDED
```
ENABLE_RAG=true
RAG_DOMAINS=life_coaching
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
RAG_THRESHOLD=0.7
MAX_RAG_RESULTS=3
```

## SUCCESS CRITERIA FOR MVP
- [ ] Supabase vector search working
- [ ] RAG-enhanced responses better than baseline
- [ ] API compatibility maintained
- [ ] Feature flags allow rollback

## FALLBACK PLAN
If any issues, set `ENABLE_RAG=false` to revert to original system.