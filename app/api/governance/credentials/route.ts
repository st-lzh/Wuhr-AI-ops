import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { isEncryptedSecret } from '../../../../lib/crypto/encryption'

export const dynamic = 'force-dynamic'

type SecretRecord = { id: string; name: string; updatedAt: Date; values: Array<string | null | undefined> }

function summarize(key: string, label: string, route: string, records: SecretRecord[]) {
  const staleBoundary = Date.now() - 180 * 24 * 60 * 60 * 1000
  let protectedCount = 0
  let legacyCount = 0
  let missingCount = 0
  let staleCount = 0
  for (const record of records) {
    const values = record.values.filter(Boolean) as string[]
    if (values.length === 0) missingCount += 1
    else if (values.every(isEncryptedSecret)) protectedCount += 1
    else legacyCount += 1
    if (record.updatedAt.getTime() < staleBoundary) staleCount += 1
  }
  return {
    key, label, route, total: records.length, protectedCount, legacyCount, missingCount, staleCount,
    lastUpdatedAt: records.reduce<Date | null>((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null)
  }
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'permissions:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const [servers, devices, git, jenkins, grafana, elk, models, artifacts] = await Promise.all([
    // keyPath/sshKeyPath 只是运行节点上的文件路径，不是私钥内容，也不应计入密文覆盖率。
    prisma.server.findMany({ select: { id: true, name: true, updatedAt: true, password: true } }),
    prisma.network_devices.findMany({ select: { id: true, name: true, updatedAt: true, sshPassword: true, snmpCommunity: true, snmpAuthPass: true, snmpPrivPass: true } }),
    prisma.gitCredential.findMany({ select: { id: true, name: true, updatedAt: true, encryptedCredentials: true } }),
    prisma.jenkinsConfig.findMany({ select: { id: true, name: true, updatedAt: true, apiToken: true } }),
    prisma.grafanaConfig.findMany({ select: { id: true, name: true, updatedAt: true, password: true, apiKey: true } }),
    prisma.eLKConfig.findMany({ select: { id: true, name: true, updatedAt: true, password: true, apiKey: true } }),
    prisma.model_providers.findMany({ select: { id: true, name: true, updatedAt: true, apiKey: true, secretKey: true } }),
    prisma.artifactRepository.findMany({ select: { id: true, name: true, updatedAt: true, passwordEncrypted: true } })
  ])

  const categories = [
    summarize('servers', '主机凭据', '/servers/list', servers.map(item => ({ ...item, values: [item.password] }))),
    summarize('devices', '网络凭据', '/network/devices', devices.map(item => ({ ...item, values: [item.sshPassword, item.snmpCommunity, item.snmpAuthPass, item.snmpPrivPass] }))),
    summarize('git', '代码凭据', '/integration/git', git.map(item => ({ ...item, values: [item.encryptedCredentials] }))),
    summarize('jenkins', '任务凭据', '/integration/jenkins', jenkins.map(item => ({ ...item, values: [item.apiToken] }))),
    summarize('grafana', '监控凭据', '/monitor', grafana.map(item => ({ ...item, values: [item.password, item.apiKey] }))),
    summarize('elk', '日志凭据', '/servers/logs', elk.map(item => ({ ...item, values: [item.password, item.apiKey] }))),
    summarize('models', '模型密钥', '/config/models', models.map(item => ({ ...item, values: [item.apiKey, item.secretKey] }))),
    summarize('artifacts', '制品凭据', '/integration/artifacts', artifacts.map(item => ({ ...item, values: [item.passwordEncrypted] })))
  ]
  return NextResponse.json({
    success: true,
    data: {
      categories,
      summary: {
        total: categories.reduce((sum, item) => sum + item.total, 0),
        protected: categories.reduce((sum, item) => sum + item.protectedCount, 0),
        legacy: categories.reduce((sum, item) => sum + item.legacyCount, 0),
        stale: categories.reduce((sum, item) => sum + item.staleCount, 0)
      },
      policy: { encryption: 'AES-256-GCM', staleAfterDays: 180, secretsReturnedToBrowser: false }
    }
  })
}
