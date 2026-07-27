CREATE TABLE IF NOT EXISTS "runbook_documents" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sourceType" VARCHAR(30) NOT NULL DEFAULT 'manual',
  "sourceName" VARCHAR(255),
  "mimeType" VARCHAR(100),
  "content" TEXT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createdById" VARCHAR(100) NOT NULL,
  "createdByName" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runbook_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "runbook_chunks" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runbook_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "runbook_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "runbook_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "alert_sources" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "sourceType" VARCHAR(40) NOT NULL DEFAULT 'alertmanager',
  "tokenHash" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastReceivedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alert_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "artifact_repositories" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "repositoryType" VARCHAR(40) NOT NULL DEFAULT 'docker_registry',
  "baseUrl" VARCHAR(500) NOT NULL,
  "projectName" VARCHAR(255),
  "username" VARCHAR(255),
  "passwordEncrypted" TEXT,
  "verifyTls" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" VARCHAR(30) NOT NULL DEFAULT 'unknown',
  "lastVerifiedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "artifact_repositories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "runbook_documents_status_updatedAt_idx" ON "runbook_documents"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "runbook_documents_createdById_idx" ON "runbook_documents"("createdById");
CREATE INDEX IF NOT EXISTS "runbook_documents_contentHash_idx" ON "runbook_documents"("contentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "runbook_chunks_documentId_chunkIndex_key" ON "runbook_chunks"("documentId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "runbook_chunks_documentId_idx" ON "runbook_chunks"("documentId");
CREATE UNIQUE INDEX IF NOT EXISTS "alert_sources_tokenHash_key" ON "alert_sources"("tokenHash");
CREATE INDEX IF NOT EXISTS "alert_sources_enabled_idx" ON "alert_sources"("enabled");
CREATE INDEX IF NOT EXISTS "artifact_repositories_status_idx" ON "artifact_repositories"("status");
CREATE INDEX IF NOT EXISTS "artifact_repositories_isDefault_idx" ON "artifact_repositories"("isDefault");
