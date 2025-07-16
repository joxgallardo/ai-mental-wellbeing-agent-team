# Mental Health AI Agent API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Core API Endpoints](#core-api-endpoints)
5. [RAG Enhancement Endpoints](#rag-enhancement-endpoints)
6. [Feature Rollout Management](#feature-rollout-management)
7. [Health Check Endpoints](#health-check-endpoints)
8. [Error Handling](#error-handling)
9. [Response Formats](#response-formats)
10. [SDKs and Integration](#sdks-and-integration)

---

## Overview

The Mental Health AI Agent API provides comprehensive mental health support through AI-powered agents with RAG (Retrieval Augmented Generation) enhancement capabilities. The system supports multiple coaching domains and provides production-ready monitoring and rollout management.

**Base URL**: `https://api.mental-health-ai.com/v1`

**API Version**: v1.0.0

**Supported Formats**: JSON

---

## Authentication

### API Key Authentication

All API requests require an API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
```

### Rate Limiting

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour  
- **Enterprise**: Custom limits

---

## Core API Endpoints

### Start Mental Health Session

Start a new mental health support session with AI agents.

**Endpoint**: `POST /api/sessions`

**Request Body**:
```json
{
  "userInput": {
    "mentalState": "I've been feeling overwhelmed with work stress and having trouble sleeping",
    "sleepPattern": 4,
    "stressLevel": 8,
    "supportSystem": ["spouse", "friends"],
    "recentChanges": "Started a new demanding job 3 weeks ago",
    "currentSymptoms": ["anxiety", "insomnia", "difficulty concentrating"]
  },
  "context": {
    "userId": "user_123",
    "sessionId": "session_456",
    "previousResponses": []
  },
  "preferences": {
    "workflowType": "auto",
    "ragEnabled": true,
    "domain": "life_coaching"
  }
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session_456",
  "assessment": {
    "agentName": "AssessmentAgent",
    "content": "Based on your description, you're experiencing work-related stress with physical manifestations including sleep disruption...",
    "recommendations": [
      "Consider implementing stress management techniques",
      "Establish better work-life boundaries",
      "Practice sleep hygiene"
    ],
    "timestamp": "2024-12-15T10:30:00Z",
    "ragMetadata": {
      "useRag": true,
      "searchResults": 3,
      "sources": ["Stress Management Guide", "Sleep Hygiene Best Practices"],
      "qualityScore": 0.85
    }
  },
  "action": {
    "agentName": "ActionAgent", 
    "content": "Here's a structured action plan to address your work stress and sleep issues...",
    "recommendations": [
      "Implement daily 10-minute meditation",
      "Set strict work cutoff time at 6 PM",
      "Create evening wind-down routine"
    ],
    "timestamp": "2024-12-15T10:30:15Z",
    "ragMetadata": {
      "useRag": true,
      "searchResults": 5,
      "sources": ["SMART Goals Framework", "Time Management Strategies"],
      "qualityScore": 0.88
    }
  },
  "followUp": {
    "agentName": "FollowUpAgent",
    "content": "To maintain progress and build lasting habits...",
    "recommendations": [
      "Schedule weekly progress check-ins",
      "Track stress levels daily (1-10 scale)",
      "Join stress management support group"
    ],
    "timestamp": "2024-12-15T10:30:30Z",
    "ragMetadata": {
      "useRag": true,
      "searchResults": 2,
      "sources": ["Habit Formation Guide"],
      "qualityScore": 0.82
    }
  },
  "metadata": {
    "workflowType": "langgraph",
    "processingTime": 2340,
    "ragEnabled": true,
    "qualityScore": 0.85,
    "version": "1.0.0"
  }
}
```

### Continue Session

Continue an existing session with additional input.

**Endpoint**: `POST /api/sessions/{sessionId}/continue`

**Request Body**:
```json
{
  "userInput": {
    "mentalState": "I tried the meditation but I'm still having trouble with work boundaries",
    "sleepPattern": 5,
    "stressLevel": 7,
    "followUpNotes": "Meditation helped a bit, but work keeps calling after hours"
  },
  "context": {
    "previousResponses": [] // Previous session responses for context
  }
}
```

### Get Session History

Retrieve the history of a specific session.

**Endpoint**: `GET /api/sessions/{sessionId}`

**Response**:
```json
{
  "success": true,
  "sessionId": "session_456",
  "userId": "user_123",
  "startTime": "2024-12-15T10:30:00Z",
  "lastActivity": "2024-12-15T10:45:00Z",
  "interactions": [
    {
      "timestamp": "2024-12-15T10:30:00Z",
      "userInput": { /* original input */ },
      "agentResponses": { /* agent responses */ },
      "metadata": { /* processing metadata */ }
    }
  ],
  "summary": {
    "totalInteractions": 2,
    "mainConcerns": ["work stress", "sleep issues"],
    "progressIndicators": ["improved sleep from 4 to 5 hours"],
    "nextSteps": ["Continue meditation practice", "Implement work boundaries"]
  }
}
```

---

## RAG Enhancement Endpoints

### Search Knowledge Base

Search the RAG knowledge base directly.

**Endpoint**: `GET /api/rag/search`

**Query Parameters**:
- `q` (required): Search query
- `domain`: Domain to search (life_coaching, career_coaching, etc.)
- `limit`: Number of results (default: 5, max: 20)
- `threshold`: Similarity threshold (default: 0.7)

**Example Request**:
```http
GET /api/rag/search?q=stress management techniques&domain=life_coaching&limit=5
```

**Response**:
```json
{
  "success": true,
  "query": "stress management techniques",
  "results": [
    {
      "id": "stress_mgmt_guide_001",
      "title": "Comprehensive Stress Management Guide",
      "content": "Stress management involves a variety of techniques including mindfulness, physical exercise, and cognitive reframing...",
      "similarity": 0.89,
      "metadata": {
        "category": "best_practices",
        "methodology": "Mindfulness-Based Coaching",
        "evidence_level": "research-based",
        "life_area": "health"
      },
      "source": {
        "document": "Stress Management Best Practices",
        "author": "Life Coaching Team",
        "lastUpdated": "2024-12-01T00:00:00Z"
      }
    }
  ],
  "metadata": {
    "domain": "life_coaching",
    "searchTime": 45,
    "totalResults": 12,
    "filteredResults": 5
  }
}
```

### Get Domain Information

Get information about available domains and their configurations.

**Endpoint**: `GET /api/rag/domains`

**Response**:
```json
{
  "success": true,
  "domains": [
    {
      "id": "life_coaching",
      "name": "Life Coaching",
      "description": "Personal development and life goal achievement coaching",
      "methodologies": ["GROW Model", "Values Clarification", "Life Wheel Assessment"],
      "assessmentFrameworks": ["Goal Clarity Assessment", "Values Assessment"],
      "knowledgeSourceCount": 156,
      "lastUpdated": "2024-12-01T00:00:00Z"
    },
    {
      "id": "career_coaching", 
      "name": "Career Coaching",
      "description": "Professional development and career advancement coaching",
      "methodologies": ["Career Anchors Assessment", "Skills Gap Analysis"],
      "assessmentFrameworks": ["Career Satisfaction Assessment", "Skills Assessment"],
      "knowledgeSourceCount": 89,
      "lastUpdated": "2024-12-01T00:00:00Z"
    }
  ]
}
```

### Add Knowledge Content

Add new content to the knowledge base (admin only).

**Endpoint**: `POST /api/rag/knowledge`

**Request Body**:
```json
{
  "documents": [
    {
      "title": "Advanced Mindfulness Techniques",
      "content": "Mindfulness practice can be enhanced through...",
      "category": "best_practices",
      "methodology": "Mindfulness-Based Coaching",
      "life_area": "health",
      "complexity_level": "intermediate",
      "evidence_level": "research-based",
      "tags": ["mindfulness", "meditation", "stress reduction"],
      "author": "Dr. Jane Smith",
      "source": "Mindfulness Research Institute"
    }
  ],
  "domain": "life_coaching",
  "processingOptions": {
    "chunkSize": 1000,
    "overlapSize": 200,
    "validateContent": true
  }
}
```

---

## Feature Rollout Management

### Start Feature Rollout

Initiate a gradual rollout of a feature (admin only).

**Endpoint**: `POST /api/admin/rollout/start`

**Request Body**:
```json
{
  "featureKey": "rag_enhancement_v2",
  "targetPercentage": 100,
  "incrementPercentage": 10,
  "incrementInterval": 60
}
```

### Start RAG Enhancement Rollout

Quick start for RAG enhancement with safe defaults (admin only).

**Endpoint**: `POST /api/admin/rollout/start-rag`

**Response**:
```json
{
  "success": true,
  "message": "RAG enhancement rollout started successfully",
  "config": {
    "featureKey": "rag_enhancement",
    "targetPercentage": 100,
    "incrementPercentage": 5,
    "incrementInterval": 30,
    "estimatedCompletionTime": "600 minutes"
  }
}
```

### Get Rollout Status

Check the status of an active rollout.

**Endpoint**: `GET /api/admin/rollout/status/{featureKey}`

**Response**:
```json
{
  "success": true,
  "status": {
    "featureKey": "rag_enhancement",
    "currentPercentage": 45,
    "targetPercentage": 100,
    "status": "rolling_out",
    "startTime": "2024-12-15T09:00:00Z",
    "lastUpdateTime": "2024-12-15T10:30:00Z",
    "metrics": {
      "error_rate": 1.2,
      "avg_response_time": 1200,
      "user_satisfaction": 4.3,
      "rag_retrieval_success_rate": 96.5
    },
    "errorCount": 3,
    "userFeedbackCount": 127
  }
}
```

### Emergency Rollback

Immediately rollback a feature (admin only).

**Endpoint**: `POST /api/admin/rollout/rollback/{featureKey}`

**Request Body**:
```json
{
  "reason": "High error rate detected in production"
}
```

### Submit User Feedback

Submit feedback about the user experience.

**Endpoint**: `POST /api/feedback/rollout`

**Request Body**:
```json
{
  "userId": "user_123",
  "sessionId": "session_456", 
  "rating": 4,
  "feedback": "The new RAG features provided much more relevant recommendations",
  "ragEnabled": true
}
```

---

## Health Check Endpoints

### Basic Health Check

Quick health status check.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-15T10:30:00Z",
  "uptime": 86400000,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "application": {
      "status": "healthy",
      "responseTime": 12,
      "message": "Application running normally"
    },
    "memory": {
      "status": "healthy", 
      "responseTime": 5,
      "details": {
        "usedMB": 245,
        "totalMB": 512,
        "percentage": 48
      }
    }
  }
}
```

### Readiness Check

Check if the service is ready to handle requests.

**Endpoint**: `GET /health/ready`

**Response**:
```json
{
  "status": "healthy",
  "ready": true,
  "checks": {
    "database": { "status": "healthy", "responseTime": 25 },
    "openai": { "status": "healthy", "responseTime": 150 },
    "supabase": { "status": "healthy", "responseTime": 75 },
    "rag": { "status": "healthy", "responseTime": 45 },
    "featureFlags": { "status": "healthy", "responseTime": 10 }
  }
}
```

### Detailed Health Check

Comprehensive health information (admin only).

**Endpoint**: `GET /health/detailed`

**Response**: Extended health information with system metrics and component details.

---

## Error Handling

### Standard Error Format

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": {
      "field": "stressLevel",
      "value": 15,
      "constraint": "Must be between 1 and 10"
    }
  },
  "timestamp": "2024-12-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### HTTP Status Codes

- **200**: Success
- **400**: Bad Request - Invalid input
- **401**: Unauthorized - Invalid API key
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource doesn't exist
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error
- **503**: Service Unavailable - Health check failed

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is missing or invalid |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `RAG_SERVICE_UNAVAILABLE` | RAG system is down |
| `FEATURE_DISABLED` | Requested feature is disabled |
| `INSUFFICIENT_PERMISSIONS` | Admin access required |

---

## Response Formats

### Agent Response Format

Standard format for all agent responses:

```typescript
interface AgentResponse {
  agentName: string;
  content: string;
  recommendations: string[];
  timestamp: string;
  ragMetadata?: {
    useRag: boolean;
    searchResults?: number;
    sources?: string[];
    retrievalTime?: number;
    qualityScore?: number;
    fallbackReason?: string;
  };
}
```

### Session Metadata

```typescript
interface SessionMetadata {
  workflowType: 'traditional' | 'langgraph';
  processingTime: number;
  ragEnabled: boolean;
  qualityScore?: number;
  version: string;
}
```

---

## SDKs and Integration

### JavaScript/TypeScript SDK

```bash
npm install @mental-health-ai/sdk
```

```typescript
import { MentalHealthAI } from '@mental-health-ai/sdk';

const client = new MentalHealthAI({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.mental-health-ai.com/v1'
});

const response = await client.sessions.create({
  userInput: {
    mentalState: "I'm feeling stressed about work",
    stressLevel: 7,
    sleepPattern: 5
  },
  preferences: {
    ragEnabled: true,
    domain: 'life_coaching'
  }
});
```

### Python SDK

```bash
pip install mental-health-ai-sdk
```

```python
from mental_health_ai import MentalHealthAI

client = MentalHealthAI(api_key='your_api_key')

response = client.sessions.create(
    user_input={
        'mental_state': "I'm feeling stressed about work",
        'stress_level': 7,
        'sleep_pattern': 5
    },
    preferences={
        'rag_enabled': True,
        'domain': 'life_coaching'
    }
)
```

### Webhook Integration

Subscribe to session events:

```json
{
  "webhookUrl": "https://your-app.com/webhooks/mental-health",
  "events": ["session.completed", "session.updated"],
  "secret": "your_webhook_secret"
}
```

### Telegram Bot Integration

The API integrates seamlessly with Telegram bots:

```javascript
const bot = new TelegramBot(token);
const mentalHealthAI = new MentalHealthAI({ apiKey });

bot.on('message', async (msg) => {
  const response = await mentalHealthAI.sessions.create({
    userInput: {
      mentalState: msg.text,
      // ... other input
    }
  });
  
  bot.sendMessage(msg.chat.id, response.assessment.content);
});
```

---

## Rate Limiting Details

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1671097200
X-RateLimit-Window: 3600
```

### Rate Limit Tiers

| Tier | Requests/Hour | Burst Limit | Cost |
|------|---------------|-------------|------|
| Free | 100 | 10/minute | Free |
| Pro | 1,000 | 50/minute | $29/month |
| Business | 10,000 | 200/minute | $99/month |
| Enterprise | Custom | Custom | Contact Sales |

---

## Monitoring and Analytics

### Available Metrics

- Response time percentiles (p50, p95, p99)
- Error rates by endpoint
- RAG system performance
- User satisfaction scores
- Feature adoption rates

### Grafana Dashboard

Access real-time metrics at: `https://monitoring.mental-health-ai.com`

---

## Support

### Documentation
- **API Reference**: [docs.mental-health-ai.com](https://docs.mental-health-ai.com)
- **Developer Guide**: [developers.mental-health-ai.com](https://developers.mental-health-ai.com)

### Support Channels
- **Email**: support@mental-health-ai.com
- **Developer Forum**: [forum.mental-health-ai.com](https://forum.mental-health-ai.com)
- **Status Page**: [status.mental-health-ai.com](https://status.mental-health-ai.com)

### SLA
- **Uptime**: 99.9% guaranteed
- **Response Time**: <2s average
- **Support Response**: <24h for Pro+

---

*Last Updated: December 15, 2024*  
*API Version: 1.0.0*