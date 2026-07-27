import { redirect } from 'next/navigation'

// 旧“任务管理”从未有数据模型或 API。统一进入真实可执行的流水线管理，
// Jenkins 部署任务则由侧边栏“任务部署”入口管理。
export default function LegacyTasksPage() {
  redirect('/cicd/pipelines')
}
