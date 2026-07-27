export type DashboardRange = '24h' | '7d' | '30d'

export interface DashboardTrendBucket {
  key: string
  label: string
  start: string
  end: string
  deployments: number
  deploymentFailures: number
  aiExecutions: number
  aiFailures: number
  alerts: number
}

const RANGE_VALUES = new Set<DashboardRange>(['24h', '7d', '30d'])

/** 只接受仪表盘支持的时间范围，非法值统一回退到七天。 */
export function parseDashboardRange(value: string | null | undefined): DashboardRange {
  return RANGE_VALUES.has(value as DashboardRange) ? value as DashboardRange : '7d'
}

/** 返回查询起点；调用方使用同一时刻生成桶，避免边界漂移。 */
export function getDashboardSince(range: DashboardRange, now = new Date()): Date {
  const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
}

/** 百分比计算统一处理零分母，避免在空数据时显示 NaN 或虚假的 100%。 */
export function calculateRate(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.round(Math.max(0, Math.min(1, part / total)) * 100)
}

/**
 * 创建连续趋势桶：24 小时按小时，7/30 天按天。
 * 所有边界使用 UTC，展示标签固定为 Asia/Shanghai，容器时区不会改变统计口径。
 */
export function createTrendBuckets(range: DashboardRange, now = new Date()): DashboardTrendBucket[] {
  const hourly = range === '24h'
  const count = hourly ? 24 : range === '7d' ? 7 : 30
  const end = new Date(now)
  if (hourly) {
    end.setUTCMinutes(0, 0, 0)
    end.setUTCHours(end.getUTCHours() + 1)
  } else {
    end.setUTCHours(16, 0, 0, 0)
    if (end.getTime() <= now.getTime()) end.setUTCDate(end.getUTCDate() + 1)
  }
  const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const labelFormatter = new Intl.DateTimeFormat('zh-CN', hourly
    ? { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }
    : { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' })

  return Array.from({ length: count }, (_, index) => {
    const bucketEnd = new Date(end.getTime() - (count - index - 1) * stepMs)
    const bucketStart = new Date(bucketEnd.getTime() - stepMs)
    return {
      key: bucketStart.toISOString(),
      label: labelFormatter.format(bucketStart).replace(/\//g, '-'),
      start: bucketStart.toISOString(),
      end: bucketEnd.toISOString(),
      deployments: 0,
      deploymentFailures: 0,
      aiExecutions: 0,
      aiFailures: 0,
      alerts: 0,
    }
  })
}

/** 把真实事件累加到时间桶；超出选择范围的数据被忽略。 */
export function addTrendEvent(
  buckets: DashboardTrendBucket[],
  occurredAt: Date | string,
  metric: 'deployments' | 'deploymentFailures' | 'aiExecutions' | 'aiFailures' | 'alerts',
): void {
  const timestamp = new Date(occurredAt).getTime()
  if (!Number.isFinite(timestamp)) return
  const bucket = buckets.find(item => timestamp >= new Date(item.start).getTime() && timestamp < new Date(item.end).getTime())
  if (bucket) bucket[metric] += 1
}

/** 统一事件流必须按真实时间倒序，不按来源分段拼接。 */
export function sortByOccurredAt<T extends { occurredAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

