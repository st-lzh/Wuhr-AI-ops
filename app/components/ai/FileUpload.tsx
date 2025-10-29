'use client'

import React, { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Button,
  Card,
  List,
  Typography,
  Space,
  Tag,
  Tooltip,
  Progress,
  Modal,
  message,
  Popconfirm
} from 'antd'
import { copyWithFeedback } from '../../utils/clipboard'
import {
  UploadOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  CloudUploadOutlined
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'

const { Text, Paragraph } = Typography
const { Dragger } = Upload

export interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  content?: string
  preview?: string
  uploadTime: Date
  status: 'uploading' | 'success' | 'error'
}

export interface FileUploadProps {
  onFileAnalyzed?: (files: FileInfo[]) => void
  onFileContentChange?: (content: string) => void
  maxFiles?: number
  maxFileSize?: number // MB
  acceptedTypes?: string[]
  className?: string
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileAnalyzed,
  onFileContentChange,
  maxFiles = 10,
  maxFileSize = 10,
  acceptedTypes = ['.txt', '.md', '.json', '.csv', '.log', '.yml', '.yaml', '.xml'],
  className
}) => {
  const [fileList, setFileList] = useState<FileInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取文件图标
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImageOutlined />
    if (type.includes('text') || type.includes('json') || type.includes('yaml')) return <FileTextOutlined />
    return <FileOutlined />
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 读取文件内容
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }

      // 根据文件类型选择读取方式
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file, 'UTF-8')
      }
    })
  }

  // 处理文件上传
  const handleFileUpload = useCallback(async (files: File[]) => {
    console.log('📁 FileUpload: 开始处理文件上传，文件数量:', files.length)
    if (files.length === 0) return

    // 检查文件数量限制
    if (fileList.length + files.length > maxFiles) {
      message.error(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    setUploading(true)

    try {
      const newFiles: FileInfo[] = []

      for (const file of files) {
        // 检查文件大小
        if (file.size > maxFileSize * 1024 * 1024) {
          message.error(`文件 ${file.name} 超过大小限制 (${maxFileSize}MB)`)
          continue
        }

        // 检查文件类型
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
        if (acceptedTypes.length > 0 && !acceptedTypes.includes(fileExtension)) {
          message.error(`不支持的文件类型: ${file.name}`)
          continue
        }

        const fileInfo: FileInfo = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadTime: new Date(),
          status: 'uploading'
        }

        newFiles.push(fileInfo)

        try {
          // 读取文件内容
          const content = await readFileContent(file)
          
          fileInfo.content = content
          fileInfo.status = 'success'

          // 生成预览内容
          if (file.type.startsWith('image/')) {
            fileInfo.preview = content // base64 数据
          } else {
            fileInfo.preview = content.substring(0, 500) + (content.length > 500 ? '...' : '')
          }

        } catch (error) {
          console.error('File read error:', error)
          fileInfo.status = 'error'
          message.error(`读取文件 ${file.name} 失败`)
        }
      }

      // 更新文件列表
      const updatedFileList = [...fileList, ...newFiles]
      setFileList(updatedFileList)

      // 回调通知
      if (onFileAnalyzed) {
        onFileAnalyzed(updatedFileList.filter(f => f.status === 'success'))
      }

      // 如果只有一个文件，自动填充内容
      if (newFiles.length === 1 && newFiles[0].status === 'success' && onFileContentChange) {
        onFileContentChange(newFiles[0].content || '')
      }

      message.success(`成功上传 ${newFiles.filter(f => f.status === 'success').length} 个文件`)

    } catch (error) {
      console.error('Upload error:', error)
      message.error('文件上传失败')
    } finally {
      setUploading(false)
    }
  }, [fileList, maxFiles, maxFileSize, acceptedTypes, onFileAnalyzed, onFileContentChange])

  // 拖拽上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: (file, fileList) => {
      handleFileUpload(fileList)
      return false // 阻止默认上传
    },
    accept: acceptedTypes.join(','),
    disabled: uploading
  }

  // 删除文件
  const removeFile = (fileId: string) => {
    const updatedFileList = fileList.filter(f => f.id !== fileId)
    setFileList(updatedFileList)
    
    if (onFileAnalyzed) {
      onFileAnalyzed(updatedFileList.filter(f => f.status === 'success'))
    }
    
    message.success('文件已删除')
  }

  // 预览文件
  const previewFile = (file: FileInfo) => {
    setPreviewTitle(file.name)
    setPreviewContent(file.content || '')
    setPreviewVisible(true)
  }

  // 复制文件内容
  const copyFileContent = async (content: string) => {
    await copyWithFeedback(
      content,
      (msg) => message.success(msg),
      (msg) => message.error(msg)
    )
  }

  // 使用文件内容
  const useFileContent = (content: string) => {
    if (onFileContentChange) {
      onFileContentChange(content)
      message.success('文件内容已填入输入框')
    }
  }

  return (
    <div className={className}>
      {/* 上传区域 */}
      <Card 
        title={
          <div className="flex items-center space-x-2">
            <CloudUploadOutlined className="text-blue-500" />
            <span>文件上传</span>
            <Tag color="blue">{fileList.length}/{maxFiles}</Tag>
          </div>
        }
        size="small"
        className="mb-4"
      >
        <Dragger {...uploadProps} className="!border-dashed !border-gray-600 !bg-gray-800/50">
          <p className="ant-upload-drag-icon">
            <UploadOutlined className="text-blue-500 text-4xl" />
          </p>
          <p className="ant-upload-text text-gray-300">
            点击或拖拽文件到此区域上传
          </p>
          <p className="ant-upload-hint text-gray-400">
            支持 {acceptedTypes.join(', ')} 格式，单文件最大 {maxFileSize}MB
          </p>
        </Dragger>

        {uploading && (
          <div className="mt-4">
            <Progress percent={100} status="active" showInfo={false} />
            <Text className="text-gray-400">正在处理文件...</Text>
          </div>
        )}
      </Card>

      {/* 文件列表 */}
      {fileList.length > 0 && (
        <Card 
          title="已上传文件" 
          size="small"
          extra={
            <Button 
              size="small" 
              danger 
              onClick={() => setFileList([])}
            >
              清空全部
            </Button>
          }
        >
          <List
            dataSource={fileList}
            renderItem={(file) => (
              <List.Item
                key={file.id}
                actions={[
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => previewFile(file)}
                      disabled={file.status !== 'success'}
                    />
                  </Tooltip>,
                  <Tooltip title="复制内容">
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => copyFileContent(file.content || '')}
                      disabled={file.status !== 'success'}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="确定删除此文件？"
                    onConfirm={() => removeFile(file.id)}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={getFileIcon(file.type)}
                  title={
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-300">{file.name}</span>
                      <Tag 
                        color={
                          file.status === 'success' ? 'green' : 
                          file.status === 'error' ? 'red' : 'blue'
                        }
                      >
                        {file.status === 'success' ? '已完成' : 
                         file.status === 'error' ? '失败' : '处理中'}
                      </Tag>
                    </div>
                  }
                  description={
                    <div className="text-gray-400">
                      <div>大小: {formatFileSize(file.size)}</div>
                      <div>时间: {file.uploadTime.toLocaleString()}</div>
                      {file.preview && !file.type.startsWith('image/') && (
                        <div className="mt-2">
                          <Text className="text-gray-500 text-xs">
                            预览: {file.preview}
                          </Text>
                        </div>
                      )}
                    </div>
                  }
                />
                {file.status === 'success' && onFileContentChange && (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => useFileContent(file.content || '')}
                  >
                    使用内容
                  </Button>
                )}
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 预览模态框 */}
      <Modal
        title={previewTitle}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="copy" onClick={() => copyFileContent(previewContent)}>
            复制内容
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div className="max-h-96 overflow-y-auto">
          <Paragraph className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
            {previewContent}
          </Paragraph>
        </div>
      </Modal>
    </div>
  )
}

export default FileUpload 