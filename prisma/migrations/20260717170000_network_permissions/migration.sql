INSERT INTO "permissions" ("id", "name", "code", "description", "category", "createdAt", "updatedAt") VALUES
  ('perm_network_read', '网络查看', 'network:read', '查看网络设备、配置、拓扑、巡检、告警和变更记录', '网络管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_network_write', '网络管理', 'network:write', '管理设备凭据、审批和执行网络操作', '网络管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "category" = EXCLUDED."category", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "roles" SET "permissions" = "permissions" || '["network:read","network:write"]'::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "name" IN ('manager'::"UserRole", 'developer'::"UserRole");
UPDATE "roles" SET "permissions" = "permissions" || '["network:read"]'::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'viewer'::"UserRole";
UPDATE "users" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['network:read','network:write']::text[])), "updatedAt" = CURRENT_TIMESTAMP WHERE "role" IN ('manager'::"UserRole", 'developer'::"UserRole");
UPDATE "users" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['network:read']::text[])), "updatedAt" = CURRENT_TIMESTAMP WHERE "role" = 'viewer'::"UserRole";
