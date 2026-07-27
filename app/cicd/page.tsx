import { redirect } from 'next/navigation'

/** 交付总览已并入全局仪表盘，旧入口保留兼容并跳转到项目管理。 */
export default function CICDEntryPage() {
  redirect('/cicd/projects')
}
