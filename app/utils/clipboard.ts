/**
 * 跨浏览器复制文本到剪贴板的工具函数
 */

export interface CopyResult {
  success: boolean
  error?: string
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<CopyResult> 复制结果
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    // 优先使用现代的 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return { success: true }
    } else {
      // 降级到传统的复制方法
      return fallbackCopyTextToClipboard(text)
    }
  } catch (error) {
    console.error('复制操作失败:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '复制失败'
    }
  }
}

/**
 * 传统的复制方法（兼容旧浏览器）
 * @param text 要复制的文本
 * @returns CopyResult 复制结果
 */
function fallbackCopyTextToClipboard(text: string): CopyResult {
  const textArea = document.createElement('textarea')
  textArea.value = text
  
  // 避免滚动到底部
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  textArea.style.opacity = '0'
  
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  
  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      return { success: true }
    } else {
      return { success: false, error: 'execCommand 复制失败' }
    }
  } catch (err) {
    document.body.removeChild(textArea)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : '复制失败'
    }
  }
}

/**
 * 检查是否支持剪贴板操作
 * @returns boolean 是否支持
 */
export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText) || 
         document.queryCommandSupported('copy')
}

/**
 * 复制文本并显示用户友好的消息
 * @param text 要复制的文本
 * @param onSuccess 成功回调
 * @param onError 失败回调
 */
export async function copyWithFeedback(
  text: string,
  onSuccess?: (message: string) => void,
  onError?: (message: string) => void
): Promise<void> {
  const result = await copyToClipboard(text)
  
  if (result.success) {
    onSuccess?.('内容已复制到剪贴板')
  } else {
    onError?.(`复制失败: ${result.error || '未知错误'}`)
  }
}
