// 认证相关输入验证Schema
import { z } from 'zod'

// 用户名验证
const usernameSchema = z
  .string()
  .min(3, '用户名至少3个字符')
  .max(20, '用户名不能超过20个字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符')

// 邮箱验证
const emailSchema = z
  .string()
  .email('邮箱格式无效')
  .max(100, '邮箱长度不能超过100个字符')

// 密码验证
const passwordSchema = z
  .string()
  .min(6, '密码至少6个字符')
  .max(128, '密码不能超过128个字符')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    '密码必须包含大写字母、小写字母、数字和特殊字符')

// 简单密码验证（用于某些场景）
const simplePasswordSchema = z
  .string()
  .min(6, '密码至少6个字符')
  .max(128, '密码不能超过128个字符')

// 登录请求验证
export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  rememberMe: z.boolean().optional()
})

// 注册请求验证
export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: z.string()
    .min(8, '密码至少8个字符')
    .max(128, '密码不能超过128个字符')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含大小写字母和数字'),
  confirmPassword: z.string(),
  realName: z.string()
    .min(2, '真实姓名至少2个字符')
    .max(10, '真实姓名最多10个字符'),
  reason: z.string()
    .min(10, '申请理由至少10个字符')
    .max(200, '申请理由最多200个字符')
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
})

// Token刷新请求验证
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token不能为空')
})

// 更新资料请求验证
export const updateProfileSchema = z.object({
  email: emailSchema.optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
  confirmPassword: z.string().optional()
}).refine((data) => {
  // 如果要更新密码，必须提供当前密码
  if (data.newPassword && !data.currentPassword) {
    return false
  }
  return true
}, {
  message: '更新密码时必须提供当前密码',
  path: ['currentPassword']
}).refine((data) => {
  // 如果要更新密码，新密码和确认密码必须一致
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false
  }
  return true
}, {
  message: '新密码和确认密码不一致',
  path: ['confirmPassword']
})

// 管理员创建用户请求验证
export const adminCreateUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: simplePasswordSchema,
  role: z.enum(['admin', 'manager', 'developer', 'viewer'], {
    errorMap: () => ({ message: '无效的用户角色' })
  }),
  isActive: z.boolean().optional().default(true)
})

// 管理员更新用户请求验证
export const adminUpdateUserSchema = z.object({
  email: emailSchema.optional(),
  role: z.enum(['admin', 'manager', 'developer', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  password: simplePasswordSchema.optional()
})

// 修改密码请求验证
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '新密码和确认密码不一致',
  path: ['confirmPassword']
})

// 重置密码请求验证
export const resetPasswordRequestSchema = z.object({
  email: emailSchema
})

// 重置密码确认验证
export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '新密码和确认密码不一致',
  path: ['confirmPassword']
})

// 验证邮箱请求
export const verifyEmailSchema = z.object({
  token: z.string().min(1, '验证令牌不能为空')
})

// 用户查询参数验证
export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  role: z.enum(['admin', 'manager', 'developer', 'viewer']).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional()
})

// 认证日志查询参数验证
export const authLogQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  action: z.enum(['login', 'logout', 'register', 'password_change', 'failed_login', 'token_refresh']).optional(),
  success: z.coerce.boolean().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

// 权限检查参数验证
export const permissionSchema = z.object({
  permission: z.string().min(1, '权限名称不能为空')
})

// 批量操作参数验证
export const batchOperationSchema = z.object({
  userIds: z.array(z.string()).min(1, '至少选择一个用户'),
  action: z.enum(['activate', 'deactivate', 'delete']),
  confirm: z.boolean().refine(val => val === true, {
    message: '必须确认批量操作'
  })
})

// API Key 相关验证
export const apiKeySchema = z.object({
  name: z.string().min(1, 'API Key名称不能为空').max(50, '名称长度不能超过50个字符'),
  permissions: z.array(z.string()).min(1, '至少选择一个权限'),
  expiresAt: z.string().optional(), // ISO date string
  description: z.string().max(200, '描述长度不能超过200个字符').optional()
})

// 会话管理验证
export const sessionQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  userId: z.string().optional(),
  isActive: z.coerce.boolean().optional()
})

// 导出类型推断
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>
export type UserQueryInput = z.infer<typeof userQuerySchema>
export type AuthLogQueryInput = z.infer<typeof authLogQuerySchema>
export type PermissionInput = z.infer<typeof permissionSchema>
export type BatchOperationInput = z.infer<typeof batchOperationSchema>
export type ApiKeyInput = z.infer<typeof apiKeySchema>
export type SessionQueryInput = z.infer<typeof sessionQuerySchema> 