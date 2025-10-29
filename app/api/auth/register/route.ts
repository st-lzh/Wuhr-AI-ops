import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequest, 
  successResponse, 
  errorResponse, 
  serverErrorResponse,
  rateLimit,
  authRateLimiter,
  logAuthEvent,
  ensureDbInitialized,
  db,
  AUTH_ERRORS
} from '../../../../lib/auth/apiHelpers'
import { registerSchema, type RegisterInput } from '../../../../lib/auth/validation'
import { hashPassword, validatePasswordStrength } from '../../../../lib/auth/password'
import { RegisterResponse } from '../../../types/api'
import { getPrismaClient } from '../../../../lib/config/database'
import NotificationService from '../../../services/notificationService'

export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDbInitialized()

    // 频率限制检查
    const rateLimitResult = rateLimit(authRateLimiter)(request)
    if (rateLimitResult) {
      await logAuthEvent('failed_login', request, undefined, undefined, false, '频率限制')
      return rateLimitResult
    }

    // 先获取请求体进行调试
    const body = await request.json()
    console.log('📋 注册请求体:', body)

    // 重新创建request对象用于验证（因为body已经被读取了）
    const newRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(body)
    })

    // 验证请求数据
    const validationResult = await validateRequest<RegisterInput>(newRequest, registerSchema)
    if (!validationResult.success) {
      console.error('❌ 注册参数验证失败')
      return validationResult.response
    }

    const { username, email, password, realName, reason } = validationResult.data

    console.log('📝 用户注册申请:', { username, email, realName })

    // 获取 Prisma 客户端
    const prisma = await getPrismaClient()

    // 检查用户名和邮箱是否已存在（包括已注册用户和待审批申请）
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    })

    if (existingUser) {
      let errorMessage = ''
      let errorDetails = []

      if (existingUser.username === username) {
        errorMessage = '用户名已被使用'
        errorDetails.push({
          field: 'username',
          message: `用户名 "${username}" 已被其他用户使用，请选择其他用户名`
        })
      }

      if (existingUser.email === email) {
        errorMessage = '邮箱已被注册'
        errorDetails.push({
          field: 'email',
          message: `邮箱 "${email}" 已被注册或有待审批的申请，请使用其他邮箱`
        })
      }

      if (existingUser.username === username && existingUser.email === email) {
        errorMessage = '用户名和邮箱都已被使用'
      }

      await logAuthEvent('register', request, undefined, username, false, errorMessage)

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: JSON.stringify(errorDetails),
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    // 检查是否已有待审批的申请
    const existingApplication = await prisma.userRegistration.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ],
        status: 'PENDING'
      }
    })

    if (existingApplication) {
      await logAuthEvent('register', request, undefined, username, false, '已有待审批申请')

      let errorMessage = ''
      let errorDetails = []

      if (existingApplication.username === username && existingApplication.email === email) {
        errorMessage = '您已有待审批的注册申请'
        errorDetails.push({
          field: 'general',
          message: `用户名 "${username}" 和邮箱 "${email}" 已有待审批的注册申请，请耐心等待管理员审批`
        })
      } else if (existingApplication.username === username) {
        errorMessage = '用户名已有待审批申请'
        errorDetails.push({
          field: 'username',
          message: `用户名 "${username}" 已有待审批的注册申请，请选择其他用户名或等待审批完成`
        })
      } else if (existingApplication.email === email) {
        errorMessage = '邮箱已有待审批申请'
        errorDetails.push({
          field: 'email',
          message: `邮箱 "${email}" 已有待审批的注册申请，请使用其他邮箱或等待审批完成`
        })
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: JSON.stringify(errorDetails),
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    // 验证密码强度
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      await logAuthEvent('register', request, undefined, username, false, '密码强度不足')
      return errorResponse(
        AUTH_ERRORS.WEAK_PASSWORD.message,
        passwordValidation.errors.join(', '),
        400
      )
    }

    // 验证必填字段
    if (!realName || !reason) {
      await logAuthEvent('register', request, undefined, username, false, '缺少必填字段')
      return errorResponse('请填写真实姓名和申请理由', undefined, 400)
    }

    // 加密密码
    const hashedPassword = await hashPassword(password)

    // 创建注册申请记录
    const registration = await prisma.userRegistration.create({
      data: {
        username,
        email,
        password: hashedPassword,
        realName,
        reason,
        status: 'PENDING'
      }
    })

    // 记录注册申请日志（不传userId，因为用户还未创建）
    await logAuthEvent('register', request, undefined, username, true, '注册申请已提交')

    // 通知所有管理员有新用户注册申请
    try {
      await NotificationService.notifyAdminsUserRegistration({
        id: registration.id,
        username: registration.username,
        email: registration.email
      })
      console.log('✅ 已通知管理员审批新用户申请:', username)
    } catch (error) {
      console.error('❌ 通知管理员失败:', error)
      // 不影响注册流程，只记录错误
    }

    // 构建响应数据（不包含敏感信息）
    const registerResponse: RegisterResponse = {
      user: {
        id: registration.id,
        username: registration.username,
        email: registration.email,
        role: 'viewer' // 默认角色，审批后创建用户时使用
      },
      message: '注册申请已提交！请等待管理员审批，审批通过后即可登录使用。'
    }

    console.log('✅ 用户注册申请已提交:', {
      registrationId: registration.id,
      username: registration.username,
      email: registration.email,
      realName: registration.realName
    })

    return successResponse(registerResponse, 201)

  } catch (error) {
    console.error('❌ 注册API错误:', error)
    await logAuthEvent('register', request, undefined, undefined, false, '系统错误')
    return serverErrorResponse(error)
  }
} 