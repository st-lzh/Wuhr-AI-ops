import { expect, test } from '@playwright/test'

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('邮箱地址').fill(process.env.E2E_EMAIL || 'admin@wuhr.ai')
  await page.getByPlaceholder('密码').fill(process.env.E2E_PASSWORD || 'Admin123!')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 })
}

test('登录页可用且核心资产接口拒绝匿名访问', async ({ page, request }) => {
  await page.goto('/login')
  await expect(page.getByPlaceholder('邮箱地址')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByPlaceholder('密码')).toBeVisible()
  await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible()

  const response = await request.get('/api/cicd/projects')
  expect(response.status()).toBe(401)
})

test('管理员登录后可访问主机、AI、CI/CD 与安全配置', async ({ page }) => {
  await loginAsAdmin(page)
  await expect(page.getByRole('link', { name: '智能助手', exact: true })).toBeVisible()
  const navigation = page.getByRole('menu')
  await expect(navigation.getByText('主机管理', { exact: true })).toBeVisible()
  await expect(navigation.getByText('交付管理', { exact: true })).toBeVisible()

  const runtimeState = await page.evaluate(async () => {
    const load = async (url: string) => {
      const response = await fetch(url, { credentials: 'include' })
      return { status: response.status, body: await response.json() }
    }
    const [security, overview, servers, mcp] = await Promise.all([
      load('/api/config/security'),
      load('/api/cicd/overview'),
      load('/api/servers'),
      load('/api/config/mcp-tools')
    ])
    return { security, overview, servers, mcp }
  })

  expect(runtimeState.security.status).toBe(200)
  expect(runtimeState.security.body.data.enabled).toBe(true)
  expect(runtimeState.security.body.data.requireApproval).toBe(true)
  expect(runtimeState.overview.status).toBe(200)
  expect(runtimeState.overview.body.success).toBe(true)
  expect(runtimeState.servers.status).toBe(200)
  expect(JSON.stringify(runtimeState.servers.body)).toContain('106.12.150.207')
  expect(runtimeState.mcp.status).toBe(200)
  expect(runtimeState.mcp.body.data.enabled).toBe(true)
  expect(runtimeState.mcp.body.data.servers.length).toBeGreaterThan(0)

  const deploymentsResponse = await page.evaluate(async () => {
    const response = await fetch('/api/cicd/deployments?limit=1', { credentials: 'include' })
    return { status: response.status, body: await response.json() }
  })
  expect(deploymentsResponse.status).toBe(200)

  await page.goto('/servers/list')
  await expect(page.getByText('106.12.150.207', { exact: true })).toBeVisible({ timeout: 10_000 })

  await page.goto('/ai/system')
  await expect(page.getByText('智能助手', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  await page.goto('/cicd')
  await expect(page.getByRole('menu').getByText('交付管理', { exact: true })).toBeVisible({ timeout: 10_000 })

  const deploymentId = deploymentsResponse.body.data?.deployments?.[0]?.id
  if (deploymentId) {
    await page.goto(`/cicd/deployments/${deploymentId}`)
    await expect(page.getByText('页面出现错误', { exact: true })).toHaveCount(0)
    await expect(page.getByText('基本信息', { exact: true })).toBeVisible({ timeout: 10_000 })
  }
})

test('交付与接入页在深浅主题下保持文字可读', async ({ page }) => {
  await loginAsAdmin(page)

  const descriptions = [
    ['/cicd', '管理持续集成和持续部署流程，实现自动化软件交付'],
    ['/cicd/projects', '管理CI构建流程，配置代码仓库、构建设置和通知人员'],
    ['/cicd/pipelines', '管理CI/CD流水线，配置自动化构建和部署流程'],
    ['/cicd/builds', '查看构建历史记录、构建日志和状态监控'],
    ['/cicd/deployments', '管理CD部署流程，配置部署主机、通知人员、审批人员和部署模板'],
    ['/cicd/approvals', '管理部署审批流程，查看待审批任务和审批历史'],
    ['/cicd/templates', '管理部署模板，支持Kubernetes、Docker、Shell和Ansible等多种类型的部署模板'],
    ['/notifications', '管理系统通知，查看通知历史和状态']
  ] as const

  for (const [url, text] of descriptions) {
    await page.goto(url)
    await expect(page.locator('html')).toHaveClass(/dark/)
    const description = page.getByText(text, { exact: true })
    await expect(description).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => description.evaluate(element => getComputedStyle(element).color)).toBe('rgb(203, 213, 225)')
  }

  await page.goto('/cicd')
  await expect(page.getByText('最近活动', { exact: true })).toBeVisible()
  await expect(page.locator('.ant-skeleton-active')).toHaveCount(0, { timeout: 10_000 })
  const activityCards = page.locator('main .bg-slate-50')
  if (await activityCards.count() > 0) {
    const activityColors = await activityCards.evaluateAll(elements => elements.map(element => ({
      background: getComputedStyle(element).backgroundColor,
      text: getComputedStyle(element.querySelector('strong') || element).color
    })))
    for (const colors of activityColors) {
      expect(colors.background).not.toBe('rgb(248, 250, 252)')
      expect(colors.text).toBe('rgb(248, 250, 252)')
    }
  } else {
    await expect(page.getByText('暂无真实执行记录', { exact: true })).toBeVisible()
  }

  const statistics = page.locator('.ant-statistic-content')
  const statisticColors = await statistics.evaluateAll(elements => elements.map(element => getComputedStyle(element).color))
  expect(statisticColors.length).toBeGreaterThan(0)
  expect(new Set(statisticColors)).toEqual(new Set(['rgb(248, 250, 252)']))

  const themeSwitch = page.getByRole('switch')
  await expect(themeSwitch).toBeChecked()
  await themeSwitch.click()
  await expect(page.locator('html')).toHaveClass(/light/)
  const lightDescription = page.getByText(descriptions[0][1], { exact: true })
  await expect.poll(() => lightDescription.evaluate(element => getComputedStyle(element).color)).toBe('rgb(100, 116, 139)')
})
