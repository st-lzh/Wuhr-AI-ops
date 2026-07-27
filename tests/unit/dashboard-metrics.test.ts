import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addTrendEvent,
  calculateRate,
  createTrendBuckets,
  parseDashboardRange,
  sortByOccurredAt,
} from '../../lib/dashboard/metrics'

test('仪表盘时间范围非法时回退七天', () => {
  assert.equal(parseDashboardRange('24h'), '24h')
  assert.equal(parseDashboardRange('unknown'), '7d')
})

test('趋势桶数量与范围一致且能累加真实事件', () => {
  const now = new Date('2026-07-17T12:34:00.000Z')
  const buckets = createTrendBuckets('24h', now)
  assert.equal(buckets.length, 24)
  addTrendEvent(buckets, '2026-07-17T12:10:00.000Z', 'deployments')
  addTrendEvent(buckets, '2026-07-17T12:20:00.000Z', 'deploymentFailures')
  assert.equal(buckets.reduce((sum, item) => sum + item.deployments, 0), 1)
  assert.equal(buckets.reduce((sum, item) => sum + item.deploymentFailures, 0), 1)
})

test('空分母成功率为零，正常比例四舍五入', () => {
  assert.equal(calculateRate(0, 0), 0)
  assert.equal(calculateRate(2, 3), 67)
})

test('统一事件按真实时间倒序排列', () => {
  const result = sortByOccurredAt([
    { id: 'old', occurredAt: '2026-07-16T12:00:00.000Z' },
    { id: 'new', occurredAt: '2026-07-17T12:00:00.000Z' },
  ])
  assert.deepEqual(result.map(item => item.id), ['new', 'old'])
})
