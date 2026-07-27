export type CICDContextKind = 'project' | 'pipeline' | 'deployment' | 'build'

export interface CICDProjectOption {
  id: string
  name: string
  description?: string | null
  environment: string
  branch: string
  repositoryUrl: string
  isActive: boolean
  serverId?: string | null
  updatedAt: string
}

export interface CICDDeploymentOption {
  id: string
  name: string
  description?: string | null
  projectId?: string | null
  projectName?: string | null
  environment: string
  version?: string | null
  status: string
  requireApproval: boolean
  isJenkinsDeployment: boolean
  updatedAt: string
}

export interface CICDPipelineOption {
  id: string
  name: string
  description?: string | null
  projectId: string
  projectName: string
  jenkinsJobName: string
  isActive: boolean
  buildCount: number
  updatedAt: string
}

export interface CICDBuildOption {
  id: string
  name: string
  projectId?: string | null
  projectName?: string | null
  pipelineId?: string | null
  pipelineName?: string | null
  buildNumber: number
  status: string
  result?: string | null
  updatedAt: string
}

export interface CICDCatalog {
  projects: CICDProjectOption[]
  pipelines: CICDPipelineOption[]
  deployments: CICDDeploymentOption[]
  builds: CICDBuildOption[]
}

export interface CICDContextSelection {
  kind?: CICDContextKind
  projectId?: string
  pipelineId?: string
  deploymentId?: string
  buildId?: string
  projectName?: string
  pipelineName?: string
  deploymentName?: string
  buildName?: string
}

export interface CICDMentionOption {
  key: string
  id: string
  type: CICDContextKind
  label: string
  detail: string
  projectId?: string | null
}
