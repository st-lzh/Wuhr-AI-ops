export type NetworkDeviceStatus = 'online' | 'offline' | 'warning' | 'error' | 'unknown' | 'maintenance'

export interface DeviceCapabilities {
  ssh: boolean
  netconf: boolean
  restconf: boolean
  gnmi: boolean
  snmp: boolean
  configBackup: boolean
  candidateConfig: boolean
  commitConfirm: boolean
  automaticRollback: boolean
}

export interface NetworkDevice {
  id: string
  name: string
  displayName?: string
  type: string
  vendor: string
  platform: string
  model?: string
  osVersion?: string
  managementIp: string
  port: number
  username: string
  authType: 'password' | 'key'
  groupId?: string
  tags: string[]
  location?: string
  environment?: string
  status: NetworkDeviceStatus
  lastConnectedAt?: string
  lastError?: string
  readOnly: boolean
  capabilities: DeviceCapabilities
  connectionMethod: string
  description?: string
  hasCredential: boolean
  createdAt: string
  updatedAt: string
}

export interface NetworkDeviceInput extends Omit<Partial<NetworkDevice>, 'id' | 'status' | 'hasCredential' | 'createdAt' | 'updatedAt'> {
  name: string
  type: string
  vendor: string
  platform: string
  managementIp: string
  username: string
  password?: string
  passwordRef?: string
  keyRef?: string
}

export interface NetworkGroup { id: string; name: string; description?: string; color?: string; environment?: string; tags: string[]; createdAt: string; updatedAt: string }
export interface ConfigSnapshot { id: string; deviceId: string; deviceName: string; version: number; content?: string; contentHash: string; source: string; reason?: string; capturedBy: string; createdAt: string }
export interface ChangeTarget { deviceId: string; deviceName: string; vendor: string; platform: string; commands: string[]; verificationCommands?: string[]; status: string; output?: string; verificationOutput?: string; error?: string; durationMs?: number; snapshotId?: string }
export interface NetworkChange { id: string; title: string; intent: string; operation: string; parameters?: Record<string,string>; riskLevel: 'low'|'medium'|'high'|'critical'; riskReasons: string[]; status: string; requiresApproval: boolean; targets: ChangeTarget[]; requestedBy: string; approvedBy?: string; approvedAt?: string; decisionReason?: string; summary?: string; createdAt: string; updatedAt: string }
export interface InspectionRun { id: string; name: string; profile: string; deviceIds: string[]; status: string; results: ChangeTarget[]; requestedBy: string; createdAt: string; completedAt?: string }
export interface NetworkAlert { id: string; deviceId?: string; deviceName?: string; level: string; category: string; title: string; message: string; resolved: boolean; resolvedBy?: string; resolvedAt?: string; resolution?: string; createdAt: string }
export interface TopologyLink { id: string; sourceDeviceId: string; sourcePort: string; targetDeviceId: string; targetPort: string; protocol?: string; status: string; discovered: boolean; updatedAt: string }
export interface NetworkOverview { devices: number; online: number; groups: number; pendingChanges: number; unresolvedAlerts: number; snapshots: number }
export interface NetworkApiResponse<T> { success: boolean; data: T; error?: string; code?: string }
