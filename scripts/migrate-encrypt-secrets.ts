import 'dotenv/config'
import {
  decrypt,
  encrypt,
  isEncryptedSecret,
  protectSecret
} from '../lib/crypto/encryption'
import { protectEnvironment } from '../lib/crypto/environmentSecrets'

// ts-node 在本项目的 Bundler moduleResolution 下读取生成客户端时需要使用 CJS 入口。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('../lib/generated/prisma')
const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

function protectedValue(value?: string | null) {
  if (!value || isEncryptedSecret(value)) return null
  return protectSecret(value)
}

function migrateToolEnvironments(items: unknown): { items: any[]; migrated: number } {
  if (!Array.isArray(items)) return { items: [], migrated: 0 }
  let migrated = 0
  const next = items.map(item => {
    if (!item || typeof item !== 'object') return item
    const record = item as Record<string, any>
    const env = record.env && typeof record.env === 'object' && !Array.isArray(record.env)
      ? record.env as Record<string, string>
      : {}
    migrated += Object.values(env).filter(value => Boolean(value) && !isEncryptedSecret(value)).length
    return { ...record, env: protectEnvironment(env, env) }
  })
  return { items: next, migrated }
}

async function migrate() {
  // 启动前先验证当前密钥能稳定完成加解密，避免迁移到不可恢复状态。
  const probe = `wuhr-secret-migration-${Date.now()}`
  if (decrypt(encrypt(probe)) !== probe) throw new Error('加密密钥自检失败')

  const [servers, jenkins, modelConfigs, apiKeys, providers, mcpConfigs, customToolConfigs] = await Promise.all([
    prisma.server.findMany({ select: { id: true, password: true } }),
    prisma.jenkinsConfig.findMany({ select: { id: true, apiToken: true, config: true } }),
    prisma.modelConfig.findMany({ select: { id: true, apiKey: true } }),
    prisma.apiKey.findMany({ select: { id: true, apiKey: true } }),
    prisma.model_providers.findMany({ select: { id: true, apiKey: true, config: true } }),
    prisma.mCPToolsConfig.findMany({ select: { id: true, servers: true } }),
    prisma.customToolsConfig.findMany({ select: { id: true, tools: true } })
  ])

  const migratedMCP = mcpConfigs.map((item: any) => ({ id: item.id, ...migrateToolEnvironments(item.servers) }))
  const migratedCustomTools = customToolConfigs.map((item: any) => ({ id: item.id, ...migrateToolEnvironments(item.tools) }))

  const counts = {
    serverPasswords: servers.filter((item: any) => protectedValue(item.password)).length,
    jenkinsTokens: jenkins.filter((item: any) => protectedValue(item.apiToken)).length,
    modelKeys: modelConfigs.filter((item: any) => protectedValue(item.apiKey)).length,
    legacyApiKeys: apiKeys.filter((item: any) => protectedValue(item.apiKey)).length,
    providerKeys: providers.filter((item: any) => protectedValue(item.apiKey)).length,
    mcpEnvironmentValues: migratedMCP.reduce((sum: number, item: any) => sum + item.migrated, 0),
    customToolEnvironmentValues: migratedCustomTools.reduce((sum: number, item: any) => sum + item.migrated, 0)
  }

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, counts }))
    return
  }

  await prisma.$transaction(async (tx: any) => {
    for (const item of servers) {
      const password = protectedValue(item.password)
      if (password) await tx.server.update({ where: { id: item.id }, data: { password } })
    }
    for (const item of jenkins) {
      const apiToken = protectedValue(item.apiToken)
      const rawConfig = item.config && typeof item.config === 'object' && !Array.isArray(item.config)
        ? item.config as Record<string, unknown>
        : null
      const { apiToken: _removed, token: _legacyRemoved, ...safeConfig } = rawConfig || {}
      if (apiToken || rawConfig) {
        await tx.jenkinsConfig.update({
          where: { id: item.id },
          data: {
            ...(apiToken ? { apiToken } : {}),
            ...(rawConfig ? { config: safeConfig as any } : {})
          }
        })
      }
    }
    for (const item of modelConfigs) {
      const apiKey = protectedValue(item.apiKey)
      if (apiKey) await tx.modelConfig.update({ where: { id: item.id }, data: { apiKey } })
    }
    for (const item of apiKeys) {
      const apiKey = protectedValue(item.apiKey)
      if (apiKey) await tx.apiKey.update({ where: { id: item.id }, data: { apiKey } })
    }
    for (const item of providers) {
      const apiKey = protectedValue(item.apiKey)
      if (!apiKey) continue
      const config = item.config && typeof item.config === 'object' && !Array.isArray(item.config)
        ? item.config as Record<string, unknown>
        : {}
      await tx.model_providers.update({
        where: { id: item.id },
        data: {
          apiKey,
          config: { ...config, credentialsEncrypted: true }
        }
      })
    }
    for (const item of migratedMCP) {
      if (item.migrated > 0) {
        await tx.mCPToolsConfig.update({ where: { id: item.id }, data: { servers: item.items } })
      }
    }
    for (const item of migratedCustomTools) {
      if (item.migrated > 0) {
        await tx.customToolsConfig.update({ where: { id: item.id }, data: { tools: item.items } })
      }
    }
  }, { timeout: 60_000 })

  console.log(JSON.stringify({ success: true, counts }))
}

migrate()
  .catch(error => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
