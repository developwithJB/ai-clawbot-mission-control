# Production Deployment Guide

## Pre-Deployment Checklist

### Infrastructure Requirements

- **Compute**: 3 x 4 vCPU, 16 GB RAM instances (API, Workflow, Web)
- **Database**: PostgreSQL 16 (8 vCPU, 32 GB RAM, 500 GB SSD)
- **Cache**: Redis 7 (2 vCPU, 4 GB RAM)
- **Workflow**: Temporal Cloud or self-hosted (4 vCPU, 8 GB RAM)
- **Load Balancer**: Application load balancer with SSL termination
- **Storage**: S3-compatible object storage for backups

### DNS Configuration

```
api.haushavn.com     → Load Balancer (API)
app.haushavn.com     → CDN (Next.js static assets)
temporal.haushavn.com → Temporal UI (VPN-only)
```

### SSL Certificates

- Obtain wildcard certificate: `*.haushavn.com`
- Use Let's Encrypt with auto-renewal
- Configure HTTPS-only with HSTS headers

## Environment Variables

### API Service

```bash
NODE_ENV=production
PORT=3001

# Database
DB_HOST=prod-db.internal
DB_PORT=5432
DB_NAME=haushavn_prod
DB_USER=haushavn_prod
DB_PASSWORD=<strong-password>
DB_SSL=true

# Temporal
TEMPORAL_ADDRESS=temporal.haushavn.com:7233
TEMPORAL_NAMESPACE=haushavn-prod

# Redis
REDIS_URL=redis://prod-redis.internal:6379
REDIS_PASSWORD=<strong-password>

# Auth
JWT_SECRET=<256-bit-secret>
JWT_EXPIRY=24h

# Monitoring
SENTRY_DSN=<sentry-url>
LOG_LEVEL=info

# Feature Flags
ENABLE_WEB_SEARCH=true
ENABLE_NOTIFICATIONS=true
```

### Workflow Service

```bash
NODE_ENV=production

# Database
DB_HOST=prod-db.internal
DB_PORT=5432
DB_NAME=haushavn_prod
DB_USER=haushavn_prod
DB_PASSWORD=<strong-password>

# Temporal
TEMPORAL_ADDRESS=temporal.haushavn.com:7233
TEMPORAL_NAMESPACE=haushavn-prod

# API
API_URL=https://api.haushavn.com

# Monitoring
SENTRY_DSN=<sentry-url>
```

### Web Application

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.haushavn.com
NEXT_PUBLIC_ENVIRONMENT=production
```

## Database Setup

### 1. Create Production Database

```sql
-- As superuser
CREATE DATABASE haushavn_prod;
CREATE USER haushavn_prod WITH PASSWORD '<strong-password>';
GRANT ALL PRIVILEGES ON DATABASE haushavn_prod TO haushavn_prod;

-- Enable extensions
\c haushavn_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 2. Run Migrations

```bash
cd services/api
export DB_HOST=prod-db.internal
export DB_NAME=haushavn_prod
export DB_USER=haushavn_prod
export DB_PASSWORD=<password>
npm run db:migrate
```

### 3. Configure Backups

**pg_dump daily backup:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/haushavn_prod_$DATE.dump"

pg_dump -h prod-db.internal \
        -U haushavn_prod \
        -F c \
        -b \
        -v \
        -f "$BACKUP_FILE" \
        haushavn_prod

# Upload to S3
aws s3 cp "$BACKUP_FILE" s3://haushavn-backups/database/

# Clean up local file
rm "$BACKUP_FILE"

# Retain 30 days
aws s3 ls s3://haushavn-backups/database/ | \
  grep -v $(date +%Y%m --date='30 days ago') | \
  awk '{print $4}' | \
  xargs -I {} aws s3 rm s3://haushavn-backups/database/{}
```

Schedule with cron:
```cron
0 2 * * * /usr/local/bin/backup-database.sh
```

## Docker Production Deployment

### 1. Build Images

```bash
# API Service
cd services/api
docker build -t haushavn/api:latest .

# Workflow Service
cd ../workflow
docker build -t haushavn/workflow:latest .

# Web Application
cd ../../apps/web
docker build -t haushavn/web:latest .
```

### 2. Push to Registry

```bash
# Tag with version
docker tag haushavn/api:latest registry.haushavn.com/api:1.0.0
docker tag haushavn/workflow:latest registry.haushavn.com/workflow:1.0.0
docker tag haushavn/web:latest registry.haushavn.com/web:1.0.0

# Push
docker push registry.haushavn.com/api:1.0.0
docker push registry.haushavn.com/workflow:1.0.0
docker push registry.haushavn.com/web:1.0.0
```

### 3. Deploy with Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  api:
    image: registry.haushavn.com/api:1.0.0
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - haushavn
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  workflow:
    image: registry.haushavn.com/workflow:1.0.0
    restart: always
    environment:
      - NODE_ENV=production
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
    networks:
      - haushavn

  web:
    image: registry.haushavn.com/web:1.0.0
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_URL}
    networks:
      - haushavn

networks:
  haushavn:
    driver: bridge
```

Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Kubernetes Deployment

### 1. Create Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: haushavn-prod
```

### 2. Deploy API Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: haushavn-api
  namespace: haushavn-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: haushavn-api
  template:
    metadata:
      labels:
        app: haushavn-api
    spec:
      containers:
      - name: api
        image: registry.haushavn.com/api:1.0.0
        ports:
        - containerPort: 3001
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: haushavn-secrets
              key: db-password
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: haushavn-api
  namespace: haushavn-prod
spec:
  selector:
    app: haushavn-api
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

### 3. Configure Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: haushavn-ingress
  namespace: haushavn-prod
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.haushavn.com
    - app.haushavn.com
    secretName: haushavn-tls
  rules:
  - host: api.haushavn.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: haushavn-api
            port:
              number: 80
  - host: app.haushavn.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: haushavn-web
            port:
              number: 80
```

## Monitoring Setup

### 1. Prometheus

```yaml
# prometheus-config.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'haushavn-api'
    static_configs:
      - targets: ['api.haushavn.com:3001']
  
  - job_name: 'haushavn-workflow'
    static_configs:
      - targets: ['workflow-internal:9090']
```

### 2. Grafana Dashboards

Import dashboards:
- Node.js Application Metrics (ID: 11159)
- PostgreSQL Database (ID: 9628)
- Temporal Workflows (ID: 14670)

### 3. Alerting Rules

```yaml
groups:
- name: haushavn-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
```

## Security Hardening

### 1. Network Security

- Enable VPC firewall rules
- Whitelist only necessary IPs
- Use private subnets for databases
- Enable DDoS protection

### 2. Database Security

```sql
-- Restrict access
REVOKE ALL ON DATABASE haushavn_prod FROM PUBLIC;
GRANT CONNECT ON DATABASE haushavn_prod TO haushavn_prod;

-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Configure pg_hba.conf
hostssl all all 0.0.0.0/0 md5
```

### 3. API Security

```typescript
// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// CORS
app.use(cors({
  origin: 'https://app.haushavn.com',
  credentials: true
}));

// Security headers
app.use(helmet({
  hsts: { maxAge: 31536000 },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
```

## Rollback Procedure

### Quick Rollback

```bash
# Revert to previous version
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull haushavn/api:0.9.0
docker-compose -f docker-compose.prod.yml up -d
```

### Database Rollback

```bash
# Restore from backup
pg_restore -h prod-db.internal \
           -U haushavn_prod \
           -d haushavn_prod \
           -c \
           /backups/haushavn_prod_20241220.dump
```

## Post-Deployment Validation

### Smoke Tests

```bash
# Health check
curl https://api.haushavn.com/health

# Create deal (requires auth)
curl -X POST https://api.haushavn.com/api/deals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "uuid",
    "propertyAddress": "Test Property",
    "purchasePrice": 500000,
    "estimatedCloseDate": "2024-12-31T00:00:00Z",
    "templateId": "uuid",
    "buyerId": "uuid",
    "buyerAgentId": "uuid",
    "createdBy": "uuid"
  }'
```

### Performance Baseline

- API p95 response time: <500ms
- Database query p95: <200ms
- Workflow start latency: <1s
- Page load time: <2s

## Maintenance Windows

Schedule monthly maintenance:
- **Database updates**: 2nd Sunday, 2-4 AM UTC
- **Application updates**: 4th Sunday, 2-4 AM UTC
- **Security patches**: As needed (zero-downtime)

## Support Contacts

- **Engineering Lead**: engineering@haushavn.com
- **DevOps**: devops@haushavn.com
- **Incident Hotline**: +1-555-HAUSHAVN

## Disaster Recovery Runbook

### Database Failure

1. Alert team via PagerDuty
2. Promote read replica to primary
3. Update application config
4. Restart services
5. Verify data integrity
6. Update DNS if needed

### API Service Failure

1. Check health endpoint
2. Review logs in Sentry
3. Scale up new instances
4. Drain traffic from failed instances
5. Investigate root cause

### Complete Outage

1. Activate incident response team
2. Restore from latest backup
3. Deploy last known good version
4. Validate all services
5. Communicate to stakeholders
6. Post-mortem within 48 hours
