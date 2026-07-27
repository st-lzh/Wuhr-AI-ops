'use client'

/**
 * DecisionLogDrawer — 聊天页右侧的"AI 决策记录"抽屉
 *
 * 展示对当前会话有影响的 self-improving 资产：
 *   1. 注入到 LLM system prompt 的 lesson（TopK 条）
 *   2. 最近一段时间内的 skill 执行历史（outcomes）
 *   3. 触发 reflect / 跳转管理页的快捷入口
 *
 * 设计原则：
 *   - **失败安全**：后端没启用 self-improving / 没配 API key 时，显示提示而不报错
 *   - **不阻塞 chat**：所有调用走轻量 fetch，不影响聊天主流
 *   - **打开时才加载**：抽屉关闭时不发请求
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Drawer,
  Tabs,
  Typography,
  Tag,
  List,
  Empty,
  Spin,
  Alert,
  Button,
  Space,
  Tooltip,
  Badge,
} from 'antd'
import {
  ReloadOutlined,
  BulbOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RightOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { improveClient } from '../../utils/improveClient'
import type { Lesson, Outcome, LessonSeverity, OutcomeStatus } from '../../types/improve'
import type { ChatMessage } from '../../types/chat'

const { Title, Text, Paragraph } = Typography

const SEVERITY_COLOR: Record<LessonSeverity, string> = {
  info: 'blue',
  warn: 'orange',
  critical: 'red',
}

const STATUS_COLOR: Record<OutcomeStatus, string> = {
  success: 'green',
  failure: 'red',
  error: 'orange',
  skipped: 'default',
}

interface Props {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
}

const SESSION_TYPE_META: Record<string, { label: string; color: string }> = {
  thinking: { label: '推理', color: 'blue' },
  command: { label: '执行命令', color: 'purple' },
  output: { label: '执行结果', color: 'green' },
  text: { label: 'AI 回复', color: 'cyan' },
  command_approved: { label: '人工批准', color: 'green' },
  command_rejected: { label: '人工拒绝', color: 'red' },
}

const DecisionLogDrawer: React.FC<Props> = ({ open, onClose, messages }) => {
  const [activeTab, setActiveTab] = useState<'session' | 'lessons' | 'outcomes'>('session')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [outcomes, setOutcomes] = useState<Outcome[]>([])

  // 执行流程随 AI 消息 metadata 一起写入 Redis；加载历史会话后这里仍可恢复。
  const sessionDecisions = useMemo(() => {
    return messages.flatMap((chatMessage, messageIndex) => {
      const streamData = chatMessage.metadata?.agentStreamData || []
      return streamData
        .filter((item) => item.content)
        .map((item, itemIndex) => ({
          id: `${chatMessage.id}-${messageIndex}-${itemIndex}`,
          type: item.type,
          content: item.content || '',
          timestamp: item.timestamp || chatMessage.timestamp,
          metadata: item.metadata,
        }))
    })
  }, [messages])

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    setErrorCode(null)
    try {
      // 并行拉 TopK lesson + 最近 50 条 outcome
      const [lessonsResp, outcomesResp] = await Promise.all([
        improveClient.listLessons({ top_k: 10 }),
        improveClient.listOutcomes({ since_seconds: 24 * 3600, limit: 50 }),
      ])
      setLessons(lessonsResp.lessons || [])
      setOutcomes(outcomesResp.outcomes || [])
    } catch (e: any) {
      setErrorMsg(e?.message || '加载失败')
      setErrorCode(e?.code || null)
      setLessons([])
      setOutcomes([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 打开时才拉数据；关闭不浪费请求
  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  const renderErrorAlert = () => {
    if (!errorMsg) return null
    // backend_misconfigured / improve_disabled 给具体提示
    if (errorCode === 'backend_misconfigured') {
      return (
        <Alert
          type="warning"
          showIcon
          message="后端 API key 未配置"
          description="管理员需要在前端 .env.local 设置 IMPROVE_API_KEY，以及后端 api_keys.yaml 配 admin role key。"
          className="mb-3"
        />
      )
    }
    if (errorCode === 'improve_disabled') {
      return (
        <Alert
          type="info"
          showIcon
          message="后端 self-improving 未启用"
          description="启动 kubelet-wuhrai 时需要带 --improve-enabled 才能用 AI 资产功能。"
          className="mb-3"
        />
      )
    }
    return (
      <Alert
        type="error"
        showIcon
        message="加载 AI 资产失败"
        description={errorMsg}
        className="mb-3"
      />
    )
  }

  return (
    <Drawer
      title={
        <Space>
          <BulbOutlined />
          <span>AI 决策记录</span>
        </Space>
      }
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          刷新
        </Button>
      }
    >
      <Paragraph type="secondary">
        当前会话的命令选择和执行结果随聊天消息写入 Redis；Lesson 与 Skill Outcome 写入后端
        improve 数据目录。这里不生成演示数据，刷新或重新加载历史会话后仍可读取。
      </Paragraph>

      {renderErrorAlert()}

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        items={[
          {
            key: 'session',
            label: (
              <Space size={4}>
                <CodeOutlined />
                <span>当前会话</span>
                <Badge count={sessionDecisions.length} showZero size="small" />
              </Space>
            ),
          },
          {
            key: 'lessons',
            label: (
              <Space size={4}>
                <BulbOutlined />
                <span>当前 Lesson</span>
                <Badge count={lessons.length} showZero size="small" />
              </Space>
            ),
          },
          {
            key: 'outcomes',
            label: (
              <Space size={4}>
                <HistoryOutlined />
                <span>近 24h skill</span>
                <Badge count={outcomes.length} showZero size="small" />
              </Space>
            ),
          },
        ]}
      />

      <Spin spinning={loading}>
        {activeTab === 'session' && (
          <>
            {sessionDecisions.length === 0 && (
              <Empty description="当前会话还没有产生可记录的命令决策或执行结果。" />
            )}
            <List
              dataSource={sessionDecisions}
              renderItem={(item) => {
                const typeMeta = SESSION_TYPE_META[item.type] || {
                  label: item.type,
                  color: 'default',
                }
                return (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={typeMeta.color}>{typeMeta.label}</Tag>
                          {item.metadata?.toolName && (
                            <Text type="secondary">{item.metadata.toolName}</Text>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(item.timestamp).toLocaleString('zh-CN')}
                          </Text>
                          <Paragraph
                            ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                            style={{ marginTop: 4, marginBottom: 0, whiteSpace: 'pre-wrap' }}
                            code={item.type === 'command'}
                          >
                            {item.content}
                          </Paragraph>
                        </div>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          </>
        )}

        {activeTab === 'lessons' && (
          <>
            {lessons.length === 0 && !loading && (
              <Empty
                description={
                  errorMsg
                    ? '由于上方错误，未能加载'
                    : '当前没有生效中的 lesson。让 agent 跑几次失败的命令后，反思器会自动积累。'
                }
              />
            )}
            <List
              dataSource={lessons}
              renderItem={(l) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={SEVERITY_COLOR[l.severity] || 'default'}>
                          {l.severity}
                        </Tag>
                        <Text strong>{l.skill_pattern || '全局'}</Text>
                      </Space>
                    }
                    description={
                      <div>
                        <Paragraph
                          ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                          style={{ marginBottom: 4 }}
                        >
                          {l.text}
                        </Paragraph>
                        {(l.scope_project || l.scope_cluster) && (
                          <Space size={4}>
                            {l.scope_project && <Tag color="geekblue">project: {l.scope_project}</Tag>}
                            {l.scope_cluster && <Tag color="cyan">cluster: {l.scope_cluster}</Tag>}
                          </Space>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}

        {activeTab === 'outcomes' && (
          <>
            {outcomes.length === 0 && !loading && (
              <Empty
                description={
                  errorMsg
                    ? '由于上方错误，未能加载'
                    : '最近 24 小时没有 skill 执行记录。'
                }
              />
            )}
            <List
              dataSource={outcomes}
              renderItem={(o) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={STATUS_COLOR[o.status] || 'default'}>{o.status}</Tag>
                        <Text strong>{o.skill_name}</Text>
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(o.timestamp).toLocaleString('zh-CN')}
                          {o.actor && ` · ${o.actor}`}
                          {o.exit_code !== 0 && ` · exit ${o.exit_code}`}
                        </Text>
                        {o.stderr_tail && (
                          <Tooltip
                            title={
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {o.stderr_tail}
                              </pre>
                            }
                          >
                            <Paragraph
                              ellipsis={{ rows: 1 }}
                              style={{ marginBottom: 0, fontSize: 12 }}
                              type="danger"
                            >
                              {o.stderr_tail}
                            </Paragraph>
                          </Tooltip>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Spin>

      {/* 底部跳转 */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Link href="/improve/lessons">
            <Button block icon={<BulbOutlined />} type="default">
              管理教训库 <RightOutlined />
            </Button>
          </Link>
          <Link href="/improve/outcomes">
            <Button block icon={<HistoryOutlined />} type="default">
              全部执行历史 <RightOutlined />
            </Button>
          </Link>
        </Space>
      </div>
    </Drawer>
  )
}

export default DecisionLogDrawer
