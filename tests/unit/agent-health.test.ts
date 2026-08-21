import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyAgentProbe, formatAgentHttpError } from '../../lib/agentHealth'

test('Agent 探针必须同时验证服务存活和平台通信密钥', () => {
  assert.equal(classifyAgentProbe({ healthStatus: 200, authStatus: 200, platformKeyConfigured: true }), 'installed')
  assert.equal(classifyAgentProbe({ healthStatus: 200, authStatus: 401, platformKeyConfigured: true }), 'authentication_mismatch')
  assert.equal(classifyAgentProbe({ healthStatus: 401, platformKeyConfigured: true }), 'authentication_mismatch')
  assert.equal(classifyAgentProbe({ healthStatus: 200, platformKeyConfigured: false }), 'platform_misconfigured')
  assert.equal(classifyAgentProbe({ healthStatus: 200, authStatus: 404, platformKeyConfigured: true }), 'legacy_unverified')
  assert.equal(classifyAgentProbe({ platformKeyConfigured: true }), 'not_installed')
})

test('Agent 401 错误不能再误导为模型厂商 API Key 错误', () => {
  const message = formatAgentHttpError(401, 'Unauthorized', '{"message":"invalid API key"}')
  assert.match(message, /Agent 通信密钥与平台不一致/)
  assert.match(message, /同步密钥并更新 Agent/)
  assert.doesNotMatch(message, /DeepSeek|模型/)

  assert.equal(formatAgentHttpError(500, 'Internal Server Error', 'boom'), '500 Internal Server Error - boom')
})
