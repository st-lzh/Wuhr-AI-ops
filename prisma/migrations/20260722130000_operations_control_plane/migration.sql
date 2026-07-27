CREATE TABLE IF NOT EXISTS "automation_jobs" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "command" TEXT NOT NULL,
  "targetServerIds" JSONB NOT NULL,
  "cronExpression" VARCHAR(100),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" VARCHAR(20) NOT NULL DEFAULT 'medium',
  "approvalMode" VARCHAR(30) NOT NULL DEFAULT 'every_run',
  "version" INTEGER NOT NULL DEFAULT 1,
  "approvedVersion" INTEGER,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdById" VARCHAR(100) NOT NULL,
  "createdByName" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" TEXT NOT NULL,
  "jobId" TEXT,
  "jobName" VARCHAR(120) NOT NULL,
  "triggerType" VARCHAR(30) NOT NULL DEFAULT 'manual',
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "riskLevel" VARCHAR(20) NOT NULL,
  "commandSnapshot" TEXT NOT NULL,
  "targetSnapshot" JSONB NOT NULL,
  "requestedById" VARCHAR(100) NOT NULL,
  "requestedByName" VARCHAR(100),
  "approvedById" VARCHAR(100),
  "approvedByName" VARCHAR(100),
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "output" JSONB,
  "summary" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "automation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "operational_incidents" (
  "id" TEXT NOT NULL,
  "source" VARCHAR(50) NOT NULL,
  "externalId" VARCHAR(150),
  "fingerprint" VARCHAR(255) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "severity" VARCHAR(20) NOT NULL DEFAULT 'warning',
  "status" VARCHAR(30) NOT NULL DEFAULT 'open',
  "resourceType" VARCHAR(50),
  "resourceId" VARCHAR(150),
  "assigneeId" VARCHAR(100),
  "assigneeName" VARCHAR(100),
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "operational_incidents_fingerprint_key" ON "operational_incidents"("fingerprint");
CREATE INDEX IF NOT EXISTS "automation_jobs_enabled_nextRunAt_idx" ON "automation_jobs"("enabled", "nextRunAt");
CREATE INDEX IF NOT EXISTS "automation_jobs_createdById_idx" ON "automation_jobs"("createdById");
CREATE INDEX IF NOT EXISTS "automation_runs_jobId_idx" ON "automation_runs"("jobId");
CREATE INDEX IF NOT EXISTS "automation_runs_status_createdAt_idx" ON "automation_runs"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "automation_runs_requestedById_idx" ON "automation_runs"("requestedById");
CREATE INDEX IF NOT EXISTS "operational_incidents_status_severity_idx" ON "operational_incidents"("status", "severity");
CREATE INDEX IF NOT EXISTS "operational_incidents_source_lastSeenAt_idx" ON "operational_incidents"("source", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "operational_incidents_resourceType_resourceId_idx" ON "operational_incidents"("resourceType", "resourceId");

CREATE TABLE IF NOT EXISTS "k8s_clusters" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "serverId" VARCHAR(100) NOT NULL,
  "contextName" VARCHAR(255) NOT NULL,
  "defaultNamespace" VARCHAR(255) NOT NULL DEFAULT 'default',
  "environment" VARCHAR(50),
  "tags" TEXT[] NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'unknown',
  "kubernetesVersion" VARCHAR(100),
  "lastVerifiedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "k8s_clusters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "k8s_clusters_serverId_idx" ON "k8s_clusters"("serverId");
CREATE INDEX IF NOT EXISTS "k8s_clusters_status_idx" ON "k8s_clusters"("status");
