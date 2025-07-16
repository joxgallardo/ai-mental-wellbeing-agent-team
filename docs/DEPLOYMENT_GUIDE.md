# Production Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Database Setup](#database-setup)
7. [Environment Variables](#environment-variables)
8. [Health Checks](#health-checks)
9. [Monitoring Setup](#monitoring-setup)
10. [Feature Rollout](#feature-rollout)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the Mental Health AI Agent system to production with RAG enhancement and LangGraph workflow capabilities.

### Architecture Components

- **Application Server**: Node.js with TypeScript
- **Vector Database**: Supabase with pgvector
- **Cache Layer**: Redis
- **Monitoring**: Prometheus + Grafana
- **Reverse Proxy**: Nginx
- **Container Orchestration**: Docker Compose or Kubernetes

---

## Prerequisites

### System Requirements

- **CPU**: 2+ cores (4+ recommended)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 20GB SSD minimum
- **Network**: Stable internet connection

### Software Dependencies

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Supabase)

### External Services

- **Supabase Account**: For vector database
- **OpenAI API Key**: For AI processing
- **Telegram Bot Token**: For bot integration

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/mental-health-ai-agent.git
cd mental-health-ai-agent
```

### 2. Environment Configuration

Create production environment file:

```bash
cp .env.example .env.production
```

Edit `.env.production` with your production values:

```env
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@host:5432/mental_health_ai
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Supabase (Vector Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=2000

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
ENCRYPTION_KEY=your-encryption-key-minimum-32-chars
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com

# Redis Cache
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password

# Monitoring
MONITORING_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Feature Flags
RAG_ENABLED=true
LANGGRAPH_ENABLED=true
```

---

## Docker Deployment

### Quick Start with Docker Compose

1. **Build and start services**:

```bash
# Production deployment
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps
```

2. **View logs**:

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f mental-health-ai
```

3. **Scale application**:

```bash
# Scale to 3 instances
docker-compose -f docker-compose.production.yml up -d --scale mental-health-ai=3
```

### Custom Docker Build

If you need to customize the Docker image:

```bash
# Build custom image
docker build -f Dockerfile.production -t mental-health-ai:custom .

# Run with custom image
docker run -d \
  --name mental-health-ai \
  --env-file .env.production \
  -p 3000:3000 \
  -p 9090:9090 \
  mental-health-ai:custom
```

---

## Kubernetes Deployment

### 1. Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mental-health-ai
```

```bash
kubectl apply -f namespace.yaml
```

### 2. Create Secrets

```bash
# Create secret from env file
kubectl create secret generic mental-health-ai-secrets \
  --from-env-file=.env.production \
  -n mental-health-ai
```

### 3. Deploy Application

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mental-health-ai
  namespace: mental-health-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mental-health-ai
  template:
    metadata:
      labels:
        app: mental-health-ai
    spec:
      containers:
      - name: mental-health-ai
        image: mental-health-ai:1.0.0
        ports:
        - containerPort: 3000
        - containerPort: 9090
        envFrom:
        - secretRef:
            name: mental-health-ai-secrets
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: mental-health-ai-service
  namespace: mental-health-ai
spec:
  selector:
    app: mental-health-ai
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
```

```bash
kubectl apply -f deployment.yaml
```

### 4. Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mental-health-ai-ingress
  namespace: mental-health-ai
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-rps: "10"
spec:
  tls:
  - hosts:
    - api.mental-health-ai.com
    secretName: mental-health-ai-tls
  rules:
  - host: api.mental-health-ai.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mental-health-ai-service
            port:
              number: 80
```

---

## Database Setup

### Supabase Configuration

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Enable pgvector extension

2. **Setup Vector Tables**:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chunks table with vector embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384),
  metadata JSONB DEFAULT '{}',
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector index for similarity search
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Allow read access" ON documents FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON document_chunks FOR SELECT USING (true);
```

3. **Populate Initial Knowledge Base**:

```bash
# Run knowledge population script
npm run populate-knowledge
```

### PostgreSQL Setup (Alternative)

If using standalone PostgreSQL:

```sql
-- Create database
CREATE DATABASE mental_health_ai;

-- Create user
CREATE USER mental_health_ai_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE mental_health_ai TO mental_health_ai_user;

-- Connect to database and setup tables
\c mental_health_ai;

-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Run the same table creation scripts as above
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | Database connection | `postgresql://...` |
| `SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123:ABC...` |
| `JWT_SECRET` | JWT signing secret | `min-32-chars` |
| `ENCRYPTION_KEY` | Encryption key | `min-32-chars` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Application port |
| `REDIS_URL` | - | Redis connection URL |
| `SENTRY_DSN` | - | Error tracking |
| `LOG_LEVEL` | `info` | Logging level |
| `RAG_ENABLED` | `true` | Enable RAG features |
| `LANGGRAPH_ENABLED` | `true` | Enable LangGraph |

---

## Health Checks

### Configure Health Check Endpoints

The application provides several health check endpoints:

- **Basic**: `GET /health` - Quick status check
- **Readiness**: `GET /health/ready` - Service dependencies
- **Liveness**: `GET /health/live` - Application responsiveness

### Load Balancer Configuration

Configure your load balancer to use appropriate health checks:

```nginx
# Nginx upstream configuration
upstream mental_health_ai {
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}

server {
    location /health {
        proxy_pass http://mental_health_ai;
        proxy_connect_timeout 1s;
        proxy_timeout 1s;
    }
}
```

### Kubernetes Health Checks

```yaml
# Health check configuration
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mental-health-ai'
    static_configs:
      - targets: ['mental-health-ai:9090']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
```

### Grafana Dashboards

Import the provided Grafana dashboard:

```bash
# Copy dashboard configuration
cp config/grafana/dashboards/mental-health-ai.json /var/lib/grafana/dashboards/
```

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: mental-health-ai
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High response time detected

      - alert: RAGSystemDown
        expr: rag_system_health == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: RAG system is unavailable
```

---

## Feature Rollout

### Initial RAG Rollout

1. **Start with disabled RAG**:

```bash
# Set environment variable
RAG_ENABLED=false
```

2. **Use rollout API to gradually enable**:

```bash
# Start RAG rollout
curl -X POST https://api.mental-health-ai.com/admin/rollout/start-rag \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

3. **Monitor rollout progress**:

```bash
# Check status
curl https://api.mental-health-ai.com/admin/rollout/status/rag_enhancement \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

### Emergency Rollback

If issues are detected:

```bash
# Emergency rollback
curl -X POST https://api.mental-health-ai.com/admin/rollout/rollback/rag_enhancement \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "High error rate detected"}'
```

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptoms**: Container exits immediately

**Solutions**:
```bash
# Check logs
docker logs mental-health-ai

# Verify environment variables
docker exec mental-health-ai env | grep -E "DATABASE_URL|OPENAI_API_KEY"

# Test database connection
docker exec mental-health-ai node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()').then(console.log).catch(console.error);
"
```

#### 2. RAG System Errors

**Symptoms**: 503 errors on `/health/ready`

**Solutions**:
```bash
# Check Supabase connectivity
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/documents?limit=1"

# Verify vector extension
docker exec postgres psql -U postgres -d mental_health_ai -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check knowledge base population
curl https://api.mental-health-ai.com/api/rag/search?q=test&limit=1
```

#### 3. High Memory Usage

**Symptoms**: Application restarts frequently

**Solutions**:
```bash
# Monitor memory usage
docker stats mental-health-ai

# Increase memory limits
docker-compose up -d --scale mental-health-ai=2

# Enable memory optimization
export NODE_OPTIONS="--max-old-space-size=1024"
```

#### 4. Slow Response Times

**Symptoms**: High latency, timeouts

**Solutions**:
```bash
# Check database performance
docker exec postgres psql -U postgres -d mental_health_ai -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
"

# Monitor cache hit rates
redis-cli info stats | grep cache

# Scale application
kubectl scale deployment mental-health-ai --replicas=5
```

### Performance Tuning

#### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM document_chunks 
WHERE embedding <-> '[0,1,0,...]'::vector < 0.5 
ORDER BY embedding <-> '[0,1,0,...]'::vector 
LIMIT 5;

-- Update table statistics
ANALYZE document_chunks;

-- Optimize index
CREATE INDEX CONCURRENTLY ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

#### Application Tuning

```javascript
// PM2 configuration for production
module.exports = {
  apps: [{
    name: 'mental-health-ai',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1024'
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log'
  }]
};
```

### Monitoring Commands

```bash
# Check application health
curl https://api.mental-health-ai.com/health

# Monitor metrics
curl https://api.mental-health-ai.com/metrics

# Check feature rollout status
curl -H "Authorization: Bearer $API_KEY" \
  https://api.mental-health-ai.com/admin/rollout/dashboard
```

---

## Security Considerations

### SSL/TLS Configuration

1. **Use Let's Encrypt for certificates**:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.mental-health-ai.com
```

2. **Configure SSL in Nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name api.mental-health-ai.com;
    
    ssl_certificate /etc/letsencrypt/live/api.mental-health-ai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mental-health-ai.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://mental_health_ai;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Environment Security

- Use secrets management (Docker secrets, Kubernetes secrets)
- Rotate API keys regularly
- Enable audit logging
- Use least-privilege access

---

*Last Updated: December 15, 2024*  
*Version: 1.0.0*