'use client'

import React, { useMemo, useRef, useState } from 'react'
import { Badge, Input, Tag, Typography } from 'antd'
import { ApartmentOutlined, BranchesOutlined, BuildOutlined, ClusterOutlined, DesktopOutlined, GlobalOutlined, ProjectOutlined, RocketOutlined, SafetyCertificateOutlined, TagsOutlined } from '@ant-design/icons'
import type { CICDMentionOption } from '../../types/cicd-ai'

const { Text } = Typography

export interface ChatTargetHost {
  id: string
  name: string
  hostname?: string
  ip: string
  status: string
  tags: string[]
  groupId?: string
  groupName?: string
}

export interface HostTargetSelection {
  key: string
  label: string
  type: 'tag' | 'group' | 'host' | 'device' | 'device_group' | 'device_tag' | 'cluster'
  hostIds: string[]
  deviceIds?: string[]
  clusterId?: string
  clusterContext?: string
  defaultNamespace?: string
}

export interface ChatTargetCluster {
  id: string
  name: string
  contextName: string
  defaultNamespace: string
  environment?: string
  status: string
  serverId: string
  server?: { id: string; name: string; ip: string }
}

export interface ChatTargetDevice {
  id: string
  name: string
  managementIp: string
  status: string
  type: string
  vendor: string
  platform: string
  tags: string[]
  groupId?: string
  groupName?: string
  readOnly: boolean
}

interface MentionOption extends HostTargetSelection {
  detail: string
}

interface HostMentionInputProps {
  inputRef?: React.MutableRefObject<any>
  value: string
  onChange: (value: string) => void
  servers: ChatTargetHost[]
  devices?: ChatTargetDevice[]
  clusters?: ChatTargetCluster[]
  selections: HostTargetSelection[]
  onSelectionsChange: (selections: HostTargetSelection[]) => void
  deliveryOptions?: CICDMentionOption[]
  deliverySelections?: CICDMentionOption[]
  onDeliverySelect?: (selection: CICDMentionOption) => void
  onDeliveryRemove?: (selection: CICDMentionOption) => void
  onSubmit: () => void
  disabled?: boolean
}

interface MentionRange {
  start: number
  end: number
  query: string
  trigger: '@' | '#'
}

function detectMention(value: string, cursor: number): MentionRange | null {
  const prefix = value.slice(0, cursor)
  const match = prefix.match(/(?:^|\s)([@#])([^\s@#]*)$/)
  if (!match || match.index === undefined) return null

  const trigger = match[1] as '@' | '#'
  const triggerOffset = match[0].lastIndexOf(trigger)
  return {
    start: match.index + triggerOffset,
    end: cursor,
    query: match[2] || '',
    trigger
  }
}

const HostMentionInput: React.FC<HostMentionInputProps> = ({
  value,
  inputRef: externalInputRef,
  onChange,
  servers,
  devices = [],
  clusters = [],
  selections,
  onSelectionsChange,
  deliveryOptions = [],
  deliverySelections = [],
  onDeliverySelect,
  onDeliveryRemove,
  onSubmit,
  disabled
}) => {
  const localInputRef = useRef<any>(null)
  const inputRef = externalInputRef || localInputRef
  const [mention, setMention] = useState<MentionRange | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const options = useMemo<MentionOption[]>(() => {
    if (!mention || mention.trigger !== '@') return []

    const query = mention.query.trim().toLowerCase()
    const matches = (values: Array<string | undefined>) =>
      query === '' || values.some(item => item?.toLowerCase().includes(query))
    const selectedKeys = new Set(selections.map(item => item.key))
    const next: MentionOption[] = []

    const groups = new Map<string, ChatTargetHost[]>()
    const tags = new Map<string, ChatTargetHost[]>()
    servers.forEach(server => {
      if (server.groupId && server.groupName) {
        const members = groups.get(server.groupId) || []
        members.push(server)
        groups.set(server.groupId, members)
      }
      server.tags.forEach(tag => {
        const normalizedTag = tag.trim()
        if (!normalizedTag) return
        const members = tags.get(normalizedTag) || []
        members.push(server)
        tags.set(normalizedTag, members)
      })
    })

    const deviceGroups = new Map<string, ChatTargetDevice[]>()
    const deviceTags = new Map<string, ChatTargetDevice[]>()
    devices.forEach(device => {
      if (device.groupId && device.groupName) {
        const members = deviceGroups.get(device.groupId) || []
        members.push(device)
        deviceGroups.set(device.groupId, members)
      }
      device.tags.forEach(tag => {
        const normalized = tag.trim()
        if (!normalized) return
        const members = deviceTags.get(normalized) || []
        members.push(device)
        deviceTags.set(normalized, members)
      })
    })

    clusters.forEach(cluster => {
      const key = `cluster:${cluster.id}`
      if (!selectedKeys.has(key) && matches([cluster.name, cluster.contextName, cluster.environment, cluster.defaultNamespace, 'K8s', '集群'])) {
        next.push({ key, label: cluster.name, type: 'cluster', hostIds: [cluster.serverId], clusterId: cluster.id, clusterContext: cluster.contextName, defaultNamespace: cluster.defaultNamespace, detail: `${cluster.contextName} · ${cluster.environment || '未设置环境'}` })
      }
    })

    groups.forEach((members, groupId) => {
      const label = members[0]?.groupName || groupId
      const key = `group:${groupId}`
      if (!selectedKeys.has(key) && matches([label])) {
        next.push({ key, label, type: 'group', hostIds: members.map(item => item.id), detail: `${members.length} 台主机` })
      }
    })

    tags.forEach((members, tag) => {
      const key = `tag:${tag}`
      if (!selectedKeys.has(key) && matches([tag])) {
        next.push({ key, label: tag, type: 'tag', hostIds: members.map(item => item.id), detail: `${members.length} 台主机` })
      }
    })

    deviceGroups.forEach((members, groupId) => {
      const label = members[0]?.groupName || groupId
      const key = `device_group:${groupId}`
      if (!selectedKeys.has(key) && matches([label, '设备组', '网络'])) {
        next.push({ key, label, type: 'device_group', hostIds: [], deviceIds: members.map(item => item.id), detail: `${members.length} 台网络设备` })
      }
    })

    deviceTags.forEach((members, tag) => {
      const key = `device_tag:${tag}`
      if (!selectedKeys.has(key) && matches([tag, '设备标签', '网络'])) {
        next.push({ key, label: tag, type: 'device_tag', hostIds: [], deviceIds: members.map(item => item.id), detail: `${members.length} 台网络设备` })
      }
    })

    devices.forEach(device => {
      const key = `device:${device.id}`
      if (!selectedKeys.has(key) && matches([device.name, device.managementIp, device.vendor, device.platform, device.type, ...device.tags])) {
        next.push({ key, label: device.name, type: 'device', hostIds: [], deviceIds: [device.id], detail: `${device.managementIp} · ${device.vendor}/${device.platform}` })
      }
    })

    servers.forEach(server => {
      const key = `host:${server.id}`
      if (!selectedKeys.has(key) && matches([server.name, server.hostname, server.ip, ...server.tags])) {
        next.push({
          key,
          label: server.name,
          type: 'host',
          hostIds: [server.id],
          detail: `${server.ip}${server.hostname && server.hostname !== server.ip ? ` · ${server.hostname}` : ''}`
        })
      }
    })

    return next.slice(0, 12)
  }, [clusters, devices, mention, selections, servers])

  const matchingDeliveryOptions = useMemo(() => {
    if (!mention || mention.trigger !== '#') return []
    const query = mention.query.trim().toLowerCase()
    const selectedKeys = new Set(deliverySelections.map(item => item.key))
    return deliveryOptions
      .filter(option => !selectedKeys.has(option.key))
      .filter(option => query === '' || [option.label, option.detail].some(text => text.toLowerCase().includes(query)))
      .slice(0, 12)
  }, [deliveryOptions, deliverySelections, mention])

  const activeOptions = mention?.trigger === '#' ? matchingDeliveryOptions : options

  const refreshMention = (nextValue: string, cursor: number) => {
    const nextMention = detectMention(nextValue, cursor)
    setMention(nextMention)
    setActiveIndex(0)
  }

  const selectOption = (option: MentionOption) => {
    if (!mention) return
    const suffixNeedsSpace = value.slice(mention.end).startsWith(' ')
    const nextValue = `${value.slice(0, mention.start)}${suffixNeedsSpace ? '' : ' '}${value.slice(mention.end)}`
    const cursor = mention.start + (suffixNeedsSpace ? 0 : 1)

    onSelectionsChange([...selections, {
      key: option.key,
      label: option.label,
      type: option.type,
      hostIds: option.hostIds,
      deviceIds: option.deviceIds,
      clusterId: option.clusterId,
      clusterContext: option.clusterContext,
      defaultNamespace: option.defaultNamespace
    }])
    onChange(nextValue)
    setMention(null)
    setActiveIndex(0)
    requestAnimationFrame(() => {
      const textarea = inputRef.current?.resizableTextArea?.textArea
      textarea?.focus()
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  const selectDeliveryOption = (option: CICDMentionOption) => {
    if (!mention) return
    const suffixNeedsSpace = value.slice(mention.end).startsWith(' ')
    const nextValue = `${value.slice(0, mention.start)}${suffixNeedsSpace ? '' : ' '}${value.slice(mention.end)}`
    const cursor = mention.start + (suffixNeedsSpace ? 0 : 1)
    onDeliverySelect?.(option)
    onChange(nextValue)
    setMention(null)
    setActiveIndex(0)
    requestAnimationFrame(() => {
      const textarea = inputRef.current?.resizableTextArea?.textArea
      textarea?.focus()
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="relative min-w-0 flex-1">
      {(selections.length > 0 || deliverySelections.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selections.map(selection => (
            <Tag
              key={selection.key}
              color={selection.type === 'cluster' ? 'green' : selection.type === 'host' ? 'blue' : selection.type === 'group' ? 'purple' : selection.type.startsWith('device') ? 'geekblue' : 'cyan'}
              closable={!disabled}
              onClose={() => onSelectionsChange(selections.filter(item => item.key !== selection.key))}
              className="m-0"
            >
              @{selection.label} · {(selection.deviceIds?.length || selection.hostIds.length)}台
            </Tag>
          ))}
          {deliverySelections.map(selection => (
            <Tag
              key={selection.key}
              color={selection.type === 'project' ? 'blue' : selection.type === 'pipeline' ? 'geekblue' : selection.type === 'deployment' ? 'purple' : 'cyan'}
              closable={!disabled}
              onClose={() => onDeliveryRemove?.(selection)}
              className="m-0"
            >
              #{selection.label}
            </Tag>
          ))}
        </div>
      )}

      <Input.TextArea
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          onChange(nextValue)
          refreshMention(nextValue, event.target.selectionStart || nextValue.length)
        }}
        onClick={(event) => refreshMention(value, event.currentTarget.selectionStart || value.length)}
        onKeyDown={(event) => {
          if (mention && activeOptions.length > 0) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex(index => (index + 1) % activeOptions.length)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex(index => (index - 1 + activeOptions.length) % activeOptions.length)
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              const selected = activeOptions[activeIndex] || activeOptions[0]
              if (mention.trigger === '#') selectDeliveryOption(selected as CICDMentionOption)
              else selectOption(selected as MentionOption)
              return
            }
          }
          if (event.key === 'Escape' && mention) {
            event.preventDefault()
            setMention(null)
            return
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit()
          }
        }}
        onBlur={() => window.setTimeout(() => setMention(null), 150)}
        placeholder="输入问题；@ 选择主机、K8s 集群、网络设备或分组，# 选择交付对象"
        autoSize={{ minRows: 1, maxRows: 4 }}
        disabled={disabled}
      />

      {mention && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-80 overflow-y-auto rounded-lg border border-gray-600 bg-gray-900 p-1 shadow-2xl">
          {activeOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">
              {mention.trigger === '#' ? '没有匹配的项目、流水线、发布任务或构建记录' : '没有匹配的主机、网络设备、标签或分组'}
            </div>
          ) : mention.trigger === '#' ? matchingDeliveryOptions.map((option, index) => {
            const icon = option.type === 'project'
              ? <ProjectOutlined />
              : option.type === 'pipeline'
                ? <BranchesOutlined />
              : option.type === 'deployment'
                ? <RocketOutlined />
                : <BuildOutlined />
            return (
              <div
                key={option.key}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectDeliveryOption(option)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between rounded px-3 py-2 ${index === activeIndex ? 'bg-blue-600/30' : 'hover:bg-gray-800'}`}
              >
                <div className="flex min-w-0 items-center gap-2 text-gray-100">
                  {icon}
                  <span className="truncate">#{option.label}</span>
                  <Text className="truncate text-xs text-gray-400">{option.detail}</Text>
                </div>
              </div>
            )
          }) : options.map((option, index) => {
            const host = option.type === 'host' ? servers.find(item => item.id === option.hostIds[0]) : undefined
            const device = option.type === 'device' ? devices.find(item => item.id === option.deviceIds?.[0]) : undefined
            const icon = option.type === 'cluster'
              ? <ClusterOutlined />
              : option.type === 'host'
              ? <DesktopOutlined />
              : option.type === 'group'
                ? <ClusterOutlined />
                : option.type === 'device'
                  ? device?.type === 'firewall' ? <SafetyCertificateOutlined /> : <GlobalOutlined />
                  : option.type === 'device_group'
                    ? <ApartmentOutlined />
                    : <TagsOutlined />
            return (
              <div
                key={option.key}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectOption(option)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between rounded px-3 py-2 ${index === activeIndex ? 'bg-blue-600/30' : 'hover:bg-gray-800'}`}
              >
                <div className="flex min-w-0 items-center gap-2 text-gray-100">
                  {icon}
                  <span className="truncate">@{option.label}</span>
                  <Text className="truncate text-xs text-gray-400">{option.detail}</Text>
                </div>
                {(host || device) && <Badge status={(host?.status || device?.status) === 'online' ? 'success' : 'error'} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HostMentionInput
