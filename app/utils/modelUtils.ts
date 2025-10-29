/**
 * 模型工具函数
 * 用于识别和处理多模态模型
 */

export interface ModelCapabilities {
  text: boolean
  vision: boolean
  code: boolean
  reasoning: boolean
  multimodal: boolean
}

/**
 * 检查模型是否支持多模态（图像理解）
 */
export function isMultimodalModel(modelName: string): boolean {
  const multimodalKeywords = [
    'vision',
    'multimodal', 
    'gpt-4o',
    'gpt-4-vision',
    'gemini-pro-vision',
    'gemini-1.5',
    'gemini-2.0',
    'claude-3'
  ]
  
  return multimodalKeywords.some(keyword => 
    modelName.toLowerCase().includes(keyword.toLowerCase())
  )
}

/**
 * 获取模型能力
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  const name = modelName.toLowerCase()

  // 检查是否为多模态模型
  const isMultimodal = isMultimodalModel(modelName)

  // 检查代码生成能力
  const hasCodeCapability =
    name.includes('code') ||
    name.includes('coder') ||
    name.includes('gpt-4') ||
    name.includes('deepseek-coder') ||
    name.includes('codellama')

  // 检查推理能力
  const hasReasoningCapability =
    name.includes('reasoning') ||
    name.includes('reasoner') ||
    name.includes('gpt-4') ||
    name.includes('gemini') ||
    name.includes('claude') ||
    name.includes('deepseek')

  return {
    text: true, // 所有模型都支持文本生成
    vision: isMultimodal, // 图像理解能力
    code: hasCodeCapability, // 代码生成能力
    reasoning: hasReasoningCapability, // 逻辑推理能力
    multimodal: isMultimodal // 多模态对话能力
  }
}

/**
 * 获取模型类型标签
 */
export function getModelTypeLabel(modelName: string): string {
  const capabilities = getModelCapabilities(modelName)
  
  if (capabilities.multimodal) return '多模态'
  if (capabilities.code) return '代码'
  if (capabilities.reasoning) return '推理'
  return '文本'
}

/**
 * 获取模型能力标签列表
 */
export function getModelCapabilityLabels(modelName: string): string[] {
  const capabilities = getModelCapabilities(modelName)
  const labels: string[] = []
  
  if (capabilities.text) labels.push('文本生成')
  if (capabilities.vision) labels.push('图像理解')
  if (capabilities.code) labels.push('代码生成')
  if (capabilities.reasoning) labels.push('逻辑推理')
  if (capabilities.multimodal) labels.push('多模态对话')
  
  return labels
}

/**
 * 检查模型是否支持图像输入
 */
export function supportsImageInput(modelName: string): boolean {
  return isMultimodalModel(modelName)
}

/**
 * 获取支持的图像格式
 */
export function getSupportedImageFormats(modelName: string): string[] {
  if (!supportsImageInput(modelName)) return []
  
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}

/**
 * 获取最大图像大小限制（MB）
 */
export function getMaxImageSize(modelName: string): number {
  if (!supportsImageInput(modelName)) return 0
  
  // 不同模型的图像大小限制
  if (modelName.includes('gpt-4')) return 20
  if (modelName.includes('gemini')) return 20
  if (modelName.includes('claude')) return 5
  
  return 10 // 默认限制
}
