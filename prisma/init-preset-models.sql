-- Preset AI Models Initialization
-- Includes mainstream models: DeepSeek, Doubao, Qwen, OpenAI, Claude, Gemini
--
-- Clear existing data (optional)
-- TRUNCATE TABLE preset_models;

-- DeepSeek Models
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('deepseek_chat', 'deepseek-chat', 'DeepSeek Chat', 'deepseek', 'DeepSeek-V3.2-Exp non-reasoning mode, 128K context', 131072, 8192, ARRAY['chat', 'streaming', 'function-calling', 'json-output'], true, 'chat', 'deepseek', 101, ARRAY['Recommended', 'Long Context'], NOW(), NOW()),
  ('deepseek_reasoner', 'deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', 'DeepSeek-V3.2-Exp reasoning mode with complex reasoning', 131072, 65536, ARRAY['chat', 'streaming', 'reasoning', 'json-output'], true, 'reasoning', 'deepseek', 102, ARRAY['Recommended', 'Reasoning'], NOW(), NOW()),
  ('deepseek_coder', 'deepseek-coder', 'DeepSeek Coder', 'deepseek', 'DeepSeek specialized coding model', 16384, 4096, ARRAY['chat', 'streaming', 'code'], true, 'code', 'deepseek', 103, ARRAY['Code'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- Doubao - ByteDance Models
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('doubao_seed_16', 'Doubao-Seed-1.6', 'Seed 1.6', 'doubao', 'Doubao base model with fine-tuning support', 32768, 4096, ARRAY['chat', 'streaming', 'fine-tuning'], true, 'chat', 'doubao', 201, ARRAY['Recommended', 'Base'], NOW(), NOW()),
  ('doubao_seed_16_lite', 'Doubao-Seed-1.6-lite', 'Seed 1.6 Lite', 'doubao', 'Doubao lite version for fast response', 32768, 4096, ARRAY['chat', 'streaming'], true, 'chat', 'doubao', 202, ARRAY['Fast', 'Lite'], NOW(), NOW()),
  ('doubao_seed_16_flash', 'Doubao-Seed-1.6-flash', 'Seed 1.6 Flash', 'doubao', 'Doubao flash version with fine-tuning', 32768, 4096, ARRAY['chat', 'streaming', 'fine-tuning'], true, 'chat', 'doubao', 203, ARRAY['Ultra Fast', 'Fine-tuning'], NOW(), NOW()),
  ('doubao_seed_16_thinking', 'Doubao-Seed-1.6-thinking', 'Seed 1.6 Thinking', 'doubao', 'Doubao reasoning model for deep thinking', 32768, 4096, ARRAY['chat', 'streaming', 'reasoning', 'fine-tuning'], true, 'reasoning', 'doubao', 204, ARRAY['Reasoning', 'Thinking'], NOW(), NOW()),
  ('doubao_seed_16_vision', 'Doubao-Seed-1.6-vision', 'Seed 1.6 Vision', 'doubao', 'Doubao vision model with image understanding', 32768, 4096, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'doubao', 205, ARRAY['Vision', 'Multimodal'], NOW(), NOW()),
  ('doubao_15_vision_pro', 'Doubao-1.5-vision-pro', '1.5 Vision Pro', 'doubao', 'Doubao professional vision model', 32768, 4096, ARRAY['chat', 'streaming', 'vision', 'fine-tuning'], true, 'vision', 'doubao', 206, ARRAY['Vision', 'Pro'], NOW(), NOW()),
  ('doubao_15_vision_lite', 'Doubao-1.5-vision-lite', '1.5 Vision Lite', 'doubao', 'Doubao lite vision model', 32768, 4096, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'doubao', 207, ARRAY['Vision', 'Lite'], NOW(), NOW()),
  ('doubao_seed_translation', 'Doubao-Seed-Translation', 'Seed Translation', 'doubao', 'Doubao professional translation model', 8192, 2048, ARRAY['chat', 'streaming', 'translation'], true, 'translation', 'doubao', 208, ARRAY['Translation'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- Doubao Platform Third-party Models
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('doubao_deepseek_v31', 'deepseek-v3-1-terminus', 'DeepSeek-V3.1 (via Doubao)', 'doubao', 'DeepSeek-V3.1 accessed through Doubao platform', 131072, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'deepseek-doubao', 209, ARRAY['Third-party'], NOW(), NOW()),
  ('doubao_kimi_k2', 'Kimi-K2', 'Kimi-K2 (via Doubao)', 'doubao', 'Moonshot Kimi-K2 accessed through Doubao platform', 131072, 4096, ARRAY['chat', 'streaming'], true, 'chat', 'kimi-doubao', 210, ARRAY['Third-party', 'Long Context'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- Qwen (Tongyi Qianwen) Models
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('qwen_3_max', 'Qwen3-Max', 'Qwen 3 Max', 'qwen', 'Qwen 3 most powerful model', 32768, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen3', 301, ARRAY['Recommended', 'Most Powerful'], NOW(), NOW()),
  ('qwen_3_vl_235b', 'Qwen3-VL-235B-A22B', 'Qwen 3 VL 235B', 'qwen', 'Qwen 3 ultra-large vision model', 32768, 8192, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'qwen3', 302, ARRAY['Vision', 'Ultra Large'], NOW(), NOW()),
  ('qwen_3_coder', 'Qwen3-Coder', 'Qwen 3 Coder', 'qwen', 'Qwen 3 specialized coding model', 32768, 8192, ARRAY['chat', 'streaming', 'code'], true, 'code', 'qwen3', 303, ARRAY['Code'], NOW(), NOW()),
  ('qwen_3_vl_32b', 'Qwen3-VL-32B', 'Qwen 3 VL 32B', 'qwen', 'Qwen 3 vision model 32B', 32768, 8192, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'qwen3', 304, ARRAY['Vision'], NOW(), NOW()),
  ('qwen_3_vl_30b', 'Qwen3-VL-30B-A3B', 'Qwen 3 VL 30B', 'qwen', 'Qwen 3 vision model 30B', 32768, 8192, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'qwen3', 305, ARRAY['Vision'], NOW(), NOW()),
  ('qwen_3_omni_flash', 'Qwen3-Omni-Flash', 'Qwen 3 Omni Flash', 'qwen', 'Qwen 3 omni-modal fast version', 32768, 8192, ARRAY['chat', 'streaming', 'vision', 'audio'], true, 'multimodal', 'qwen3', 306, ARRAY['Fast', 'Omni-modal'], NOW(), NOW()),
  ('qwen_3_next_80b', 'Qwen3-Next-80B-A3B', 'Qwen 3 Next 80B', 'qwen', 'Qwen 3 evolution version 80B', 32768, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen3', 307, ARRAY['Evolution'], NOW(), NOW()),
  ('qwen_3_235b_2507', 'Qwen3-235B-A22B-2507', 'Qwen 3 235B 2507', 'qwen', 'Qwen 3 ultra-large model 2507 version', 32768, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen3', 308, ARRAY['Ultra Large'], NOW(), NOW()),
  ('qwen_3_30b_2507', 'Qwen3-30B-A3B-2507', 'Qwen 3 30B 2507', 'qwen', 'Qwen 3 standard model 2507 version', 32768, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen3', 309, ARRAY['Standard']::text[], NOW(), NOW()),
  ('qwen_3_coder_flash', 'Qwen3-Coder-Flash', 'Qwen 3 Coder Flash', 'qwen', 'Qwen 3 coding fast version', 32768, 8192, ARRAY['chat', 'streaming', 'code'], true, 'code', 'qwen3', 310, ARRAY['Code', 'Fast'], NOW(), NOW()),
  ('qwen_25_max', 'Qwen2.5-Max', 'Qwen 2.5 Max', 'qwen', 'Qwen 2.5 most powerful model', 32768, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen25', 311, ARRAY['Recommended'], NOW(), NOW()),
  ('qwen_25_plus', 'Qwen2.5-Plus', 'Qwen 2.5 Plus', 'qwen', 'Qwen 2.5 enhanced version', 131072, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen25', 312, ARRAY['Long Context'], NOW(), NOW()),
  ('qwq_32b', 'QwQ-32B', 'QwQ 32B', 'qwen', 'Qwen reasoning model 32B', 32768, 8192, ARRAY['chat', 'streaming', 'reasoning'], true, 'reasoning', 'qwen', 313, ARRAY['Reasoning'], NOW(), NOW()),
  ('qwen_25_turbo', 'Qwen2.5-Turbo', 'Qwen 2.5 Turbo', 'qwen', 'Qwen 2.5 fast version', 131072, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen25', 314, ARRAY['Fast', 'Long Context'], NOW(), NOW()),
  ('qwen_25_omni_7b', 'Qwen2.5-Omni-7B', 'Qwen 2.5 Omni 7B', 'qwen', 'Qwen 2.5 omni-modal 7B', 32768, 8192, ARRAY['chat', 'streaming', 'vision', 'audio'], true, 'multimodal', 'qwen25', 315, ARRAY['Omni-modal'], NOW(), NOW()),
  ('qvq_max', 'QVQ-Max', 'QVQ Max', 'qwen', 'Qwen vision reasoning most powerful', 32768, 8192, ARRAY['chat', 'streaming', 'vision', 'reasoning'], true, 'vision', 'qwen', 316, ARRAY['Vision', 'Reasoning'], NOW(), NOW()),
  ('qwen_25_vl_32b', 'Qwen2.5-VL-32B-Instruct', 'Qwen 2.5 VL 32B', 'qwen', 'Qwen 2.5 vision model 32B', 32768, 8192, ARRAY['chat', 'streaming', 'vision'], true, 'vision', 'qwen25', 317, ARRAY['Vision'], NOW(), NOW()),
  ('qwen_25_14b_1m', 'Qwen2.5-14B-Instruct-1M', 'Qwen 2.5 14B 1M', 'qwen', 'Qwen 2.5 1M context window', 1048576, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen25', 318, ARRAY['Ultra Long Context'], NOW(), NOW()),
  ('qwen_25_coder_32b', 'Qwen2.5-Coder-32B-Instruct', 'Qwen 2.5 Coder 32B', 'qwen', 'Qwen 2.5 coding model 32B', 32768, 8192, ARRAY['chat', 'streaming', 'code'], true, 'code', 'qwen25', 319, ARRAY['Code'], NOW(), NOW()),
  ('qwen_25_72b', 'Qwen2.5-72B-Instruct', 'Qwen 2.5 72B', 'qwen', 'Qwen 2.5 large model 72B', 131072, 8192, ARRAY['chat', 'streaming'], true, 'chat', 'qwen25', 320, ARRAY['Large Model'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- OpenAI 模型
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('openai_gpt4o', 'gpt-4o', 'GPT-4o', 'openai', 'OpenAI最新多模态模型', 128000, 16384, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'multimodal', 'gpt4', 401, ARRAY['推荐', 'OpenAI'], NOW(), NOW()),
  ('openai_gpt4o_mini', 'gpt-4o-mini', 'GPT-4o Mini', 'openai', 'OpenAI性价比模型', 128000, 16384, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'chat', 'gpt4', 402, ARRAY['性价比', 'OpenAI'], NOW(), NOW()),
  ('openai_o1', 'o1', 'O1', 'openai', 'OpenAI推理模型', 128000, 32768, ARRAY['chat', 'streaming', 'reasoning'], true, 'reasoning', 'o1', 403, ARRAY['推理', 'OpenAI'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- Claude 模型
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('claude_sonnet_4', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 'anthropic', 'Anthropic最新Sonnet模型', 200000, 8192, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'chat', 'claude', 501, ARRAY['推荐', 'Claude'], NOW(), NOW()),
  ('claude_opus_4', 'claude-opus-4-20250514', 'Claude Opus 4', 'anthropic', 'Anthropic最强Opus模型', 200000, 8192, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'chat', 'claude', 502, ARRAY['最强', 'Claude'], NOW(), NOW()),
  ('claude_haiku_4', 'claude-haiku-4-20250514', 'Claude Haiku 4', 'anthropic', 'Anthropic快速Haiku模型', 200000, 8192, ARRAY['chat', 'streaming', 'vision'], true, 'chat', 'claude', 503, ARRAY['快速', 'Claude'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- Gemini 模型
INSERT INTO preset_models (id, name, "displayName", provider, description, "contextLength", "maxTokens", "supportedFeatures", "isActive", category, series, "sortOrder", tags, "createdAt", "updatedAt")
VALUES
  ('gemini_20_flash', 'gemini-2.0-flash-exp', 'Gemini 2.0 Flash', 'gemini', 'Google Gemini 2.0 快速版', 1048576, 8192, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'multimodal', 'gemini', 601, ARRAY['推荐', 'Google', '超长上下文'], NOW(), NOW()),
  ('gemini_15_pro', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'gemini', 'Google Gemini 1.5 专业版', 2097152, 8192, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'multimodal', 'gemini', 602, ARRAY['专业', 'Google', '超长上下文'], NOW(), NOW()),
  ('gemini_15_flash', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'gemini', 'Google Gemini 1.5 快速版', 1048576, 8192, ARRAY['chat', 'streaming', 'vision', 'function-calling'], true, 'multimodal', 'gemini', 603, ARRAY['快速', 'Google', '超长上下文'], NOW(), NOW())
ON CONFLICT (name, provider) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description = EXCLUDED.description,
  "contextLength" = EXCLUDED."contextLength",
  "maxTokens" = EXCLUDED."maxTokens",
  "supportedFeatures" = EXCLUDED."supportedFeatures",
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  "updatedAt" = NOW();

-- 查询统计
SELECT
  provider,
  COUNT(*) as model_count,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM preset_models
WHERE "isActive" = true
GROUP BY provider
ORDER BY provider;

SELECT COUNT(*) as total_active_models FROM preset_models WHERE "isActive" = true;
