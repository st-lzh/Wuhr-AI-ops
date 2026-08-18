export const AGENT_RELEASE_VERSION = '1.0.0'

export const AGENT_INSTALLER_PRIMARY_URL =
  `https://github.com/st-lzh/Wuhr-AI-ops/releases/download/v${AGENT_RELEASE_VERSION}/install-agent.sh`

export const AGENT_INSTALLER_MIRROR_URL =
  'http://106.12.150.207/download/install-agent.sh'

/**
 * 生成不会直接把远程内容管道给 shell 的 Agent 安装命令。
 * GitHub 不可用时会自动切换到国内镜像，两个来源使用完全相同的安装脚本。
 */
export function buildAgentInstallCommand(port: number = 2081): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Agent 端口必须是 1-65535 的整数')
  }

  return [
    'tmp=$(mktemp)',
    `trap 'rm -f "$tmp"' 0 HUP INT TERM`,
    `(curl -fsSL '${AGENT_INSTALLER_PRIMARY_URL}' -o "$tmp" || curl -fsSL '${AGENT_INSTALLER_MIRROR_URL}' -o "$tmp")`,
    `sh "$tmp" --port=${port}`
  ].join(' && ')
}
