// 审批记录服务
import { getPrismaClient } from '../../lib/config/database'
import { ApprovalType, ApprovalStatus } from '../../lib/generated/prisma'

export interface CreateApprovalRecordParams {
  approvalType: ApprovalType
  targetId: string
  targetName: string
  operatorId: string
  operatorName: string
  action: 'approved' | 'rejected'
  comment?: string
  metadata?: any
}

export interface ApprovalRecordQuery {
  approvalType?: ApprovalType
  targetId?: string
  operatorId?: string
  action?: ApprovalStatus
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
}

class ApprovalRecordService {
  /**
   * 创建审批记录
   */
  static async createRecord(params: CreateApprovalRecordParams) {
    try {
      const prisma = await getPrismaClient()
      
      const record = await prisma.approvalRecord.create({
        data: {
          approvalType: params.approvalType,
          targetId: params.targetId,
          targetName: params.targetName,
          operatorId: params.operatorId,
          operatorName: params.operatorName,
          action: params.action as ApprovalStatus,
          comment: params.comment,
          metadata: params.metadata,
          operatedAt: new Date()
        },
        include: {
          operator: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      })

      console.log('✅ 审批记录已创建:', {
        id: record.id,
        type: record.approvalType,
        target: record.targetName,
        operator: record.operatorName,
        action: record.action
      })

      return record
    } catch (error) {
      console.error('❌ 创建审批记录失败:', error)
      throw error
    }
  }

  /**
   * 查询审批记录
   */
  static async getRecords(query: ApprovalRecordQuery = {}) {
    try {
      const prisma = await getPrismaClient()
      
      const {
        approvalType,
        targetId,
        operatorId,
        action,
        startDate,
        endDate,
        page = 1,
        pageSize = 20
      } = query

      const where: any = {}

      if (approvalType) {
        where.approvalType = approvalType
      }

      if (targetId) {
        where.targetId = targetId
      }

      if (operatorId) {
        where.operatorId = operatorId
      }

      if (action) {
        where.action = action
      }

      if (startDate || endDate) {
        where.operatedAt = {}
        if (startDate) {
          where.operatedAt.gte = startDate
        }
        if (endDate) {
          where.operatedAt.lte = endDate
        }
      }

      const [records, total] = await Promise.all([
        prisma.approvalRecord.findMany({
          where,
          include: {
            operator: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            operatedAt: 'desc'
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.approvalRecord.count({ where })
      ])

      return {
        records,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    } catch (error) {
      console.error('❌ 查询审批记录失败:', error)
      throw error
    }
  }

  /**
   * 获取审批统计信息
   */
  static async getStatistics(operatorId?: string) {
    try {
      const prisma = await getPrismaClient()
      
      const where: any = {}
      if (operatorId) {
        where.operatorId = operatorId
      }

      // 获取今日、本周、本月的统计
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [
        totalRecords,
        todayRecords,
        weeklyRecords,
        monthlyRecords,
        approvedRecords,
        rejectedRecords,
        todayApproved,
        todayRejected
      ] = await Promise.all([
        prisma.approvalRecord.count({ where }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            operatedAt: { gte: todayStart }
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            operatedAt: { gte: weekStart }
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            operatedAt: { gte: monthStart }
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            action: 'approved'
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            action: 'rejected'
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            action: 'approved',
            operatedAt: { gte: todayStart }
          }
        }),
        prisma.approvalRecord.count({
          where: {
            ...where,
            action: 'rejected',
            operatedAt: { gte: todayStart }
          }
        })
      ])

      return {
        totalRecords,
        todayRecords,
        weeklyRecords,
        monthlyRecords,
        approvedRecords,
        rejectedRecords,
        todayApproved,
        todayRejected,
        approvalRate: totalRecords > 0 ? (approvedRecords / totalRecords * 100).toFixed(1) : '0'
      }
    } catch (error) {
      console.error('❌ 获取审批统计失败:', error)
      throw error
    }
  }

  /**
   * 获取最近的审批活动
   */
  static async getRecentActivities(limit = 10) {
    try {
      const prisma = await getPrismaClient()
      
      const records = await prisma.approvalRecord.findMany({
        include: {
          operator: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        },
        orderBy: {
          operatedAt: 'desc'
        },
        take: limit
      })

      return records
    } catch (error) {
      console.error('❌ 获取最近审批活动失败:', error)
      throw error
    }
  }
}

export default ApprovalRecordService
