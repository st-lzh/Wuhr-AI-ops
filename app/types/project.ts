// 项目管理相关类型定义

export interface Project {
  id: string
  name: string
  description?: string
  repository?: string
  branch: string
  ownerId: string
  assigneeIds: string[]
  isActive: boolean
  config?: any
  createdAt: Date
  updatedAt: Date
}

export interface ProjectWithOwner extends Project {
  owner: {
    id: string
    username: string
    email: string
  }
  assignees: Array<{
    id: string
    username: string
    email: string
  }>
}

export interface CreateProjectData {
  name: string
  description?: string
  repository?: string
  branch?: string
  assigneeIds?: string[]
  config?: any
}

export interface UpdateProjectData {
  name?: string
  description?: string
  repository?: string
  branch?: string
  assigneeIds?: string[]
  isActive?: boolean
  config?: any
}

export interface ProjectMember {
  id: string
  username: string
  email: string
  role: 'admin' | 'manager' | 'developer' | 'viewer'
  addedAt: Date
}

export interface ProjectStats {
  totalProjects: number
  activeProjects: number
  totalDeployments: number
  successfulDeployments: number
  failedDeployments: number
  lastDeployment?: Date
}

// API 响应类型
export interface ProjectListResponse {
  projects: ProjectWithOwner[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ProjectResponse {
  project: ProjectWithOwner
}

// API 请求类型
export interface CreateProjectRequest {
  name: string
  description?: string
  repository?: string
  branch?: string
  assigneeIds?: string[]
  config?: any
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  repository?: string
  branch?: string
  assigneeIds?: string[]
  isActive?: boolean
  config?: any
}

export interface AddProjectMemberRequest {
  userIds: string[]
}

export interface RemoveProjectMemberRequest {
  userIds: string[]
}
