// 邮件通知服务
import { EmailNotification, NotificationResult } from './types'
import nodemailer from 'nodemailer'

class EmailNotificationService {
  private smtpConfig = {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || ''
    }
  }

  // 发送邮件
  async sendEmail(notification: EmailNotification): Promise<NotificationResult> {
    try {
      // 检查配置
      if (!this.isConfigured()) {
        console.log('📧 SMTP未配置，跳过邮件发送')
        return {
          success: false,
          channel: 'email',
          error: 'SMTP配置不完整',
          sentAt: new Date()
        }
      }

      const transporter = nodemailer.createTransport({
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: this.smtpConfig.auth.user && this.smtpConfig.auth.pass
          ? this.smtpConfig.auth
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000
      })
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || this.smtpConfig.auth.user,
        to: notification.to,
        subject: notification.subject,
        text: notification.textContent,
        html: notification.htmlContent
      })
      transporter.close()

      console.log(`✅ 邮件发送成功: ${info.messageId}`)
      return {
        success: true,
        channel: 'email',
        messageId: info.messageId,
        sentAt: new Date()
      }

    } catch (error) {
      console.error('发送邮件失败:', error)
      return {
        success: false,
        channel: 'email',
        error: error instanceof Error ? error.message : '未知错误',
        sentAt: new Date()
      }
    }
  }

  // 发送CI/CD相关邮件
  async sendCICDNotification(
    event: string,
    recipients: string[],
    data: {
      resourceName: string
      resourceType: string
      userName: string
      details?: Record<string, any>
    }
  ): Promise<NotificationResult> {
    const templates = this.getEmailTemplates()
    const template = (templates as any)[event]
    
    if (!template) {
      return {
        success: false,
        channel: 'email',
        error: `未找到事件 ${event} 的邮件模板`,
        sentAt: new Date()
      }
    }

    const subject = this.renderTemplate(template.subject, data)
    const htmlContent = this.renderTemplate(template.htmlContent, data)
    const textContent = this.renderTemplate(template.textContent || '', data)

    return await this.sendEmail({
      to: recipients,
      subject,
      htmlContent,
      textContent,
      metadata: {
        event,
        resourceType: data.resourceType,
        resourceName: data.resourceName
      }
    })
  }

  // 检查SMTP是否已配置
  private isConfigured(): boolean {
    const sender = process.env.SMTP_FROM || this.smtpConfig.auth.user
    const authComplete = (!this.smtpConfig.auth.user && !this.smtpConfig.auth.pass)
      || Boolean(this.smtpConfig.auth.user && this.smtpConfig.auth.pass)
    return Boolean(this.smtpConfig.host && sender && authComplete)
  }

  // 模板渲染
  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template
    
    // 简单的模板变量替换
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(regex, String(value))
    }
    
    // 添加时间戳
    result = result.replace(/{{timestamp}}/g, new Date().toLocaleString())
    
    return result
  }

  // 获取邮件模板
  private getEmailTemplates() {
    return {
      deployment_started: {
        subject: '🚀 部署任务开始 - {{resourceName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1890ff;">🚀 部署任务开始</h2>
            <p>您好，</p>
            <p><strong>{{userName}}</strong> 已开始执行部署任务：</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>任务名称：</strong>{{resourceName}}</p>
              <p><strong>执行时间：</strong>{{timestamp}}</p>
            </div>
            <p>您可以通过系统监控部署进度。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由 Wuhr AI Ops 系统自动发送</p>
          </div>
        `,
        textContent: '🚀 部署任务开始 - {{resourceName}}\n\n{{userName}} 已开始执行部署任务：{{resourceName}}\n执行时间：{{timestamp}}'
      },
      deployment_completed: {
        subject: '✅ 部署任务完成 - {{resourceName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #52c41a;">✅ 部署任务完成</h2>
            <p>您好，</p>
            <p>部署任务已成功完成：</p>
            <div style="background: #f6ffed; border-left: 4px solid #52c41a; padding: 15px; margin: 15px 0;">
              <p><strong>任务名称：</strong>{{resourceName}}</p>
              <p><strong>执行者：</strong>{{userName}}</p>
              <p><strong>完成时间：</strong>{{timestamp}}</p>
            </div>
            <p>部署已成功完成，服务正在运行。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由 Wuhr AI Ops 系统自动发送</p>
          </div>
        `,
        textContent: '✅ 部署任务完成 - {{resourceName}}\n\n部署任务已成功完成：{{resourceName}}\n执行者：{{userName}}\n完成时间：{{timestamp}}'
      },
      deployment_failed: {
        subject: '❌ 部署任务失败 - {{resourceName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff4d4f;">❌ 部署任务失败</h2>
            <p>您好，</p>
            <p>部署任务执行失败：</p>
            <div style="background: #fff2f0; border-left: 4px solid #ff4d4f; padding: 15px; margin: 15px 0;">
              <p><strong>任务名称：</strong>{{resourceName}}</p>
              <p><strong>执行者：</strong>{{userName}}</p>
              <p><strong>失败时间：</strong>{{timestamp}}</p>
            </div>
            <p>请检查系统日志或联系管理员处理。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由 Wuhr AI Ops 系统自动发送</p>
          </div>
        `,
        textContent: '❌ 部署任务失败 - {{resourceName}}\n\n部署任务执行失败：{{resourceName}}\n执行者：{{userName}}\n失败时间：{{timestamp}}'
      },
      approval_requested: {
        subject: '📋 审批请求 - {{resourceName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #faad14;">📋 审批请求</h2>
            <p>您好，</p>
            <p><strong>{{userName}}</strong> 提交了一个审批请求：</p>
            <div style="background: #fffbe6; border-left: 4px solid #faad14; padding: 15px; margin: 15px 0;">
              <p><strong>任务名称：</strong>{{resourceName}}</p>
              <p><strong>申请时间：</strong>{{timestamp}}</p>
            </div>
            <p>请及时登录系统处理审批。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由 Wuhr AI Ops 系统自动发送</p>
          </div>
        `,
        textContent: '📋 审批请求 - {{resourceName}}\n\n{{userName}} 提交了一个审批请求：{{resourceName}}\n申请时间：{{timestamp}}'
      }
    }
  }
}

// 全局邮件通知服务实例
export const emailNotificationService = new EmailNotificationService()

export default EmailNotificationService
