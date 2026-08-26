export const AGENT_RELEASE_VERSION = '1.0.1'

export const AGENT_INSTALLER_PRIMARY_URL =
  `https://github.com/st-lzh/Wuhr-AI-ops/releases/download/v${AGENT_RELEASE_VERSION}/install-agent.sh`

export const AGENT_INSTALLER_MIRROR_URL =
  `http://106.12.150.207/download/v${AGENT_RELEASE_VERSION}/install-agent.sh`

export interface AgentInstallCommandOptions {
  apiKeyFile?: string
}

function validateRemoteFilePath(filePath: string): void {
  if (!/^\/[A-Za-z0-9/._-]+$/.test(filePath)) {
    throw new Error('Agent 远程密钥文件路径不合法')
  }
}

export function normalizeAgentVersion(version: string | null | undefined): string {
  return String(version || '').trim().replace(/^v/i, '')
}

export function isAgentUpgradeRequired(version: string | null | undefined): boolean {
  return normalizeAgentVersion(version) !== AGENT_RELEASE_VERSION
}

/**
 * 生成不会直接把远程内容管道给 shell 的 Agent 安装命令。
 * GitHub 不可用时会自动切换到国内镜像，两个来源使用完全相同的安装脚本。
 */
export function buildAgentInstallCommand(
  port: number = 2081,
  options: AgentInstallCommandOptions = {}
): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Agent 端口必须是 1-65535 的整数')
  }

  const installerArgs = [`--port ${port}`]
  if (options.apiKeyFile) {
    validateRemoteFilePath(options.apiKeyFile)
    installerArgs.push(`--api-key-file '${options.apiKeyFile}'`)
  }

  return [
    'tmp=$(mktemp)',
    `trap 'rm -f "$tmp"' 0 HUP INT TERM`,
    `(curl -fsSL '${AGENT_INSTALLER_PRIMARY_URL}' -o "$tmp" || curl -fsSL '${AGENT_INSTALLER_MIRROR_URL}' -o "$tmp")`,
    `WUHR_AGENT_VERSION='${AGENT_RELEASE_VERSION}' WUHR_AGENT_MIRROR_BASE='http://106.12.150.207/download/v${AGENT_RELEASE_VERSION}' sh "$tmp" ${installerArgs.join(' ')}`
  ].join(' && ')
}
