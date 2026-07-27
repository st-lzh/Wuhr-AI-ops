-- Separate the public provider catalog from team model service connections.
CREATE TABLE "model_provider_catalogs" (
    "id" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "adapter" VARCHAR(50) NOT NULL,
    "defaultBaseUrl" VARCHAR(500),
    "apiKeyRequired" BOOLEAN NOT NULL DEFAULT true,
    "baseUrlEditable" BOOLEAN NOT NULL DEFAULT false,
    "supportsModelDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "docsUrl" VARCHAR(500),
    "description" TEXT,
    "color" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "model_provider_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "model_provider_catalogs_isActive_idx" ON "model_provider_catalogs"("isActive");
CREATE INDEX "model_provider_catalogs_sortOrder_idx" ON "model_provider_catalogs"("sortOrder");

-- Providers must exist before the foreign keys are added. Full metadata and
-- recommended models are refreshed by prisma/init-preset-models.sql.
INSERT INTO "model_provider_catalogs" (
  "id", "displayName", "adapter", "defaultBaseUrl", "apiKeyRequired",
  "baseUrlEditable", "supportsModelDiscovery", "description", "isActive",
  "sortOrder", "createdAt", "updatedAt"
)
VALUES
  ('openai', 'OpenAI', 'openai', 'https://api.openai.com/v1', true, false, true, 'OpenAI 官方模型服务', true, 10, NOW(), NOW()),
  ('anthropic', 'Anthropic Claude', 'openai-compatible', 'https://api.anthropic.com/v1', true, false, true, 'Claude 官方 API', true, 20, NOW(), NOW()),
  ('gemini', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', true, false, true, 'Google Gemini API', true, 30, NOW(), NOW()),
  ('deepseek', 'DeepSeek', 'deepseek', 'https://api.deepseek.com', true, false, true, 'DeepSeek 官方模型服务', true, 40, NOW(), NOW()),
  ('qwen', '阿里云百炼 / Qwen', 'qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', true, true, true, '阿里云百炼通义千问', true, 50, NOW(), NOW()),
  ('zhipu', '智谱 AI / GLM', 'openai-compatible', 'https://open.bigmodel.cn/api/paas/v4', true, false, true, '智谱 BigModel', true, 60, NOW(), NOW()),
  ('doubao', '火山方舟 / 豆包', 'doubao', 'https://ark.cn-beijing.volces.com/api/v3', true, true, false, '火山方舟模型服务', true, 70, NOW(), NOW()),
  ('minimax', 'MiniMax', 'openai-compatible', 'https://api.minimaxi.com/v1', true, false, true, 'MiniMax 开放平台', true, 80, NOW(), NOW()),
  ('moonshot', 'Moonshot / Kimi', 'openai-compatible', 'https://api.moonshot.cn/v1', true, false, true, 'Kimi API', true, 90, NOW(), NOW()),
  ('siliconflow', '硅基流动 SiliconFlow', 'openai-compatible', 'https://api.siliconflow.cn/v1', true, false, true, '开源模型聚合平台', true, 100, NOW(), NOW()),
  ('openrouter', 'OpenRouter', 'openai-compatible', 'https://openrouter.ai/api/v1', true, false, true, '多厂商统一模型 API', true, 110, NOW(), NOW()),
  ('openai-compatible', 'OpenAI Compatible', 'openai-compatible', NULL, true, true, true, '任意 OpenAI 兼容端点', true, 120, NOW(), NOW()),
  ('ollama', 'Ollama', 'openai-compatible', 'http://127.0.0.1:11434/v1', false, true, true, '本地 Ollama 服务', true, 130, NOW(), NOW()),
  ('vllm', 'vLLM', 'openai-compatible', 'http://127.0.0.1:8000/v1', false, true, true, '自托管 vLLM 服务', true, 140, NOW(), NOW()),
  ('local-deployment', '其他本地部署', 'openai-compatible', NULL, false, true, true, '本地或内网兼容服务', true, 150, NOW(), NOW());

ALTER TABLE "model_providers" ADD COLUMN "providerKey" VARCHAR(50);
ALTER TABLE "model_providers" ADD COLUMN "adapter" VARCHAR(50);

UPDATE "model_providers"
SET
  "providerKey" = CASE "type"::text
    WHEN 'OPENAI' THEN 'openai'
    WHEN 'ANTHROPIC' THEN 'anthropic'
    WHEN 'QWEN' THEN 'qwen'
    WHEN 'OLLAMA' THEN 'ollama'
    WHEN 'VLLM' THEN 'vllm'
    ELSE 'openai-compatible'
  END,
  "adapter" = CASE "type"::text
    WHEN 'OPENAI' THEN 'openai'
    WHEN 'QWEN' THEN 'qwen'
    ELSE 'openai-compatible'
  END;

ALTER TABLE "model_providers" ALTER COLUMN "providerKey" SET DEFAULT 'openai-compatible';
ALTER TABLE "model_providers" ALTER COLUMN "providerKey" SET NOT NULL;
ALTER TABLE "model_providers" ALTER COLUMN "adapter" SET DEFAULT 'openai-compatible';
ALTER TABLE "model_providers" ALTER COLUMN "adapter" SET NOT NULL;

ALTER TABLE "model_configs" ADD COLUMN "providerConnectionId" TEXT;

-- Convert every legacy per-model credential into a reusable team connection.
INSERT INTO "model_providers" (
  "id", "userId", "name", "type", "category", "baseUrl", "apiKey",
  "config", "isDefault", "isActive", "createdAt", "updatedAt",
  "providerKey", "adapter"
)
SELECT
  'legacy_' || md5(mc."userId" || '|' || mc."provider" || '|' || COALESCE(mc."baseUrl", '') || '|' || mc."apiKey"),
  MIN(mc."userId"),
  CASE mc."provider"
    WHEN 'deepseek' THEN 'DeepSeek（历史配置）'
    WHEN 'gemini' THEN 'Google Gemini（历史配置）'
    WHEN 'qwen' THEN '阿里云百炼（历史配置）'
    WHEN 'doubao' THEN '火山方舟（历史配置）'
    ELSE 'OpenAI Compatible（历史配置）'
  END,
  (CASE mc."provider"
    WHEN 'qwen' THEN 'QWEN'
    ELSE 'OPENAI_COMPATIBLE'
  END)::"ProviderType",
  'LLM'::"ProviderCategory",
  mc."baseUrl",
  mc."apiKey",
  jsonb_build_object('credentialsEncrypted', false, 'migratedFromModelConfig', true),
  BOOL_OR(mc."isDefault"),
  true,
  MIN(mc."createdAt"),
  NOW(),
  CASE WHEN mc."provider" IN ('deepseek','gemini','qwen','doubao','openai','anthropic') THEN mc."provider" ELSE 'openai-compatible' END,
  mc."provider"
FROM "model_configs" mc
GROUP BY mc."userId", mc."provider", mc."baseUrl", mc."apiKey"
ON CONFLICT ("id") DO NOTHING;

UPDATE "model_configs" mc
SET "providerConnectionId" = 'legacy_' || md5(mc."userId" || '|' || mc."provider" || '|' || COALESCE(mc."baseUrl", '') || '|' || mc."apiKey");

DROP INDEX IF EXISTS "model_configs_userId_modelName_key";
CREATE UNIQUE INDEX "model_configs_providerConnectionId_modelName_key" ON "model_configs"("providerConnectionId", "modelName");
CREATE INDEX "model_configs_providerConnectionId_idx" ON "model_configs"("providerConnectionId");
CREATE INDEX "model_providers_providerKey_idx" ON "model_providers"("providerKey");

ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_providerKey_fkey"
  FOREIGN KEY ("providerKey") REFERENCES "model_provider_catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "model_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preset_models" ADD CONSTRAINT "preset_models_provider_fkey"
  FOREIGN KEY ("provider") REFERENCES "model_provider_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
