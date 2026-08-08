const { PrismaClient } = require('../generated/prisma')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始数据库种子数据初始化...')

  const adminPassword = String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim()
  if (adminPassword && adminPassword.length < 12) {
    throw new Error('DEFAULT_ADMIN_PASSWORD 至少需要 12 个字符')
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'admin' },
        { email: 'admin@wuhr.ai' }
      ]
    }
  })

  if (existingAdmin) {
    const permissions = Array.isArray(existingAdmin.permissions)
      ? Array.from(new Set([...existingAdmin.permissions, '*']))
      : ['*']
    const updateData = {
      role: 'admin',
      isActive: true,
      approvalStatus: 'approved',
      approvedAt: existingAdmin.approvedAt || new Date(),
      permissions
    }
    if (adminPassword) {
      updateData.password = await bcrypt.hash(adminPassword, 12)
    }
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: updateData
    })
    console.log(adminPassword
      ? '✅ 管理员状态与首次登录密码已同步'
      : '✅ 管理员状态与权限已校准')
  } else {
    if (!adminPassword) {
      throw new Error('首次初始化必须通过 DEFAULT_ADMIN_PASSWORD 配置管理员密码')
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12)
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@wuhr.ai',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        realName: '系统管理员',
        permissions: ['*']
      }
    })

    console.log('✅ 管理员用户创建成功:', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    })
  }

  const seedSqlPath = path.resolve(__dirname, '../../prisma/init-preset-models.sql')
  const seedSql = fs.readFileSync(seedSqlPath, 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL })

  await client.connect()
  try {
    await client.query(seedSql)
    console.log('✅ 模型厂商目录和推荐模型初始化成功')
  } finally {
    await client.end()
  }
}

main()
  .catch((error) => {
    console.error('❌ 种子数据初始化失败:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
