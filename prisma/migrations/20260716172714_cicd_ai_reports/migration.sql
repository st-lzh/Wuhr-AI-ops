-- CreateTable
CREATE TABLE "cicd_ai_reports" (
    "id" TEXT NOT NULL,
    "reportType" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'generating',
    "verdict" VARCHAR(30) NOT NULL DEFAULT 'unknown',
    "riskLevel" VARCHAR(30) NOT NULL DEFAULT 'unknown',
    "summary" TEXT,
    "analysis" TEXT,
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "qualityGate" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "rawResponse" TEXT,
    "error" TEXT,
    "promptVersion" VARCHAR(50) NOT NULL DEFAULT 'cicd-report-v1',
    "modelProvider" VARCHAR(100),
    "modelName" VARCHAR(200),
    "modelConfigId" TEXT,
    "projectId" TEXT,
    "pipelineId" TEXT,
    "buildId" TEXT,
    "deploymentId" TEXT,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cicd_ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cicd_ai_reports_reportType_idx" ON "cicd_ai_reports"("reportType");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_status_idx" ON "cicd_ai_reports"("status");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_verdict_idx" ON "cicd_ai_reports"("verdict");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_projectId_idx" ON "cicd_ai_reports"("projectId");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_pipelineId_idx" ON "cicd_ai_reports"("pipelineId");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_buildId_idx" ON "cicd_ai_reports"("buildId");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_deploymentId_idx" ON "cicd_ai_reports"("deploymentId");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_userId_idx" ON "cicd_ai_reports"("userId");

-- CreateIndex
CREATE INDEX "cicd_ai_reports_createdAt_idx" ON "cicd_ai_reports"("createdAt");

-- AddForeignKey
ALTER TABLE "cicd_ai_reports" ADD CONSTRAINT "cicd_ai_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cicd_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_ai_reports" ADD CONSTRAINT "cicd_ai_reports_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_ai_reports" ADD CONSTRAINT "cicd_ai_reports_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_ai_reports" ADD CONSTRAINT "cicd_ai_reports_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cicd_ai_reports" ADD CONSTRAINT "cicd_ai_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
