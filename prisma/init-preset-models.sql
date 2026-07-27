-- Wuhr AI Ops model provider catalog and recommended model seed.
--
-- This file is intentionally idempotent. It stores provider metadata separately
-- from model service connections (API keys / Base URLs) and keeps old preset
-- rows for history while only exposing the current recommended entries.

INSERT INTO model_provider_catalogs (
  id, "displayName", adapter, "defaultBaseUrl", "apiKeyRequired",
  "baseUrlEditable", "supportsModelDiscovery", "docsUrl", description,
  color, "isActive", "sortOrder", "createdAt", "updatedAt"
)
VALUES
  ('openai', 'OpenAI', 'openai', 'https://api.openai.com/v1', true, false, true, 'https://platform.openai.com/docs/api-reference/models', 'OpenAI 官方模型服务', '#10A37F', true, 10, NOW(), NOW()),
  ('anthropic', 'Anthropic Claude', 'openai-compatible', 'https://api.anthropic.com/v1', true, false, true, 'https://platform.claude.com/docs/en/about-claude/models/overview', 'Claude 官方 API（使用官方 OpenAI SDK 兼容层）', '#D97757', true, 20, NOW(), NOW()),
  ('gemini', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', true, false, true, 'https://ai.google.dev/gemini-api/docs/models', 'Google Gemini API', '#4285F4', true, 30, NOW(), NOW()),
  ('deepseek', 'DeepSeek', 'deepseek', 'https://api.deepseek.com', true, false, true, 'https://api-docs.deepseek.com/', 'DeepSeek 官方模型服务', '#4D6BFE', true, 40, NOW(), NOW()),
  ('qwen', '阿里云百炼 / Qwen', 'qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', true, true, true, 'https://help.aliyun.com/zh/model-studio/text-generation-model', '阿里云百炼通义千问；工作空间地址可按地域修改', '#FF6A00', true, 50, NOW(), NOW()),
  ('zhipu', '智谱 AI / GLM', 'openai-compatible', 'https://open.bigmodel.cn/api/paas/v4', true, false, true, 'https://docs.bigmodel.cn/cn/guide/start/model-overview', '智谱 BigModel OpenAI 兼容服务', '#2F54EB', true, 60, NOW(), NOW()),
  ('doubao', '火山方舟 / 豆包', 'doubao', 'https://ark.cn-beijing.volces.com/api/v3', true, true, false, 'https://www.volcengine.com/docs/82379', '火山方舟模型服务；支持模型 ID 或推理接入点 ID', '#7C3AED', true, 70, NOW(), NOW()),
  ('minimax', 'MiniMax', 'openai-compatible', 'https://api.minimaxi.com/v1', true, false, true, 'https://platform.minimaxi.com/docs/api-reference/api-overview', 'MiniMax 开放平台 OpenAI 兼容服务', '#F97316', true, 80, NOW(), NOW()),
  ('moonshot', 'Moonshot / Kimi', 'openai-compatible', 'https://api.moonshot.cn/v1', true, false, true, 'https://platform.kimi.com/docs/overview', 'Kimi API OpenAI 兼容服务', '#111827', true, 90, NOW(), NOW()),
  ('siliconflow', '硅基流动 SiliconFlow', 'openai-compatible', 'https://api.siliconflow.cn/v1', true, false, true, 'https://docs.siliconflow.cn/cn/userguide/quickstart', '聚合多种开源模型的 OpenAI 兼容平台', '#6366F1', true, 100, NOW(), NOW()),
  ('openrouter', 'OpenRouter', 'openai-compatible', 'https://openrouter.ai/api/v1', true, false, true, 'https://openrouter.ai/docs/quickstart', '统一访问多家模型的 OpenAI 兼容平台', '#0F172A', true, 110, NOW(), NOW()),
  ('openai-compatible', 'OpenAI Compatible', 'openai-compatible', NULL, true, true, true, 'https://platform.openai.com/docs/api-reference/chat', '任意 OpenAI Chat Completions 兼容端点', '#64748B', true, 120, NOW(), NOW()),
  ('ollama', 'Ollama', 'openai-compatible', 'http://127.0.0.1:11434/v1', false, true, true, 'https://docs.ollama.com/api/openai-compatibility', '本地 Ollama OpenAI 兼容服务', '#171717', true, 130, NOW(), NOW()),
  ('vllm', 'vLLM', 'openai-compatible', 'http://127.0.0.1:8000/v1', false, true, true, 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html', '自托管 vLLM OpenAI 兼容服务', '#22C55E', true, 140, NOW(), NOW()),
  ('local-deployment', '其他本地部署', 'openai-compatible', NULL, false, true, true, NULL, '自定义本地或内网 OpenAI 兼容服务', '#16A34A', true, 150, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  adapter = EXCLUDED.adapter,
  "defaultBaseUrl" = EXCLUDED."defaultBaseUrl",
  "apiKeyRequired" = EXCLUDED."apiKeyRequired",
  "baseUrlEditable" = EXCLUDED."baseUrlEditable",
  "supportsModelDiscovery" = EXCLUDED."supportsModelDiscovery",
  "docsUrl" = EXCLUDED."docsUrl",
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- Keep historical records but do not offer stale entries in new connection flows.
UPDATE preset_models
SET "isActive" = false, "updatedAt" = NOW()
WHERE provider IN (
  'openai', 'anthropic', 'gemini', 'deepseek', 'qwen', 'zhipu', 'doubao',
  'minimax', 'moonshot', 'siliconflow', 'openrouter', 'openai-compatible'
);

INSERT INTO preset_models (
  id, name, "displayName", provider, description, "contextLength", "maxTokens",
  "supportedFeatures", "isActive", category, series, "sortOrder", tags,
  "createdAt", "updatedAt"
)
VALUES
  ('seed_openai_gpt_52', 'gpt-5.2', 'GPT-5.2', 'openai', 'OpenAI 通用旗舰模型', NULL, NULL, ARRAY['chat','streaming','function-calling'], true, 'chat', 'gpt-5', 101, ARRAY['recommended'], NOW(), NOW()),
  ('seed_openai_gpt_5_mini', 'gpt-5-mini', 'GPT-5 mini', 'openai', '低成本、低延迟通用模型', NULL, NULL, ARRAY['chat','streaming','function-calling'], true, 'chat', 'gpt-5', 102, ARRAY['fast'], NOW(), NOW()),
  ('seed_openai_gpt_5_nano', 'gpt-5-nano', 'GPT-5 nano', 'openai', '高吞吐轻量模型', NULL, NULL, ARRAY['chat','streaming'], true, 'chat', 'gpt-5', 103, ARRAY['economical'], NOW(), NOW()),

  ('seed_anthropic_fable_5', 'claude-fable-5', 'Claude Fable 5', 'anthropic', '长程 Agent 与高难推理', 1000000, 128000, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'reasoning', 'claude-5', 201, ARRAY['frontier'], NOW(), NOW()),
  ('seed_anthropic_opus_48', 'claude-opus-4-8', 'Claude Opus 4.8', 'anthropic', '复杂 Agent 编程与企业任务', 1000000, 128000, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'reasoning', 'claude-4', 202, ARRAY['recommended'], NOW(), NOW()),
  ('seed_anthropic_sonnet_5', 'claude-sonnet-5', 'Claude Sonnet 5', 'anthropic', '速度与能力均衡', 1000000, 128000, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'chat', 'claude-5', 203, ARRAY['recommended'], NOW(), NOW()),
  ('seed_anthropic_haiku_45', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic', '高速度、低成本', 200000, 64000, ARRAY['chat','streaming','vision','function-calling'], true, 'chat', 'claude-4', 204, ARRAY['fast'], NOW(), NOW()),

  ('seed_gemini_35_flash', 'gemini-3.5-flash', 'Gemini 3.5 Flash', 'gemini', '稳定版 Agent 与编程模型', 1048576, 65536, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'multimodal', 'gemini-3', 301, ARRAY['recommended','stable'], NOW(), NOW()),
  ('seed_gemini_31_pro', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', 'gemini', '复杂推理与多模态预览模型', NULL, NULL, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'multimodal', 'gemini-3', 302, ARRAY['preview'], NOW(), NOW()),
  ('seed_gemini_31_flash_lite', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 'gemini', '稳定轻量模型', NULL, NULL, ARRAY['chat','streaming','vision','function-calling'], true, 'multimodal', 'gemini-3', 303, ARRAY['stable','fast'], NOW(), NOW()),
  ('seed_gemini_25_flash', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'gemini', '成熟的高性价比多模态模型', 1048576, NULL, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'multimodal', 'gemini-2.5', 304, ARRAY['stable'], NOW(), NOW()),

  ('seed_deepseek_v4_pro', 'deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', 'DeepSeek V4 高能力版本', 1000000, 393216, ARRAY['chat','streaming','function-calling','reasoning','json-output'], true, 'reasoning', 'deepseek-v4', 401, ARRAY['recommended'], NOW(), NOW()),
  ('seed_deepseek_v4_flash', 'deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek', 'DeepSeek V4 高性价比版本', 1000000, 393216, ARRAY['chat','streaming','function-calling','reasoning','json-output'], true, 'reasoning', 'deepseek-v4', 402, ARRAY['fast'], NOW(), NOW()),

  ('seed_qwen_37_max', 'qwen3.7-max', 'Qwen 3.7 Max', 'qwen', '百炼最强推理模型', 1000000, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'qwen3.7', 501, ARRAY['recommended'], NOW(), NOW()),
  ('seed_qwen_37_plus', 'qwen3.7-plus', 'Qwen 3.7 Plus', 'qwen', 'Agent 与编程的能力成本均衡型号', 1000000, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'chat', 'qwen3.7', 502, ARRAY['recommended'], NOW(), NOW()),
  ('seed_qwen_36_flash', 'qwen3.6-flash', 'Qwen 3.6 Flash', 'qwen', '低成本、低延迟型号', 1000000, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'chat', 'qwen3.6', 503, ARRAY['fast'], NOW(), NOW()),

  ('seed_zhipu_glm_52', 'glm-5.2', 'GLM-5.2', 'zhipu', '智谱新一代旗舰模型', 1000000, NULL, ARRAY['chat','streaming','function-calling','reasoning','json-output'], true, 'reasoning', 'glm-5', 601, ARRAY['recommended'], NOW(), NOW()),
  ('seed_zhipu_glm_51', 'glm-5.1', 'GLM-5.1', 'zhipu', '智谱高能力通用模型', NULL, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'glm-5', 602, ARRAY['stable'], NOW(), NOW()),
  ('seed_zhipu_glm_47', 'glm-4.7', 'GLM-4.7', 'zhipu', '成熟通用 Agent 模型', NULL, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'chat', 'glm-4', 603, ARRAY['stable'], NOW(), NOW()),

  ('seed_doubao_20_lite', 'doubao-seed-2-0-lite-260215', 'Doubao Seed 2.0 Lite', 'doubao', '豆包 Seed 2.0 轻量模型；也可填写方舟推理接入点 ID', NULL, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'chat', 'doubao-seed-2', 701, ARRAY['recommended'], NOW(), NOW()),

  ('seed_minimax_m27', 'MiniMax-M2.7', 'MiniMax M2.7', 'minimax', 'MiniMax 当前主力 Agent 模型', 204800, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'minimax-m2', 801, ARRAY['recommended'], NOW(), NOW()),
  ('seed_minimax_m27_fast', 'MiniMax-M2.7-highspeed', 'MiniMax M2.7 Highspeed', 'minimax', 'M2.7 高速版', 204800, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'minimax-m2', 802, ARRAY['fast'], NOW(), NOW()),
  ('seed_minimax_m25', 'MiniMax-M2.5', 'MiniMax M2.5', 'minimax', '高性价比通用模型', 204800, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'minimax-m2', 803, ARRAY['stable'], NOW(), NOW()),

  ('seed_kimi_k27_code', 'kimi-k2.7-code', 'Kimi K2.7 Code', 'moonshot', 'Kimi 编程 Agent 模型', 262144, NULL, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'code', 'kimi-k2', 901, ARRAY['recommended'], NOW(), NOW()),
  ('seed_kimi_k27_code_fast', 'kimi-k2.7-code-highspeed', 'Kimi K2.7 Code Highspeed', 'moonshot', 'Kimi K2.7 Code 高速版', 262144, NULL, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'code', 'kimi-k2', 902, ARRAY['fast'], NOW(), NOW()),
  ('seed_kimi_k26', 'kimi-k2.6', 'Kimi K2.6', 'moonshot', '通用多模态 Agent 模型', 262144, NULL, ARRAY['chat','streaming','vision','function-calling','reasoning'], true, 'multimodal', 'kimi-k2', 903, ARRAY['recommended'], NOW(), NOW()),

  ('seed_sf_glm_5', 'Pro/zai-org/GLM-5', 'GLM-5 Pro (SiliconFlow)', 'siliconflow', '硅基流动托管 GLM-5', NULL, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'siliconflow', 1001, ARRAY['hosted'], NOW(), NOW()),
  ('seed_sf_glm_47', 'Pro/zai-org/GLM-4.7', 'GLM-4.7 Pro (SiliconFlow)', 'siliconflow', '硅基流动托管 GLM-4.7', NULL, NULL, ARRAY['chat','streaming','function-calling','reasoning'], true, 'reasoning', 'siliconflow', 1002, ARRAY['hosted'], NOW(), NOW()),
  ('seed_sf_deepseek_v32', 'deepseek-ai/DeepSeek-V3.2', 'DeepSeek V3.2 (SiliconFlow)', 'siliconflow', '硅基流动托管 DeepSeek V3.2', NULL, NULL, ARRAY['chat','streaming','reasoning'], true, 'reasoning', 'siliconflow', 1003, ARRAY['open-source'], NOW(), NOW()),
  ('seed_sf_qwen3_32b', 'Qwen/Qwen3-32B', 'Qwen3 32B (SiliconFlow)', 'siliconflow', '硅基流动托管 Qwen3 32B', NULL, NULL, ARRAY['chat','streaming','reasoning'], true, 'chat', 'siliconflow', 1004, ARRAY['open-source'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  "isActive" = EXCLUDED."isActive",
  category = EXCLUDED.category,
  series = EXCLUDED.series,
  "sortOrder" = EXCLUDED."sortOrder",
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();
