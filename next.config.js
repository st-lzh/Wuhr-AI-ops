/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // 独立输出模式，用于Docker部署
  output: 'standalone',
  // 生产环境减少日志输出
  logging: {
    fetches: {
      fullUrl: false, // 不输出完整URL
    },
  },
  // 禁用 Next.js 的一些详细日志
  productionBrowserSourceMaps: false,
  // appDir is now stable in Next.js 14, no need for experimental flag
  env: {
    CUSTOM_KEY: 'my-value',
  },
  // 禁用静态导出和预渲染
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  // 设置API路由为动态渲染，解决静态生成时的request.headers问题
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // 处理 ssh2 库的原生二进制文件
    if (isServer) {
      // 在服务器端，排除原生模块的处理
      config.externals = config.externals || []
      config.externals.push({
        'ssh2': 'commonjs ssh2'
      })
    } else {
      // 在客户端，完全忽略 ssh2 库
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
    }

    // 忽略 .node 文件
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader'
    })

    return config
  },
}

module.exports = nextConfig