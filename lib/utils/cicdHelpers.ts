// CI/CD 公共工具函数
// 提取重复的权限检查、数据库查询和响应格式化逻辑

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../auth/apiHelpers-new'
import { getPrismaClient } from '../config/database'

/**
 * 标准化的API响应格式
 */
export interface StandardApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
}

/**
 * 创建标准化的成功响应
 */
export function createSuccessResponse<T>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  })
}

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(error: string, status: number = 500): NextResponse {
  return NextResponse.json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  }, { status })
}

/**
 * CI/CD资源权限检查
 */
export async function checkCICDResourcePermission(
  request: NextRequest,
  resourceType: 'project' | 'jenkins' | 'deployment' | 'build' | 'pipeline',
  resourceId: string,
  action: 'read' | 'write' | 'delete' = 'read'
) {
  try {
    // 基础认证检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return {
        success: false,
        response: authResult.response,
        user: null,
        resource: null
      }
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    // 根据资源类型查询并验证权限
    let resource = null
    let hasPermission = false

    switch (resourceType) {
      case 'project':
        resource = await prisma.cICDProject.findFirst({
          where: { id: resourceId, userId: user.id }
        })
        hasPermission = !!resource
        break

      case 'jenkins':
        resource = await prisma.jenkinsConfig.findFirst({
          where: { id: resourceId, userId: user.id }
        })
        hasPermission = !!resource
        break

      case 'deployment':
        resource = await prisma.deployment.findFirst({
          where: { id: resourceId, userId: user.id }
        })
        hasPermission = !!resource
        break

      case 'build':
        resource = await prisma.build.findFirst({
          where: { id: resourceId, userId: user.id }
        })
        hasPermission = !!resource
        break

      case 'pipeline':
        resource = await prisma.pipeline.findFirst({
          where: { id: resourceId, userId: user.id }
        })
        hasPermission = !!resource
        break

      default:
        return {
          success: false,
          response: createErrorResponse('不支持的资源类型', 400),
          user: null,
          resource: null
        }
    }

    if (!resource) {
      return {
        success: false,
        response: createErrorResponse(`${resourceType}不存在或无权限访问`, 404),
        user,
        resource: null
      }
    }

    if (!hasPermission) {
      return {
        success: false,
        response: createErrorResponse('无权限访问此资源', 403),
        user,
        resource
      }
    }

    return {
      success: true,
      response: null,
      user,
      resource
    }

  } catch (error) {
    console.error('权限检查失败:', error)
    return {
      success: false,
      response: createErrorResponse('权限检查失败', 500),
      user: null,
      resource: null
    }
  }
}

/**
 * 获取CI/CD项目详情（包含关联数据）
 */
export async function getCICDProjectWithDetails(projectId: string, userId: string) {
  const prisma = await getPrismaClient()

  return await prisma.cICDProject.findFirst({
    where: { id: projectId, userId },
    include: {
      server: {
        select: {
          id: true,
          name: true,
          hostname: true
        }
      },
      gitCredential: {
        select: {
          id: true,
          name: true,
          platform: true
        }
      },
      _count: {
        select: {
          deployments: true,
          pipelines: true
        }
      }
    }
  })
}

/**
 * 获取Jenkins配置详情（包含关联数据）
 */
export async function getJenkinsConfigWithDetails(configId: string, userId: string) {
  const prisma = await getPrismaClient()

  return await prisma.jenkinsConfig.findFirst({
    where: { id: configId, userId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      },
      _count: {
        select: {
          builds: true,
          jobConfigs: true
        }
      }
    }
  })
}

/**
 * 获取部署详情（包含关联数据）
 */
export async function getDeploymentWithDetails(deploymentId: string, userId: string) {
  const prisma = await getPrismaClient()

  return await prisma.deployment.findFirst({
    where: { id: deploymentId, userId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          repositoryUrl: true,
          branch: true,
          buildScript: true,
          deployScript: true,
          serverId: true
        }
      },
      approvals: {
        include: {
          approver: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      }
    }
  })
}

/**
 * 获取构建详情（包含关联数据）
 */
export async function getBuildWithDetails(buildId: string, userId: string) {
  const prisma = await getPrismaClient()
  
  return await prisma.build.findFirst({
    where: { id: buildId, userId },
    include: {
      jenkinsConfig: {
        select: {
          id: true,
          name: true,
          serverUrl: true
        }
      },
      pipeline: {
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      }
    }
  })
}

/**
 * 验证资源状态是否允许操作
 */
export function validateResourceStatus(
  resource: any,
  allowedStatuses: string[],
  operation: string
): { valid: boolean; error?: string } {
  if (!resource.status) {
    return { valid: true } // 如果没有状态字段，默认允许
  }

  if (!allowedStatuses.includes(resource.status)) {
    return {
      valid: false,
      error: `当前状态(${resource.status})不允许${operation}操作`
    }
  }

  return { valid: true }
}
