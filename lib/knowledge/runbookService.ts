import { createHash } from 'crypto'

export const MAX_RUNBOOK_SIZE = 512_000

export function hashRunbookContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * 按自然段切分，同时限制单块大小并保留少量重叠上下文。
 * 当前分块用于可解释的关键词检索，不伪装成向量语义检索。
 */
export function chunkRunbook(content: string, maxChars = 1800, overlap = 180): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    const value = current.trim()
    if (value) chunks.push(value)
    current = ''
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush()
      let offset = 0
      while (offset < paragraph.length) {
        const end = Math.min(offset + maxChars, paragraph.length)
        chunks.push(paragraph.slice(offset, end).trim())
        if (end === paragraph.length) break
        offset = Math.max(end - overlap, offset + 1)
      }
      continue
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > maxChars) {
      const previousTail = current.slice(-overlap)
      flush()
      current = previousTail ? `${previousTail}\n\n${paragraph}` : paragraph
    } else {
      current = candidate
    }
  }
  flush()
  return chunks.filter(Boolean)
}

export function estimateTokens(content: string): number {
  // 中英文混合运维文档的保守估计，仅用于容量展示，不参与计费。
  return Math.ceil(content.length / 2.5)
}

export function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(item => item.trim()).filter(Boolean))).slice(0, 30)
}
