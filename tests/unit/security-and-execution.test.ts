import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'

process.env.ENCRYPTION_KEY = '11'.repeat(32)

import {
  SECRET_MASK,
  maskEnvironment,
  protectEnvironment,
  revealEnvironment
} from '../../lib/crypto/environmentSecrets'
import { decrypt, encrypt, protectSecret } from '../../lib/crypto/encryption'
import { canReadTeamAssets, canWriteTeamAssets } from '../../lib/auth/teamAccess'
import { grantsPermission, requiredPermissionForRequest } from '../../lib/auth/accessPolicy'
import {
  ChatTargetError,
  normalizeTargetHostIds,
  resolveChatExecutionContext
} from '../../lib/ai/batchExecution'
import { assessAutomationRisk, nextCronDate } from '../../lib/operations/automationService'
import { chunkRunbook, hashRunbookContent } from '../../lib/knowledge/runbookService'
import { checkDockerRegistry } from '../../lib/artifacts/registryClient'
import {
  AGENT_INSTALLER_MIRROR_URL,
  AGENT_INSTALLER_PRIMARY_URL,
  buildAgentInstallCommand
} from '../../lib/agentRelease'
import { canAccessImproveProxy } from '../../lib/improve/backendProxy'

test('环境变量写入加密、读取遮罩并可在服务端还原', () => {
  const protectedValue = protectEnvironment({ API_TOKEN: 'secret-token', EMPTY: '' })

  assert.notEqual(protectedValue.API_TOKEN, 'secret-token')
  assert.match(protectedValue.API_TOKEN, /^wuhr:v2:/)
  assert.deepEqual(maskEnvironment(protectedValue), {
    API_TOKEN: SECRET_MASK,
    EMPTY: SECRET_MASK
  })
  assert.deepEqual(revealEnvironment(protectedValue), {
    API_TOKEN: 'secret-token',
    EMPTY: ''
  })

  assert.deepEqual(
    protectEnvironment({ API_TOKEN: SECRET_MASK }, protectedValue),
    { API_TOKEN: protectedValue.API_TOKEN }
  )
})

test('AES-GCM 密文被篡改后必须拒绝解密', () => {
  const encrypted = encrypt('sensitive-value')
  const last = encrypted.at(-1) === '0' ? '1' : '0'
  const tampered = `${encrypted.slice(0, -1)}${last}`

  assert.equal(decrypt(encrypted), 'sensitive-value')
  const originalConsoleError = console.error
  console.error = () => undefined
  try {
    assert.throws(() => decrypt(tampered), /解密失败/)
  } finally {
    console.error = originalConsoleError
  }
})

test('可信团队共享读取，写入仍由角色或细粒度权限控制', () => {
  assert.equal(canReadTeamAssets({ id: 'member-1', role: 'member' }), true)
  assert.equal(canReadTeamAssets({ id: '' }), false)
  assert.equal(canWriteTeamAssets({ id: 'admin', role: 'admin' }, 'servers:write'), true)
  assert.equal(canWriteTeamAssets({ id: 'manager', role: 'manager' }, 'servers:write'), true)
  assert.equal(canWriteTeamAssets({ id: 'member', permissions: ['servers:write'] }, 'servers:write'), true)
  assert.equal(canWriteTeamAssets({ id: 'member', permissions: [] }, 'servers:write'), false)
})

test('统一路由权限策略不会再让根路径通配所有模块', () => {
  assert.equal(requiredPermissionForRequest('/servers/list', 'GET'), 'servers:read')
  assert.equal(requiredPermissionForRequest('/api/servers', 'POST'), 'servers:write')
  assert.equal(requiredPermissionForRequest('/api/cicd/deployments/1/execute', 'POST'), 'cicd:write')
  assert.equal(requiredPermissionForRequest('/tools', 'GET'), null)
  assert.equal(requiredPermissionForRequest('/knowledge', 'GET'), 'improve:read')
  assert.equal(requiredPermissionForRequest('/api/integration/alert-sources', 'POST'), 'monitoring:write')
  assert.equal(requiredPermissionForRequest('/api/integration/artifacts/1/test', 'POST'), 'cicd:write')

  assert.equal(grantsPermission('viewer', ['servers:read'], 'servers:read'), true)
  assert.equal(grantsPermission('viewer', ['servers:read'], 'servers:write'), false)
  assert.equal(grantsPermission('manager', ['servers:all'], 'servers:write'), true)
  assert.equal(grantsPermission('admin', [], 'permissions:write'), true)
})

test('Agent 安装命令先用 GitHub、再回退国内镜像且拒绝非法端口', () => {
  const command = buildAgentInstallCommand(2081)
  const commandWithKey = buildAgentInstallCommand(2081, {
    apiKeyFile: '/tmp/.wuhr-agent-api-key-test'
  })

  assert.ok(command.indexOf(AGENT_INSTALLER_PRIMARY_URL) < command.indexOf(AGENT_INSTALLER_MIRROR_URL))
  assert.match(command, /curl -fsSL/)
  assert.match(command, /curl[^\n]+\|\| curl/)
  assert.doesNotMatch(command, /&&\s*\|\|/)
  assert.match(command, /sh "\$tmp" --port 2081/)
  assert.doesNotMatch(command, /--port=/)
  assert.doesNotMatch(command, /\|\s*(ba)?sh/)
  assert.match(commandWithKey, /--api-key-file '\/tmp\/\.wuhr-agent-api-key-test'/)
  assert.doesNotMatch(commandWithKey, /wuhr_[a-z0-9]+/)
  assert.throws(() => buildAgentInstallCommand(0), /1-65535/)
  assert.throws(() => buildAgentInstallCommand(65536), /1-65535/)
  assert.throws(
    () => buildAgentInstallCommand(2081, { apiKeyFile: '/tmp/key;touch-pwned' }),
    /路径不合法/
  )
})

test('AI 资产代理允许管理员和显式权限，拒绝普通无权限用户', () => {
  assert.equal(canAccessImproveProxy({ role: 'admin', permissions: ['read'] }, true), true)
  assert.equal(canAccessImproveProxy({ role: 'viewer', permissions: ['*'] }, true), true)
  assert.equal(canAccessImproveProxy({ role: 'viewer', permissions: ['improve:read'] }, false), true)
  assert.equal(canAccessImproveProxy({ role: 'viewer', permissions: ['improve:read'] }, true), false)
  assert.equal(canAccessImproveProxy({ role: 'viewer', permissions: [] }, false), false)
})

test('作业风险识别强制覆盖破坏性命令，Cron 使用上海时区', () => {
  assert.equal(assessAutomationRisk('uptime'), 'low')
  assert.equal(assessAutomationRisk('sudo systemctl restart nginx'), 'medium')
  assert.equal(assessAutomationRisk('kubectl delete pod app-1'), 'high')
  assert.equal(assessAutomationRisk('rm -rf /'), 'critical')
  assert.equal(nextCronDate('0 8 * * *', new Date('2026-07-22T00:01:00.000Z')).toISOString(), '2026-07-23T00:00:00.000Z')
})

test('知识文档分块稳定、保留上下文并生成内容指纹', () => {
  const content = `${'A'.repeat(1200)}\n\n${'B'.repeat(1200)}\n\n结论`
  const chunks = chunkRunbook(content, 1500, 100)
  assert.equal(chunks.length, 2)
  assert.match(chunks[1], /^A+/)
  assert.match(chunks[1], /B+/)
  assert.equal(hashRunbookContent('same'), hashRunbookContent('same'))
  assert.notEqual(hashRunbookContent('same'), hashRunbookContent('different'))
})

test('制品仓库健康检查调用真实 Registry V2 接口并发送 Basic 认证', async () => {
  let authorization = ''
  const server = createServer((request, response) => {
    authorization = String(request.headers.authorization || '')
    if (request.url === '/v2/' && authorization === `Basic ${Buffer.from('robot:token').toString('base64')}`) {
      response.writeHead(200, { 'Docker-Distribution-Api-Version': 'registry/2.0' })
    } else response.writeHead(401)
    response.end()
  })
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const result = await checkDockerRegistry({ baseUrl: `http://127.0.0.1:${address.port}`, username: 'robot', password: 'token' })
    assert.equal(result.ok, true)
    assert.equal(result.apiVersion, 'registry/2.0')
    assert.match(authorization, /^Basic /)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('目标主机规范化会去重、保序并限制批量规模', () => {
  assert.deepEqual(normalizeTargetHostIds([' host-a ', 'host-b', 'host-a', '', 1]), ['host-a', 'host-b'])
  assert.throws(() => normalizeTargetHostIds('host-a'), (error: unknown) => {
    return error instanceof ChatTargetError && error.status === 400
  })
  assert.throws(() => normalizeTargetHostIds(Array.from({ length: 65 }, (_, i) => `host-${i}`)), /最多批量执行 64 台/)
})

function server(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    ip: `10.0.0.${id === 'host-a' ? 1 : 2}`,
    port: 22,
    username: 'root',
    password: protectSecret(`${id}-password`),
    authType: 'password',
    keyPath: null,
    hostname: null,
    tags: [],
    isActive: true,
    isDefault: id === 'host-a',
    ...overrides
  }
}

test('单个目标走单机链路，两个目标才进入一次推理后的批量执行链路', async () => {
  const hosts = [server('host-a'), server('host-b')]
  const prisma = {
    server: {
      findMany: async ({ where }: any) => hosts.filter(item => where.id.in.includes(item.id)),
      findFirst: async ({ where }: any) => {
        if (where.id) return hosts.find(item => item.id === where.id) || null
        if (where.isDefault) return hosts.find(item => item.isDefault) || null
        return null
      }
    }
  } as any

  const single = await resolveChatExecutionContext({
    prisma,
    userId: 'operator',
    targetHostIds: ['host-b']
  })
  assert.equal(single.batchMode, false)
  assert.equal(single.coordinator.id, 'host-b')
  assert.deepEqual(single.batchHosts, [])

  const batch = await resolveChatExecutionContext({
    prisma,
    userId: 'operator',
    targetHostIds: ['host-b', 'host-a']
  })
  assert.equal(batch.batchMode, true)
  assert.equal(batch.coordinator.id, 'host-a')
  assert.deepEqual(batch.batchHosts.map(item => item.id), ['host-b', 'host-a'])
  assert.equal(batch.batchHosts[0].password, 'host-b-password')
})
