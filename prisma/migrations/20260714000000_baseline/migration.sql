-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'developer', 'viewer');

-- CreateEnum
CREATE TYPE "UserApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UserRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('online', 'offline', 'warning', 'error');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('cpu', 'memory', 'disk', 'network', 'service', 'custom');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('user_registration', 'user_approved', 'user_rejected', 'system_alert', 'api_key_expired');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('user', 'ai', 'system');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sending', 'success', 'error');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('pending', 'queued', 'running', 'success', 'failed', 'aborted', 'unstable');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'approved', 'rejected', 'scheduled', 'deploying', 'success', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('user_registration', 'deployment', 'cicd_pipeline', 'system_config', 'jenkins_job');

-- CreateEnum
CREATE TYPE "AppVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'ERROR', 'UNKNOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('SWITCH', 'ROUTER', 'FIREWALL', 'LOAD_BALANCER', 'WIRELESS_CONTROLLER');

-- CreateEnum
CREATE TYPE "DeviceVendor" AS ENUM ('CISCO', 'HUAWEI', 'H3C', 'JUNIPER', 'ARISTA', 'RUIJIE', 'MAIPU', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'DOCX', 'DOC', 'TXT', 'MD', 'HTML', 'CSV', 'XLSX', 'XLS', 'PPTX', 'PPT', 'JSON', 'URL', 'OTHER');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "HealingStatus" AS ENUM ('PENDING', 'APPROVED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "HealingTriggerType" AS ENUM ('ALERT', 'METRIC', 'EVENT', 'SCHEDULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "IndexStatus" AS ENUM ('PENDING', 'INDEXING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "KnowledgeMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageFeedback" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('SERVER', 'NETWORK', 'K8S', 'DATABASE', 'CACHE');

-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('LLM', 'EMBEDDING', 'VECTOR_DB');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('OPENAI', 'AZURE_OPENAI', 'ANTHROPIC', 'QWEN', 'ERNIE', 'OLLAMA', 'VLLM', 'OPENAI_COMPATIBLE', 'OPENAI_EMBEDDING', 'AZURE_EMBEDDING', 'QWEN_EMBEDDING', 'BGE', 'OLLAMA_EMBEDDING', 'PGVECTOR', 'MILVUS', 'QDRANT', 'ELASTICSEARCH', 'PINECONE', 'WEAVIATE', 'CHROMA');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedReason" TEXT,
    "realName" VARCHAR(100),
    "phone" VARCHAR(20),
    "department" VARCHAR(100),
    "avatar" VARCHAR(500),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_registrations" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "realName" VARCHAR(100) NOT NULL,
    "reason" TEXT NOT NULL,
    "permissionGroupId" TEXT,
    "status" "UserRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "name" "UserRole" NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenId" VARCHAR(255) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" VARCHAR(45),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" VARCHAR(50),
    "email" VARCHAR(255),
    "action" VARCHAR(50) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'info',
    "category" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "source" VARCHAR(255),
    "userId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR(255) NOT NULL,
    "value" JSONB NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "apiKey" VARCHAR(500) NOT NULL,
    "baseUrl" VARCHAR(500),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "status" "ServerStatus" NOT NULL DEFAULT 'offline',
    "os" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50),
    "location" VARCHAR(100),
    "tags" TEXT[],
    "description" TEXT,
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255),
    "keyPath" VARCHAR(500),
    "lastConnectedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authType" VARCHAR(50) NOT NULL DEFAULT 'password',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "datacenter" VARCHAR(100),
    "groupId" TEXT,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "tags" TEXT[],
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "server_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_metrics" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION,
    "cpuCores" INTEGER,
    "memoryTotal" DOUBLE PRECISION,
    "memoryUsed" DOUBLE PRECISION,
    "diskTotal" DOUBLE PRECISION,
    "diskUsed" DOUBLE PRECISION,
    "networkIn" DOUBLE PRECISION,
    "networkOut" DOUBLE PRECISION,
    "uptime" INTEGER,

    CONSTRAINT "server_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_alerts" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'custom',
    "level" "AlertLevel" NOT NULL DEFAULT 'info',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_logs" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'info',
    "source" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "MessageStatus" NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kibana_dashboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(100),
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kibana_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elk_viewer_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "filters" JSONB,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elk_viewer_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elk_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "username" VARCHAR(100),
    "password" TEXT,
    "indices" JSONB NOT NULL DEFAULT '[]',
    "ssl" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "webUrl" VARCHAR(500),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elk_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grafana_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 3000,
    "protocol" VARCHAR(10) NOT NULL DEFAULT 'http',
    "username" VARCHAR(100),
    "password" TEXT,
    "apiKey" TEXT,
    "orgId" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "tags" JSONB DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grafana_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cicd_projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "repositoryUrl" VARCHAR(500) NOT NULL,
    "repositoryType" VARCHAR(50) NOT NULL,
    "branch" VARCHAR(100) NOT NULL DEFAULT 'main',
    "buildScript" TEXT,
    "deployScript" TEXT,
    "environment" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serverId" TEXT,
    "gitCredentialId" TEXT,
    "buildTimeout" INTEGER,
    "buildTriggers" JSONB,
    "notificationUsers" JSONB,
    "environmentVariables" JSONB,
    "tags" JSONB,
    "approvalUsers" JSONB,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cicd_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "serverUrl" VARCHAR(500) NOT NULL,
    "username" VARCHAR(100),
    "apiToken" VARCHAR(500),
    "webhookUrl" VARCHAR(500),
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "testStatus" VARCHAR(50),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_configs" (
    "id" TEXT NOT NULL,
    "jenkinsConfigId" TEXT NOT NULL,
    "jobName" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(200),
    "description" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvalRoles" JSONB,
    "parameters" JSONB,
    "schedule" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_groups" (
    "id" TEXT NOT NULL,
    "jenkinsConfigId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_group_mappings" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "jobName" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "jenkinsJobName" VARCHAR(200) NOT NULL,
    "parameters" JSONB,
    "triggers" JSONB,
    "stages" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "jenkinsConfigId" TEXT NOT NULL,
    "pipelineId" TEXT,
    "buildNumber" INTEGER NOT NULL,
    "jenkinsJobName" VARCHAR(200) NOT NULL,
    "status" "BuildStatus" NOT NULL DEFAULT 'pending',
    "result" VARCHAR(50),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "queueId" VARCHAR(100),
    "buildUrl" VARCHAR(500),
    "parameters" JSONB,
    "artifacts" JSONB,
    "logs" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "environment" VARCHAR(50) NOT NULL,
    "version" VARCHAR(100),
    "status" "DeploymentStatus" NOT NULL DEFAULT 'pending',
    "buildNumber" INTEGER,
    "deployScript" TEXT,
    "rollbackScript" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "logs" TEXT,
    "config" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,
    "approvalUsers" JSONB,
    "deploymentHosts" JSONB,
    "notificationUsers" JSONB,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "jenkinsJobId" TEXT,
    "buildId" TEXT,
    "isJenkinsDeployment" BOOLEAN NOT NULL DEFAULT false,
    "jenkinsJobIds" JSONB,
    "jenkinsJobName" TEXT,
    "jenkinsBuildNumber" INTEGER,
    "jenkinsQueueId" INTEGER,
    "jenkinsQueueUrl" TEXT,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_approvals" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3),
    "level" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "approvalType" "ApprovalType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" VARCHAR(255) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorName" VARCHAR(100) NOT NULL,
    "action" "ApprovalStatus" NOT NULL,
    "comment" TEXT,
    "operatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "environment" VARCHAR(20) NOT NULL,
    "projectId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_executions" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "jobName" VARCHAR(200) NOT NULL,
    "operationType" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT,
    "parameters" JSONB,
    "executionResult" JSONB,
    "executedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_approvals" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_config_approvers" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_config_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenkins_job_notifiers" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "notifierId" TEXT NOT NULL,
    "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnApprove" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnReject" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnExecute" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnComplete" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jenkins_job_notifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_notifications" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "actionUrl" VARCHAR(500),
    "actionText" VARCHAR(100),
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "info_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_credentials" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "authType" VARCHAR(50) NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "git_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelName" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "apiKey" VARCHAR(500) NOT NULL,
    "baseUrl" VARCHAR(500),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commandValidation" BOOLEAN NOT NULL DEFAULT true,
    "enableToolUseShim" BOOLEAN NOT NULL DEFAULT false,
    "externalTools" BOOLEAN NOT NULL DEFAULT false,
    "mcpClientEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privilegedBlocking" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "skipPermissions" BOOLEAN NOT NULL DEFAULT false,
    "toolConfigPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportsFunctionCalling" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preset_models" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "contextLength" INTEGER,
    "maxTokens" INTEGER,
    "supportedFeatures" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" VARCHAR(50),
    "series" VARCHAR(50),
    "sortOrder" INTEGER DEFAULT 0,
    "releaseDate" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preset_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_model_selections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedModelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_model_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_group_permissions" (
    "groupId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_group_permissions_pkey" PRIMARY KEY ("groupId","permissionId")
);

-- CreateTable
CREATE TABLE "user_permission_groups" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_groups_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "mcp_tools_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "servers" JSONB NOT NULL DEFAULT '[]',
    "discoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoConnect" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_tools_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_tools_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "defaultTimeout" INTEGER NOT NULL DEFAULT 30000,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 5,
    "logLevel" VARCHAR(20) NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_tools_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commandValidation" BOOLEAN NOT NULL DEFAULT true,
    "privilegedCommandBlocking" BOOLEAN NOT NULL DEFAULT true,
    "pathTraversalProtection" BOOLEAN NOT NULL DEFAULT true,
    "commandHistory" BOOLEAN NOT NULL DEFAULT true,
    "auditLogging" BOOLEAN NOT NULL DEFAULT true,
    "rateLimiting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "security_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_configs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "contentSize" INTEGER NOT NULL,
    "changeType" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "changedBy" VARCHAR(100),
    "changeReason" VARCHAR(500),
    "changeDetails" JSONB,
    "previousVersion" INTEGER,
    "diffLines" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "backupPath" VARCHAR(500),
    "backupUrl" VARCHAR(500),
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startPos" INTEGER,
    "endPos" INTEGER,
    "vectorId" VARCHAR(100),
    "isIndexed" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "healing_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "moduleType" "ModuleType" NOT NULL,
    "deviceId" TEXT,
    "serverId" TEXT,
    "triggeredBy" VARCHAR(100) NOT NULL,
    "triggerReason" TEXT,
    "status" "HealingStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "actions" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "rollbackExecuted" BOOLEAN NOT NULL DEFAULT false,
    "rollbackSuccess" BOOLEAN,
    "rollbackDetails" JSONB,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" VARCHAR(100),
    "approvedAt" TIMESTAMP(3),
    "approvalComment" VARCHAR(500),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "healing_rules" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "moduleType" "ModuleType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "triggerType" "HealingTriggerType" NOT NULL,
    "triggerCondition" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxExecutionsPerDay" INTEGER NOT NULL DEFAULT 10,
    "cooldownPeriod" INTEGER NOT NULL DEFAULT 300,
    "rollbackOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "rollbackActions" JSONB,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "notifyChannels" TEXT[],
    "executions" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "healing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_apps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "workflowId" TEXT NOT NULL,
    "llmProviderId" TEXT,
    "llmModel" VARCHAR(100),
    "welcomeMessage" TEXT,
    "suggestedQueries" TEXT[],
    "systemPrompt" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "maxTokens" INTEGER DEFAULT 2000,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "visibility" "AppVisibility" NOT NULL DEFAULT 'PRIVATE',
    "dailyLimit" INTEGER,
    "rateLimitPerMinute" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "embeddingProviderId" TEXT NOT NULL,
    "embeddingModel" VARCHAR(100) NOT NULL,
    "embeddingDimension" INTEGER NOT NULL,
    "vectorDBProviderId" TEXT,
    "collectionName" VARCHAR(100) NOT NULL,
    "chunkSize" INTEGER NOT NULL DEFAULT 500,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 50,
    "separators" TEXT[] DEFAULT ARRAY['\n\n', '\n', '。', '.', ' ']::TEXT[],
    "defaultTopK" INTEGER NOT NULL DEFAULT 5,
    "defaultThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "rerankingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rerankingModel" VARCHAR(100),
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_conversations" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "DocumentType" NOT NULL,
    "mimeType" VARCHAR(100),
    "size" BIGINT NOT NULL,
    "hash" VARCHAR(64),
    "storagePath" VARCHAR(500),
    "content" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "KnowledgeMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "tokenCount" INTEGER,
    "feedback" "MessageFeedback",
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_workflows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "definition" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedVersion" INTEGER,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "ProviderType" NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "baseUrl" VARCHAR(500),
    "apiKey" VARCHAR(500),
    "secretKey" VARCHAR(500),
    "config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "testResult" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_alerts" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "interfaceId" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50),
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "metric" VARCHAR(100),
    "threshold" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" VARCHAR(20),
    "severity" VARCHAR(20),
    "impact" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(100),
    "resolution" TEXT,
    "isNotified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "notifyChannels" TEXT[],
    "relatedAlerts" TEXT[],
    "incidentId" VARCHAR(100),
    "healingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastHealingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_device_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "category" VARCHAR(50),
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_device_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_devices" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(100),
    "type" "DeviceType" NOT NULL,
    "vendor" "DeviceVendor" NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "serialNumber" VARCHAR(100),
    "ip" VARCHAR(45) NOT NULL,
    "snmpPort" INTEGER NOT NULL DEFAULT 161,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "httpPort" INTEGER,
    "httpsPort" INTEGER,
    "sshUsername" VARCHAR(100),
    "sshPassword" VARCHAR(500),
    "sshKeyPath" VARCHAR(500),
    "snmpVersion" VARCHAR(10) NOT NULL DEFAULT 'v2c',
    "snmpCommunity" VARCHAR(100),
    "snmpUsername" VARCHAR(100),
    "snmpAuthPass" VARCHAR(500),
    "snmpPrivPass" VARCHAR(500),
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPolled" TIMESTAMP(3),
    "uptime" BIGINT,
    "lastOnline" TIMESTAMP(3),
    "location" VARCHAR(200),
    "datacenter" VARCHAR(100),
    "rack" VARCHAR(50),
    "rackUnit" INTEGER,
    "building" VARCHAR(100),
    "floor" VARCHAR(50),
    "room" VARCHAR(100),
    "osVersion" VARCHAR(100),
    "firmwareVersion" VARCHAR(100),
    "bootromVersion" VARCHAR(100),
    "hardwareVersion" VARCHAR(100),
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "memoryTotal" BIGINT,
    "temperature" DOUBLE PRECISION,
    "fanStatus" VARCHAR(50),
    "powerStatus" VARCHAR(50),
    "groupId" TEXT,
    "tags" TEXT[],
    "description" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),

    CONSTRAINT "network_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_interfaces" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ifIndex" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "alias" VARCHAR(200),
    "type" VARCHAR(50),
    "macAddress" VARCHAR(20),
    "mtu" INTEGER,
    "ipAddress" VARCHAR(45),
    "subnetMask" VARCHAR(45),
    "ipv6Address" VARCHAR(50),
    "adminStatus" VARCHAR(20) NOT NULL,
    "operStatus" VARCHAR(20) NOT NULL,
    "speed" BIGINT,
    "duplex" VARCHAR(20),
    "vlanId" INTEGER,
    "vlanMode" VARCHAR(20),
    "allowedVlans" VARCHAR(500),
    "nativeVlan" INTEGER,
    "inOctets" BIGINT,
    "outOctets" BIGINT,
    "inUcastPkts" BIGINT,
    "outUcastPkts" BIGINT,
    "inBroadcastPkts" BIGINT,
    "outBroadcastPkts" BIGINT,
    "inErrors" BIGINT,
    "outErrors" BIGINT,
    "inDiscards" BIGINT,
    "outDiscards" BIGINT,
    "crcErrors" BIGINT,
    "bandwidth" BIGINT,
    "utilization" DOUBLE PRECISION,
    "isTrunkMember" BOOLEAN NOT NULL DEFAULT false,
    "trunkId" VARCHAR(50),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_metrics" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "interfaceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION,
    "cpuLoad1" DOUBLE PRECISION,
    "cpuLoad5" DOUBLE PRECISION,
    "cpuLoad15" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "memoryUsed" BIGINT,
    "memoryFree" BIGINT,
    "temperature" DOUBLE PRECISION,
    "fanSpeed" INTEGER,
    "powerConsumption" DOUBLE PRECISION,
    "bandwidth" BIGINT,
    "packetRate" BIGINT,
    "utilization" DOUBLE PRECISION,
    "errorRate" DOUBLE PRECISION,
    "discardRate" DOUBLE PRECISION,
    "arpEntries" INTEGER,
    "macEntries" INTEGER,
    "routeEntries" INTEGER,
    "bgpPeers" INTEGER,
    "ospfNeighbors" INTEGER,
    "tcpConnections" INTEGER,
    "udpConnections" INTEGER,

    CONSTRAINT "network_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_topology" (
    "id" TEXT NOT NULL,
    "sourceDeviceId" TEXT NOT NULL,
    "sourcePort" VARCHAR(100) NOT NULL,
    "sourcePortId" VARCHAR(100),
    "targetDeviceId" TEXT NOT NULL,
    "targetPort" VARCHAR(100) NOT NULL,
    "targetPortId" VARCHAR(100),
    "linkType" VARCHAR(20) NOT NULL,
    "protocol" VARCHAR(20),
    "linkSpeed" BIGINT,
    "discovered" BOOLEAN NOT NULL DEFAULT false,
    "discoveryMethod" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "lastVerified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distance" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_topology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "logs" JSONB,
    "error" TEXT,
    "executionTime" INTEGER,
    "tokenUsage" JSONB,
    "triggeredBy" VARCHAR(100),
    "triggerSource" VARCHAR(50),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_WorkflowKnowledgeBases" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_WorkflowKnowledgeBases_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_approvalStatus_idx" ON "users"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- CreateIndex
CREATE INDEX "permissions_code_idx" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_registrations_username_key" ON "user_registrations"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_registrations_email_key" ON "user_registrations"("email");

-- CreateIndex
CREATE INDEX "user_registrations_status_idx" ON "user_registrations"("status");

-- CreateIndex
CREATE INDEX "user_registrations_submittedAt_idx" ON "user_registrations"("submittedAt");

-- CreateIndex
CREATE INDEX "user_registrations_permissionGroupId_idx" ON "user_registrations"("permissionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refreshTokenId_key" ON "auth_sessions"("refreshTokenId");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_sessions_refreshTokenId_idx" ON "auth_sessions"("refreshTokenId");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_sessions_isActive_idx" ON "auth_sessions"("isActive");

-- CreateIndex
CREATE INDEX "auth_logs_userId_idx" ON "auth_logs"("userId");

-- CreateIndex
CREATE INDEX "auth_logs_action_idx" ON "auth_logs"("action");

-- CreateIndex
CREATE INDEX "auth_logs_success_idx" ON "auth_logs"("success");

-- CreateIndex
CREATE INDEX "auth_logs_timestamp_idx" ON "auth_logs"("timestamp");

-- CreateIndex
CREATE INDEX "system_logs_level_idx" ON "system_logs"("level");

-- CreateIndex
CREATE INDEX "system_logs_category_idx" ON "system_logs"("category");

-- CreateIndex
CREATE INDEX "system_logs_timestamp_idx" ON "system_logs"("timestamp");

-- CreateIndex
CREATE INDEX "system_logs_userId_idx" ON "system_logs"("userId");

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- CreateIndex
CREATE INDEX "system_configs_isPublic_idx" ON "system_configs"("isPublic");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_provider_idx" ON "api_keys"("provider");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "api_keys_isDefault_idx" ON "api_keys"("isDefault");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "servers_userId_idx" ON "servers"("userId");

-- CreateIndex
CREATE INDEX "servers_status_idx" ON "servers"("status");

-- CreateIndex
CREATE INDEX "servers_ip_idx" ON "servers"("ip");

-- CreateIndex
CREATE INDEX "servers_hostname_idx" ON "servers"("hostname");

-- CreateIndex
CREATE INDEX "servers_isDefault_idx" ON "servers"("isDefault");

-- CreateIndex
CREATE INDEX "servers_groupId_idx" ON "servers"("groupId");

-- CreateIndex
CREATE INDEX "server_groups_userId_idx" ON "server_groups"("userId");

-- CreateIndex
CREATE INDEX "server_groups_isActive_idx" ON "server_groups"("isActive");

-- CreateIndex
CREATE INDEX "server_groups_name_idx" ON "server_groups"("name");

-- CreateIndex
CREATE INDEX "server_groups_isDefault_idx" ON "server_groups"("isDefault");

-- CreateIndex
CREATE INDEX "server_metrics_serverId_idx" ON "server_metrics"("serverId");

-- CreateIndex
CREATE INDEX "server_metrics_timestamp_idx" ON "server_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "server_alerts_serverId_idx" ON "server_alerts"("serverId");

-- CreateIndex
CREATE INDEX "server_alerts_level_idx" ON "server_alerts"("level");

-- CreateIndex
CREATE INDEX "server_alerts_isResolved_idx" ON "server_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "server_alerts_createdAt_idx" ON "server_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "server_logs_serverId_idx" ON "server_logs"("serverId");

-- CreateIndex
CREATE INDEX "server_logs_level_idx" ON "server_logs"("level");

-- CreateIndex
CREATE INDEX "server_logs_source_idx" ON "server_logs"("source");

-- CreateIndex
CREATE INDEX "server_logs_timestamp_idx" ON "server_logs"("timestamp");

-- CreateIndex
CREATE INDEX "chat_sessions_userId_idx" ON "chat_sessions"("userId");

-- CreateIndex
CREATE INDEX "chat_sessions_createdAt_idx" ON "chat_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_idx" ON "chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "chat_messages_type_idx" ON "chat_messages"("type");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "kibana_dashboards_userId_idx" ON "kibana_dashboards"("userId");

-- CreateIndex
CREATE INDEX "kibana_dashboards_isTemplate_idx" ON "kibana_dashboards"("isTemplate");

-- CreateIndex
CREATE INDEX "kibana_dashboards_category_idx" ON "kibana_dashboards"("category");

-- CreateIndex
CREATE UNIQUE INDEX "elk_viewer_configs_userId_key" ON "elk_viewer_configs"("userId");

-- CreateIndex
CREATE INDEX "elk_configs_userId_idx" ON "elk_configs"("userId");

-- CreateIndex
CREATE INDEX "elk_configs_isActive_idx" ON "elk_configs"("isActive");

-- CreateIndex
CREATE INDEX "grafana_configs_userId_idx" ON "grafana_configs"("userId");

-- CreateIndex
CREATE INDEX "grafana_configs_isActive_idx" ON "grafana_configs"("isActive");

-- CreateIndex
CREATE INDEX "cicd_projects_userId_idx" ON "cicd_projects"("userId");

-- CreateIndex
CREATE INDEX "cicd_projects_serverId_idx" ON "cicd_projects"("serverId");

-- CreateIndex
CREATE INDEX "cicd_projects_gitCredentialId_idx" ON "cicd_projects"("gitCredentialId");

-- CreateIndex
CREATE INDEX "cicd_projects_isActive_idx" ON "cicd_projects"("isActive");

-- CreateIndex
CREATE INDEX "cicd_projects_environment_idx" ON "cicd_projects"("environment");

-- CreateIndex
CREATE INDEX "jenkins_configs_userId_idx" ON "jenkins_configs"("userId");

-- CreateIndex
CREATE INDEX "jenkins_configs_isActive_idx" ON "jenkins_configs"("isActive");

-- CreateIndex
CREATE INDEX "jenkins_configs_testStatus_idx" ON "jenkins_configs"("testStatus");

-- CreateIndex
CREATE INDEX "jenkins_job_configs_jenkinsConfigId_idx" ON "jenkins_job_configs"("jenkinsConfigId");

-- CreateIndex
CREATE INDEX "jenkins_job_configs_userId_idx" ON "jenkins_job_configs"("userId");

-- CreateIndex
CREATE INDEX "jenkins_job_configs_isActive_idx" ON "jenkins_job_configs"("isActive");

-- CreateIndex
CREATE INDEX "jenkins_job_configs_enabled_idx" ON "jenkins_job_configs"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "jenkins_job_configs_jenkinsConfigId_jobName_key" ON "jenkins_job_configs"("jenkinsConfigId", "jobName");

-- CreateIndex
CREATE INDEX "jenkins_job_groups_jenkinsConfigId_idx" ON "jenkins_job_groups"("jenkinsConfigId");

-- CreateIndex
CREATE INDEX "jenkins_job_groups_userId_idx" ON "jenkins_job_groups"("userId");

-- CreateIndex
CREATE INDEX "jenkins_job_groups_isActive_idx" ON "jenkins_job_groups"("isActive");

-- CreateIndex
CREATE INDEX "jenkins_job_groups_sortOrder_idx" ON "jenkins_job_groups"("sortOrder");

-- CreateIndex
CREATE INDEX "jenkins_job_group_mappings_groupId_idx" ON "jenkins_job_group_mappings"("groupId");

-- CreateIndex
CREATE INDEX "jenkins_job_group_mappings_jobName_idx" ON "jenkins_job_group_mappings"("jobName");

-- CreateIndex
CREATE INDEX "jenkins_job_group_mappings_isActive_idx" ON "jenkins_job_group_mappings"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "jenkins_job_group_mappings_groupId_jobName_key" ON "jenkins_job_group_mappings"("groupId", "jobName");

-- CreateIndex
CREATE INDEX "pipelines_projectId_idx" ON "pipelines"("projectId");

-- CreateIndex
CREATE INDEX "pipelines_userId_idx" ON "pipelines"("userId");

-- CreateIndex
CREATE INDEX "pipelines_isActive_idx" ON "pipelines"("isActive");

-- CreateIndex
CREATE INDEX "builds_jenkinsConfigId_idx" ON "builds"("jenkinsConfigId");

-- CreateIndex
CREATE INDEX "builds_pipelineId_idx" ON "builds"("pipelineId");

-- CreateIndex
CREATE INDEX "builds_userId_idx" ON "builds"("userId");

-- CreateIndex
CREATE INDEX "builds_status_idx" ON "builds"("status");

-- CreateIndex
CREATE INDEX "builds_buildNumber_idx" ON "builds"("buildNumber");

-- CreateIndex
CREATE INDEX "builds_startedAt_idx" ON "builds"("startedAt");

-- CreateIndex
CREATE INDEX "deployments_projectId_idx" ON "deployments"("projectId");

-- CreateIndex
CREATE INDEX "deployments_userId_idx" ON "deployments"("userId");

-- CreateIndex
CREATE INDEX "deployments_templateId_idx" ON "deployments"("templateId");

-- CreateIndex
CREATE INDEX "deployments_buildId_idx" ON "deployments"("buildId");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- CreateIndex
CREATE INDEX "deployments_environment_idx" ON "deployments"("environment");

-- CreateIndex
CREATE INDEX "deployments_requireApproval_idx" ON "deployments"("requireApproval");

-- CreateIndex
CREATE INDEX "deployments_scheduledAt_idx" ON "deployments"("scheduledAt");

-- CreateIndex
CREATE INDEX "deployments_createdAt_idx" ON "deployments"("createdAt");

-- CreateIndex
CREATE INDEX "deployment_approvals_deploymentId_idx" ON "deployment_approvals"("deploymentId");

-- CreateIndex
CREATE INDEX "deployment_approvals_approverId_idx" ON "deployment_approvals"("approverId");

-- CreateIndex
CREATE INDEX "deployment_approvals_status_idx" ON "deployment_approvals"("status");

-- CreateIndex
CREATE INDEX "deployment_approvals_level_idx" ON "deployment_approvals"("level");

-- CreateIndex
CREATE INDEX "approval_records_approvalType_idx" ON "approval_records"("approvalType");

-- CreateIndex
CREATE INDEX "approval_records_targetId_idx" ON "approval_records"("targetId");

-- CreateIndex
CREATE INDEX "approval_records_operatorId_idx" ON "approval_records"("operatorId");

-- CreateIndex
CREATE INDEX "approval_records_action_idx" ON "approval_records"("action");

-- CreateIndex
CREATE INDEX "approval_records_operatedAt_idx" ON "approval_records"("operatedAt");

-- CreateIndex
CREATE INDEX "approval_workflows_environment_idx" ON "approval_workflows"("environment");

-- CreateIndex
CREATE INDEX "approval_workflows_projectId_idx" ON "approval_workflows"("projectId");

-- CreateIndex
CREATE INDEX "approval_workflows_isDefault_idx" ON "approval_workflows"("isDefault");

-- CreateIndex
CREATE INDEX "approval_workflows_userId_idx" ON "approval_workflows"("userId");

-- CreateIndex
CREATE INDEX "jenkins_job_executions_configId_idx" ON "jenkins_job_executions"("configId");

-- CreateIndex
CREATE INDEX "jenkins_job_executions_requestedBy_idx" ON "jenkins_job_executions"("requestedBy");

-- CreateIndex
CREATE INDEX "jenkins_job_executions_status_idx" ON "jenkins_job_executions"("status");

-- CreateIndex
CREATE INDEX "jenkins_job_executions_operationType_idx" ON "jenkins_job_executions"("operationType");

-- CreateIndex
CREATE INDEX "jenkins_job_approvals_executionId_idx" ON "jenkins_job_approvals"("executionId");

-- CreateIndex
CREATE INDEX "jenkins_job_approvals_approverId_idx" ON "jenkins_job_approvals"("approverId");

-- CreateIndex
CREATE INDEX "jenkins_job_approvals_status_idx" ON "jenkins_job_approvals"("status");

-- CreateIndex
CREATE INDEX "jenkins_job_approvals_level_idx" ON "jenkins_job_approvals"("level");

-- CreateIndex
CREATE INDEX "jenkins_config_approvers_configId_idx" ON "jenkins_config_approvers"("configId");

-- CreateIndex
CREATE INDEX "jenkins_config_approvers_approverId_idx" ON "jenkins_config_approvers"("approverId");

-- CreateIndex
CREATE INDEX "jenkins_config_approvers_isActive_idx" ON "jenkins_config_approvers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "jenkins_config_approvers_configId_approverId_key" ON "jenkins_config_approvers"("configId", "approverId");

-- CreateIndex
CREATE INDEX "jenkins_job_notifiers_executionId_idx" ON "jenkins_job_notifiers"("executionId");

-- CreateIndex
CREATE INDEX "jenkins_job_notifiers_notifierId_idx" ON "jenkins_job_notifiers"("notifierId");

-- CreateIndex
CREATE INDEX "jenkins_job_notifiers_isActive_idx" ON "jenkins_job_notifiers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "jenkins_job_notifiers_executionId_notifierId_key" ON "jenkins_job_notifiers"("executionId", "notifierId");

-- CreateIndex
CREATE INDEX "info_notifications_userId_idx" ON "info_notifications"("userId");

-- CreateIndex
CREATE INDEX "info_notifications_type_idx" ON "info_notifications"("type");

-- CreateIndex
CREATE INDEX "info_notifications_isRead_idx" ON "info_notifications"("isRead");

-- CreateIndex
CREATE INDEX "info_notifications_createdAt_idx" ON "info_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "info_notifications_expiresAt_idx" ON "info_notifications"("expiresAt");

-- CreateIndex
CREATE INDEX "git_credentials_userId_idx" ON "git_credentials"("userId");

-- CreateIndex
CREATE INDEX "git_credentials_platform_idx" ON "git_credentials"("platform");

-- CreateIndex
CREATE INDEX "git_credentials_authType_idx" ON "git_credentials"("authType");

-- CreateIndex
CREATE INDEX "git_credentials_isDefault_idx" ON "git_credentials"("isDefault");

-- CreateIndex
CREATE INDEX "git_credentials_isActive_idx" ON "git_credentials"("isActive");

-- CreateIndex
CREATE INDEX "model_configs_userId_idx" ON "model_configs"("userId");

-- CreateIndex
CREATE INDEX "model_configs_provider_idx" ON "model_configs"("provider");

-- CreateIndex
CREATE INDEX "model_configs_isActive_idx" ON "model_configs"("isActive");

-- CreateIndex
CREATE INDEX "model_configs_isDefault_idx" ON "model_configs"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "model_configs_userId_modelName_key" ON "model_configs"("userId", "modelName");

-- CreateIndex
CREATE INDEX "preset_models_provider_idx" ON "preset_models"("provider");

-- CreateIndex
CREATE INDEX "preset_models_isActive_idx" ON "preset_models"("isActive");

-- CreateIndex
CREATE INDEX "preset_models_category_idx" ON "preset_models"("category");

-- CreateIndex
CREATE INDEX "preset_models_series_idx" ON "preset_models"("series");

-- CreateIndex
CREATE INDEX "preset_models_sortOrder_idx" ON "preset_models"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "preset_models_name_provider_key" ON "preset_models"("name", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_model_selections_userId_key" ON "user_model_selections"("userId");

-- CreateIndex
CREATE INDEX "user_model_selections_userId_idx" ON "user_model_selections"("userId");

-- CreateIndex
CREATE INDEX "user_model_selections_selectedModelId_idx" ON "user_model_selections"("selectedModelId");

-- CreateIndex
CREATE INDEX "deployment_templates_type_idx" ON "deployment_templates"("type");

-- CreateIndex
CREATE INDEX "deployment_templates_isActive_idx" ON "deployment_templates"("isActive");

-- CreateIndex
CREATE INDEX "deployment_templates_createdBy_idx" ON "deployment_templates"("createdBy");

-- CreateIndex
CREATE INDEX "deployment_templates_createdAt_idx" ON "deployment_templates"("createdAt");

-- CreateIndex
CREATE INDEX "permission_groups_name_idx" ON "permission_groups"("name");

-- CreateIndex
CREATE INDEX "permission_group_permissions_groupId_idx" ON "permission_group_permissions"("groupId");

-- CreateIndex
CREATE INDEX "permission_group_permissions_permissionId_idx" ON "permission_group_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "user_permission_groups_userId_idx" ON "user_permission_groups"("userId");

-- CreateIndex
CREATE INDEX "user_permission_groups_groupId_idx" ON "user_permission_groups"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tools_configs_userId_key" ON "mcp_tools_configs"("userId");

-- CreateIndex
CREATE INDEX "mcp_tools_configs_userId_idx" ON "mcp_tools_configs"("userId");

-- CreateIndex
CREATE INDEX "mcp_tools_configs_enabled_idx" ON "mcp_tools_configs"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "custom_tools_configs_userId_key" ON "custom_tools_configs"("userId");

-- CreateIndex
CREATE INDEX "custom_tools_configs_userId_idx" ON "custom_tools_configs"("userId");

-- CreateIndex
CREATE INDEX "custom_tools_configs_enabled_idx" ON "custom_tools_configs"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "security_configs_userId_key" ON "security_configs"("userId");

-- CreateIndex
CREATE INDEX "security_configs_userId_idx" ON "security_configs"("userId");

-- CreateIndex
CREATE INDEX "security_configs_enabled_idx" ON "security_configs"("enabled");

-- CreateIndex
CREATE INDEX "device_configs_createdAt_idx" ON "device_configs"("createdAt");

-- CreateIndex
CREATE INDEX "device_configs_deviceId_idx" ON "device_configs"("deviceId");

-- CreateIndex
CREATE INDEX "device_configs_isActive_idx" ON "device_configs"("isActive");

-- CreateIndex
CREATE INDEX "device_configs_version_idx" ON "device_configs"("version");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_isIndexed_idx" ON "document_chunks"("documentId", "isIndexed");

-- CreateIndex
CREATE INDEX "healing_logs_createdAt_idx" ON "healing_logs"("createdAt");

-- CreateIndex
CREATE INDEX "healing_logs_deviceId_idx" ON "healing_logs"("deviceId");

-- CreateIndex
CREATE INDEX "healing_logs_moduleType_idx" ON "healing_logs"("moduleType");

-- CreateIndex
CREATE INDEX "healing_logs_ruleId_idx" ON "healing_logs"("ruleId");

-- CreateIndex
CREATE INDEX "healing_logs_serverId_idx" ON "healing_logs"("serverId");

-- CreateIndex
CREATE INDEX "healing_logs_status_idx" ON "healing_logs"("status");

-- CreateIndex
CREATE INDEX "healing_logs_userId_idx" ON "healing_logs"("userId");

-- CreateIndex
CREATE INDEX "healing_rules_enabled_idx" ON "healing_rules"("enabled");

-- CreateIndex
CREATE INDEX "healing_rules_moduleType_idx" ON "healing_rules"("moduleType");

-- CreateIndex
CREATE INDEX "healing_rules_triggerType_idx" ON "healing_rules"("triggerType");

-- CreateIndex
CREATE INDEX "healing_rules_userId_idx" ON "healing_rules"("userId");

-- CreateIndex
CREATE INDEX "knowledge_apps_llmProviderId_idx" ON "knowledge_apps"("llmProviderId");

-- CreateIndex
CREATE INDEX "knowledge_apps_userId_idx" ON "knowledge_apps"("userId");

-- CreateIndex
CREATE INDEX "knowledge_apps_userId_isPublished_idx" ON "knowledge_apps"("userId", "isPublished");

-- CreateIndex
CREATE INDEX "knowledge_apps_workflowId_idx" ON "knowledge_apps"("workflowId");

-- CreateIndex
CREATE INDEX "knowledge_bases_embeddingProviderId_idx" ON "knowledge_bases"("embeddingProviderId");

-- CreateIndex
CREATE INDEX "knowledge_bases_userId_idx" ON "knowledge_bases"("userId");

-- CreateIndex
CREATE INDEX "knowledge_bases_userId_status_idx" ON "knowledge_bases"("userId", "status");

-- CreateIndex
CREATE INDEX "knowledge_bases_vectorDBProviderId_idx" ON "knowledge_bases"("vectorDBProviderId");

-- CreateIndex
CREATE INDEX "knowledge_conversations_applicationId_idx" ON "knowledge_conversations"("applicationId");

-- CreateIndex
CREATE INDEX "knowledge_conversations_userId_idx" ON "knowledge_conversations"("userId");

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledgeBaseId_idx" ON "knowledge_documents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledgeBaseId_status_idx" ON "knowledge_documents"("knowledgeBaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_knowledgeBaseId_hash_key" ON "knowledge_documents"("knowledgeBaseId", "hash");

-- CreateIndex
CREATE INDEX "knowledge_messages_conversationId_idx" ON "knowledge_messages"("conversationId");

-- CreateIndex
CREATE INDEX "knowledge_workflows_userId_idx" ON "knowledge_workflows"("userId");

-- CreateIndex
CREATE INDEX "knowledge_workflows_userId_status_idx" ON "knowledge_workflows"("userId", "status");

-- CreateIndex
CREATE INDEX "model_providers_isActive_idx" ON "model_providers"("isActive");

-- CreateIndex
CREATE INDEX "model_providers_userId_category_idx" ON "model_providers"("userId", "category");

-- CreateIndex
CREATE INDEX "model_providers_userId_idx" ON "model_providers"("userId");

-- CreateIndex
CREATE INDEX "network_alerts_createdAt_idx" ON "network_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "network_alerts_deviceId_idx" ON "network_alerts"("deviceId");

-- CreateIndex
CREATE INDEX "network_alerts_interfaceId_idx" ON "network_alerts"("interfaceId");

-- CreateIndex
CREATE INDEX "network_alerts_isResolved_idx" ON "network_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "network_alerts_level_idx" ON "network_alerts"("level");

-- CreateIndex
CREATE INDEX "network_alerts_type_idx" ON "network_alerts"("type");

-- CreateIndex
CREATE INDEX "network_device_groups_category_idx" ON "network_device_groups"("category");

-- CreateIndex
CREATE INDEX "network_device_groups_parentId_idx" ON "network_device_groups"("parentId");

-- CreateIndex
CREATE INDEX "network_device_groups_userId_idx" ON "network_device_groups"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "network_devices_ip_key" ON "network_devices"("ip");

-- CreateIndex
CREATE INDEX "network_devices_datacenter_idx" ON "network_devices"("datacenter");

-- CreateIndex
CREATE INDEX "network_devices_groupId_idx" ON "network_devices"("groupId");

-- CreateIndex
CREATE INDEX "network_devices_ip_idx" ON "network_devices"("ip");

-- CreateIndex
CREATE INDEX "network_devices_isActive_idx" ON "network_devices"("isActive");

-- CreateIndex
CREATE INDEX "network_devices_status_idx" ON "network_devices"("status");

-- CreateIndex
CREATE INDEX "network_devices_type_idx" ON "network_devices"("type");

-- CreateIndex
CREATE INDEX "network_devices_userId_idx" ON "network_devices"("userId");

-- CreateIndex
CREATE INDEX "network_devices_vendor_idx" ON "network_devices"("vendor");

-- CreateIndex
CREATE INDEX "network_interfaces_deviceId_idx" ON "network_interfaces"("deviceId");

-- CreateIndex
CREATE INDEX "network_interfaces_name_idx" ON "network_interfaces"("name");

-- CreateIndex
CREATE INDEX "network_interfaces_operStatus_idx" ON "network_interfaces"("operStatus");

-- CreateIndex
CREATE UNIQUE INDEX "network_interfaces_deviceId_ifIndex_key" ON "network_interfaces"("deviceId", "ifIndex");

-- CreateIndex
CREATE INDEX "network_metrics_deviceId_idx" ON "network_metrics"("deviceId");

-- CreateIndex
CREATE INDEX "network_metrics_interfaceId_idx" ON "network_metrics"("interfaceId");

-- CreateIndex
CREATE INDEX "network_metrics_timestamp_idx" ON "network_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "network_topology_sourceDeviceId_idx" ON "network_topology"("sourceDeviceId");

-- CreateIndex
CREATE INDEX "network_topology_status_idx" ON "network_topology"("status");

-- CreateIndex
CREATE INDEX "network_topology_targetDeviceId_idx" ON "network_topology"("targetDeviceId");

-- CreateIndex
CREATE INDEX "workflow_executions_startedAt_idx" ON "workflow_executions"("startedAt");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_status_idx" ON "workflow_executions"("workflowId", "status");

-- CreateIndex
CREATE INDEX "_WorkflowKnowledgeBases_B_index" ON "_WorkflowKnowledgeBases"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_logs" ADD CONSTRAINT "auth_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "server_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_groups" ADD CONSTRAINT "server_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_metrics" ADD CONSTRAINT "server_metrics_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_alerts" ADD CONSTRAINT "server_alerts_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_logs" ADD CONSTRAINT "server_logs_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kibana_dashboards" ADD CONSTRAINT "kibana_dashboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elk_viewer_configs" ADD CONSTRAINT "elk_viewer_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elk_configs" ADD CONSTRAINT "elk_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grafana_configs" ADD CONSTRAINT "grafana_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_projects" ADD CONSTRAINT "cicd_projects_gitCredentialId_fkey" FOREIGN KEY ("gitCredentialId") REFERENCES "git_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_projects" ADD CONSTRAINT "cicd_projects_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_projects" ADD CONSTRAINT "cicd_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_configs" ADD CONSTRAINT "jenkins_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_configs" ADD CONSTRAINT "jenkins_job_configs_jenkinsConfigId_fkey" FOREIGN KEY ("jenkinsConfigId") REFERENCES "jenkins_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_configs" ADD CONSTRAINT "jenkins_job_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_groups" ADD CONSTRAINT "jenkins_job_groups_jenkinsConfigId_fkey" FOREIGN KEY ("jenkinsConfigId") REFERENCES "jenkins_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_groups" ADD CONSTRAINT "jenkins_job_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_group_mappings" ADD CONSTRAINT "jenkins_job_group_mappings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "jenkins_job_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cicd_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_jenkinsConfigId_fkey" FOREIGN KEY ("jenkinsConfigId") REFERENCES "jenkins_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cicd_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "deployment_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_approvals" ADD CONSTRAINT "deployment_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_approvals" ADD CONSTRAINT "deployment_approvals_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cicd_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_executions" ADD CONSTRAINT "jenkins_job_executions_configId_fkey" FOREIGN KEY ("configId") REFERENCES "jenkins_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_executions" ADD CONSTRAINT "jenkins_job_executions_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_approvals" ADD CONSTRAINT "jenkins_job_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_approvals" ADD CONSTRAINT "jenkins_job_approvals_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "jenkins_job_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_config_approvers" ADD CONSTRAINT "jenkins_config_approvers_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_config_approvers" ADD CONSTRAINT "jenkins_config_approvers_configId_fkey" FOREIGN KEY ("configId") REFERENCES "jenkins_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_notifiers" ADD CONSTRAINT "jenkins_job_notifiers_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "jenkins_job_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenkins_job_notifiers" ADD CONSTRAINT "jenkins_job_notifiers_notifierId_fkey" FOREIGN KEY ("notifierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_notifications" ADD CONSTRAINT "info_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_credentials" ADD CONSTRAINT "git_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_selections" ADD CONSTRAINT "user_model_selections_selectedModelId_fkey" FOREIGN KEY ("selectedModelId") REFERENCES "model_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_selections" ADD CONSTRAINT "user_model_selections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_templates" ADD CONSTRAINT "deployment_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tools_configs" ADD CONSTRAINT "mcp_tools_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_tools_configs" ADD CONSTRAINT "custom_tools_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_configs" ADD CONSTRAINT "security_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "network_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healing_logs" ADD CONSTRAINT "healing_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "network_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healing_logs" ADD CONSTRAINT "healing_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "healing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healing_logs" ADD CONSTRAINT "healing_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healing_rules" ADD CONSTRAINT "healing_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apps" ADD CONSTRAINT "knowledge_apps_llmProviderId_fkey" FOREIGN KEY ("llmProviderId") REFERENCES "model_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apps" ADD CONSTRAINT "knowledge_apps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apps" ADD CONSTRAINT "knowledge_apps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "knowledge_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_embeddingProviderId_fkey" FOREIGN KEY ("embeddingProviderId") REFERENCES "model_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_vectorDBProviderId_fkey" FOREIGN KEY ("vectorDBProviderId") REFERENCES "model_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_conversations" ADD CONSTRAINT "knowledge_conversations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "knowledge_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_conversations" ADD CONSTRAINT "knowledge_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_messages" ADD CONSTRAINT "knowledge_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "knowledge_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_workflows" ADD CONSTRAINT "knowledge_workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alerts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "network_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_device_groups" ADD CONSTRAINT "network_device_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_devices" ADD CONSTRAINT "network_devices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "network_device_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_devices" ADD CONSTRAINT "network_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_interfaces" ADD CONSTRAINT "network_interfaces_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "network_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_metrics" ADD CONSTRAINT "network_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "network_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_topology" ADD CONSTRAINT "network_topology_sourceDeviceId_fkey" FOREIGN KEY ("sourceDeviceId") REFERENCES "network_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "knowledge_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkflowKnowledgeBases" ADD CONSTRAINT "_WorkflowKnowledgeBases_A_fkey" FOREIGN KEY ("A") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkflowKnowledgeBases" ADD CONSTRAINT "_WorkflowKnowledgeBases_B_fkey" FOREIGN KEY ("B") REFERENCES "knowledge_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
