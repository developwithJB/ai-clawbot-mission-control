# Haushavn Technical Architecture

## System Overview

Haushavn is built as a distributed, event-driven system with strong consistency guarantees for transaction data and eventual consistency for notifications and analytics.

## Architecture Principles

1. **Domain-Driven Design**: Clear bounded contexts (Deals, Tasks, Workflows)
2. **Event Sourcing**: Immutable audit log captures all state transitions
3. **CQRS**: Separate read and write models for performance
4. **Workflow-First**: Temporal orchestrates complex, long-running processes
5. **Security by Default**: RLS, least-privilege RBAC, encrypted at rest

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │   Next.js Web    │  │   Mobile App     │                    │
│  │   (React 18)     │  │   (Future)       │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
└───────────┼────────────────────┼──────────────────────────────┘
            │                    │
            └────────┬───────────┘
                     │ HTTPS/REST
            ┌────────▼────────┐
            │   API Gateway   │
            │   (Express)     │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
  ┌─────▼─────┐ ┌───▼────┐ ┌────▼────┐
  │   Deal    │ │  Task  │ │  User   │
  │  Service  │ │ Service│ │ Service │
  └─────┬─────┘ └───┬────┘ └────┬────┘
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────▼───────────┐
        │   PostgreSQL          │
        │   (Primary Store)     │
        │   - RLS Enabled       │
        │   - Audit Log         │
        │   - Event Outbox      │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │   Temporal            │
        │   (Workflow Engine)   │
        │   - Deal Lifecycle    │
        │   - Task Dependencies │
        │   - Notifications     │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │   Redis               │
        │   (Cache + Sessions)  │
        └───────────────────────┘
```

## Data Flow: Task Completion

```
1. User clicks "Complete Task" in UI
   ↓
2. POST /api/tasks/:id/complete
   ↓
3. TaskService.completeTask() [Transactional]
   ├─ Update task status
   ├─ Check dependent tasks
   ├─ Unlock unblocked tasks
   ├─ Write audit log entry
   └─ Add event to outbox
   ↓
4. Commit transaction
   ↓
5. Signal Temporal workflow (async)
   ↓
6. Workflow continues (if milestone complete)
   ↓
7. Send notifications via activities
   ↓
8. Update read models (future: CQRS projections)
```

## State Machine: Task Lifecycle

```
PENDING ────────────────────────┐
   │                             │
   │ assignee_id set             │ dependencies exist
   ▼                             ▼
IN_PROGRESS                   BLOCKED
   │                             │
   │ completed_by set            │ dependencies cleared
   ▼                             ▼
COMPLETED                     PENDING
   │
   │ past due_date
   ▼
OVERDUE
```

## Database Schema Highlights

### Audit Log (Immutable)

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    deal_id UUID,
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    event_data JSONB NOT NULL,
    ip_address INET,
    created_at TIMESTAMP NOT NULL
);

-- Prevent updates/deletes
CREATE RULE audit_log_immutable AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

### Row-Level Security

```sql
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_org_isolation ON deals
    USING (organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = current_setting('app.current_user_id')::UUID
    ));
```

Before each query, set user context:
```sql
SET LOCAL app.current_user_id = 'user-uuid';
```

### Event Outbox Pattern

Ensures events are published atomically with database writes:

```sql
CREATE TABLE event_outbox (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP
);
```

Background worker polls for unprocessed events and publishes to message bus.

## Temporal Workflows

### Deal Lifecycle Workflow

```typescript
export async function dealLifecycleWorkflow(input: DealWorkflowInput) {
  const completedTasks = new Set<string>();

  // Listen for task completion signals
  setHandler(taskCompletedSignal, ({ taskId }) => {
    completedTasks.add(taskId);
  });

  // Apply template
  const template = await applyDealTemplate(dealId, templateId);
  
  // Process milestones sequentially
  for (const milestone of template.milestones) {
    for (const task of milestone.tasks) {
      // Wait for external signal
      await condition(() => completedTasks.has(task.id));
      
      // Task completed - send notification
      await sendNotification({ ... });
    }
    
    // Check milestone completion
    const complete = await checkMilestoneCompletion(dealId, milestone.id);
    if (complete) {
      await sendNotification({ type: 'MILESTONE_REACHED' });
    }
  }
}
```

**Why Temporal?**
- Durable execution (survives crashes)
- Deterministic replay (for testing)
- Built-in retries and timeouts
- Versioning support for workflow changes
- Observable via UI

## API Design

### RESTful Conventions

- `GET /api/deals` - List deals
- `GET /api/deals/:id` - Get single deal
- `POST /api/deals` - Create deal
- `PUT /api/deals/:id` - Update deal
- `DELETE /api/deals/:id` - Delete deal

### Command/Query Separation

**Commands** (write operations):
- `POST /api/deals` → CreateDealCommand
- `POST /api/tasks/:id/assign` → AssignTaskCommand
- `POST /api/tasks/:id/complete` → CompleteTaskCommand

**Queries** (read operations):
- `GET /api/deals/:id/summary` → DealSummary
- `GET /api/deals/:id/buyer-timeline` → BuyerTimeline
- `GET /api/tasks/:id` → TaskWithDependencies

### Error Handling

```typescript
{
  "error": "ValidationError",
  "message": "Property address is required",
  "code": "VALIDATION_001",
  "details": {
    "field": "propertyAddress",
    "constraint": "required"
  }
}
```

HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation)
- 401: Unauthorized
- 403: Forbidden (RBAC)
- 404: Not Found
- 409: Conflict (e.g., duplicate)
- 500: Internal Server Error

## Security Architecture

### Authentication Flow

1. User submits credentials
2. API validates against `users` table (bcrypt)
3. Generate JWT with claims: `{ userId, orgId, role }`
4. Return JWT to client
5. Client includes JWT in `Authorization: Bearer <token>` header
6. API validates JWT and sets `app.current_user_id` for RLS

### Authorization (RBAC)

```typescript
const permissions = {
  BUYER: ['view_own_deals', 'complete_own_tasks'],
  BUYER_AGENT: ['view_deals', 'create_deals', 'assign_tasks'],
  TRANSACTION_COORDINATOR: ['view_all_deals', 'manage_tasks'],
  ADMIN: ['*']
};
```

Checked at:
1. API layer (Express middleware)
2. Service layer (business logic)
3. Database layer (RLS policies)

### Data Classification

- **Public**: Property address, deal status
- **Internal**: Task details, comments
- **Confidential**: Purchase price, SSN, financial docs
- **Restricted**: Audit logs (immutable, admin-only export)

PII fields tagged in schema for GDPR/CCPA compliance.

## Performance Optimization

### Database

- Indexes on frequently queried columns
- Materialized views for reporting
- Connection pooling (max 20 connections)
- Query timeout: 30s

### Caching Strategy

**Redis layers:**
1. Session cache (TTL: 24h)
2. User profile cache (TTL: 1h)
3. Deal summary cache (TTL: 5min, invalidated on update)

### API Response Times

Target SLAs:
- Simple queries: <100ms (p95)
- Complex queries: <500ms (p95)
- Write operations: <200ms (p95)

## Observability

### Logging

Structured JSON logs with Winston:

```json
{
  "timestamp": "2024-12-20T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "message": "Task completed",
  "taskId": "uuid",
  "userId": "uuid",
  "duration": 45
}
```

### Metrics (Prometheus format)

- `api_request_duration_seconds` (histogram)
- `db_query_duration_seconds` (histogram)
- `workflow_execution_duration_seconds` (histogram)
- `active_deals_total` (gauge)
- `overdue_tasks_total` (gauge)

### Tracing

Distributed tracing with OpenTelemetry:
- Trace ID propagated across services
- Span per DB query, API call, workflow activity

### Alerting

Critical alerts:
- API error rate >5%
- Database connection pool exhausted
- Workflow execution failures
- Disk space <10%

## Disaster Recovery

### Backup Strategy

**PostgreSQL:**
- Full backup: Daily at 2 AM UTC
- Incremental backup: Every 4 hours
- Retention: 30 days
- Tested restore: Weekly

**Temporal:**
- Workflow history persisted in Postgres
- Backed up with main database

### RTO/RPO

- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 4 hours

### Failover Procedure

1. Detect primary failure (health check)
2. Promote standby to primary
3. Update DNS/load balancer
4. Restart services pointing to new primary
5. Verify data integrity
6. Resume normal operations

## Scaling Strategy

### Horizontal Scaling

**API Service:**
- Stateless design
- Scale with load balancer (Nginx/HAProxy)
- Target: 10 instances for 10k concurrent users

**Workflow Workers:**
- Task queue based
- Scale workers independently
- Target: 5 workers for 1k active deals

### Vertical Scaling

**Database:**
- Start: 4 vCPU, 16 GB RAM
- Growth: 8 vCPU, 32 GB RAM
- Peak: 16 vCPU, 64 GB RAM

**Read Replicas:**
- 2 replicas for read traffic
- Route queries with read concern

### Partitioning

**Deals:**
- Partition by `created_at` (monthly)
- Archive deals >1 year to cold storage

**Audit Log:**
- Partition by `created_at` (weekly)
- Retain online for 90 days

## Deployment Pipeline

```
Code Push → GitHub
    ↓
GitHub Actions
    ├─ Lint
    ├─ Type Check
    ├─ Unit Tests
    └─ Build
    ↓
Docker Build
    ↓
Push to Registry
    ↓
Deploy to Staging
    ↓
Integration Tests
    ↓
Manual Approval
    ↓
Deploy to Production
    ├─ Blue/Green Deployment
    └─ Smoke Tests
    ↓
Monitor Metrics
```

### Zero-Downtime Deployment

1. Deploy new version alongside old (blue/green)
2. Route 10% traffic to new version
3. Monitor error rates for 15 minutes
4. If stable, route 50% traffic
5. Monitor for 15 minutes
6. If stable, route 100% traffic
7. Keep old version running for 1 hour (rollback window)
8. Terminate old version

## Future Enhancements

### Phase 2 (Days 22-49)
- WebSocket for real-time updates
- Advanced search (Elasticsearch)
- Document storage (S3)
- Email notifications

### Phase 3 (Days 50-75)
- Mobile app (React Native)
- Third-party integrations (DocuSign, Slack)
- Advanced analytics
- ML-powered risk scoring

### Phase 4 (Days 76-90)
- White-label solution
- API marketplace
- Custom workflow builder (no-code)
- Enterprise SSO (SAML/OIDC)
