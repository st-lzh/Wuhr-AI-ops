'use client'

import React, { useState, useEffect } from 'react'
import { Modal, Button, Typography, Alert, Space, Progress } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, CodeOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

export interface CommandApprovalDialogProps {
  open: boolean
  approvalId: string
  command: string
  description: string
  tool: string
  timeout?: number // 超时时间（秒）
  onApprove: () => void
  onReject: (reason: string) => void
}

export function CommandApprovalDialog({
  open,
  approvalId,
  command,
  description,
  tool,
  timeout = 30,
  onApprove,
  onReject,
}: CommandApprovalDialogProps) {
  const [timeLeft, setTimeLeft] = useState(timeout)
  const [isProcessing, setIsProcessing] = useState(false)

  // 倒计时
  useEffect(() => {
    if (!open) {
      setTimeLeft(timeout)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleReject('操作超时')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [open, timeout])

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await onApprove()
    } catch (error) {
      console.error('批准命令失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (reason: string) => {
    setIsProcessing(true)
    try {
      await onReject(reason)
    } catch (error) {
      console.error('拒绝命令失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const progressPercent = Math.round((timeLeft / timeout) * 100)
  const progressStatus = progressPercent > 50 ? 'normal' : progressPercent > 20 ? 'active' : 'exception'

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined style={{ color: '#faad14' }} />
          <span>命令执行确认</span>
        </Space>
      }
      open={open}
      footer={[
        <Button
          key="reject"
          danger
          icon={<CloseCircleOutlined />}
          onClick={() => handleReject('用户拒绝执行')}
          loading={isProcessing}
          disabled={isProcessing}
        >
          拒绝
        </Button>,
        <Button
          key="approve"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={handleApprove}
          loading={isProcessing}
          disabled={isProcessing}
        >
          批准执行
        </Button>,
      ]}
      closable={false}
      maskClosable={false}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 倒计时进度条 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Text type="secondary">剩余时间</Text>
            <Text strong>{timeLeft}秒</Text>
          </div>
          <Progress
            percent={progressPercent}
            status={progressStatus}
            showInfo={false}
            strokeColor={progressPercent > 50 ? '#52c41a' : progressPercent > 20 ? '#1890ff' : '#ff4d4f'}
          />
        </div>

        {/* 警告提示 */}
        <Alert
          message="请仔细审查以下命令"
          description="批准后将在远程主机上执行，请确认命令安全性"
          type="warning"
          showIcon
        />

        {/* 命令详情 */}
        <div>
          <Text strong>执行工具:</Text>
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
            <Space>
              <CodeOutlined />
              <Text code>{tool}</Text>
            </Space>
          </div>
        </div>

        <div>
          <Text strong>命令描述:</Text>
          <Paragraph className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
            {description}
          </Paragraph>
        </div>

        <div>
          <Text strong>待执行命令:</Text>
          <div className="mt-2 p-3 bg-gray-900 rounded">
            <Text code style={{ color: '#52c41a', fontFamily: 'monospace' }}>
              $ {command}
            </Text>
          </div>
        </div>

        {/* 批准ID（调试用） */}
        <div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            批准ID: {approvalId}
          </Text>
        </div>
      </Space>
    </Modal>
  )
}
