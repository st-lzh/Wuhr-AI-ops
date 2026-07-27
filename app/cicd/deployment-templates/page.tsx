import { redirect } from 'next/navigation'

// 历史重复入口统一跳转到真实的模板管理，避免维护两套字段不一致的伪页面。
export default function LegacyDeploymentTemplatesPage() {
  redirect('/cicd/templates')
}
