import { getPrismaClient } from './database'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 开始数据库种子数据初始化...')

  const prisma = await getPrismaClient()

  // 检查是否已存在管理员用户
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'admin' },
        { email: 'admin@wuhr.ai' }
      ]
    }
  })

  if (existingAdmin) {
    console.log('✅ 管理员用户已存在，跳过创建')
    return
  }

  // 创建管理员用户
  const hashedPassword = await bcrypt.hash('Admin123!', 12)
  
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@wuhr.ai',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      approvalStatus: 'approved',
      permissions: ['read', 'write', 'admin']
    }
  })

  console.log('✅ 管理员用户创建成功:', {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    role: admin.role
  })

  console.log('🎉 数据库种子数据初始化完成！')
  console.log('📋 登录信息:')
  console.log('   用户名: admin@wuhr.ai')
  console.log('   密码: Admin123!')
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    // 数据库连接由DatabaseManager管理，不需要手动断开
  })
