# Wuhr AI Ops 智能运维平台

<div align="center">

**🚀 基于AI驱动的现代化智能运维管理平台**

[![GitHub stars](https://img.shields.io/github/stars/st-lzh/Wuhr-AI-ops?style=social)](https://github.com/st-lzh/Wuhr-AI-ops/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/st-lzh/Wuhr-AI-ops?style=social)](https://github.com/st-lzh/Wuhr-AI-ops/network/members)
[![GitHub issues](https://img.shields.io/github/issues/st-lzh/Wuhr-AI-ops)](https://github.com/st-lzh/Wuhr-AI-ops/issues)
[![GitHub license](https://img.shields.io/github/license/st-lzh/Wuhr-AI-ops)](https://github.com/st-lzh/Wuhr-AI-ops/blob/main/LICENSE)

[English](./README_EN.md) | 简体中文

</div>



## 🎯 项目简介

**Wuhr AI Ops** 是一个现代化的AI驱动智能运维管理平台，集成了多模态AI助手、实时监控、日志分析、CI/CD管理和用户权限管理等功能。平台通过人工智能技术简化复杂的运维任务，为运维团队提供一站式解决方案。

### 🌟 核心亮点

- 🤖 **智能AI助手** - 集成GPT-4o、Gemini等多模态AI模型，支持自然语言运维操作
- 🔧 **多模式命令执行** - 支持K8s集群和Linux系统命令的智能切换
- 📊 **实时监控** - 集成ELK日志分析和Grafana性能监控
- 🚀 **CI/CD管理** - 自动化部署流水线和Jenkins集成
- 👥 **权限管理** - 基于角色的访问控制和审批流程
- 🌐 **多环境支持** - 本地和远程主机统一管理

## 🎥 视频操作指南

> **📹 [完整讲解演示视频](https://www.bilibili.com/video/BV1EK86ziE2y/?vd_source=56a061d9ef5994305d047165b2c6a3d5)**

> 视频内容将包括：
> - 系统安装部署演示
> - AI助手使用技巧
> - CI/CD流水线配置
> - 监控告警设置
> - 权限管理最佳实践

## 📸 系统界面预览与功能介绍

### 🎯 主要功能模块

#### 📊 仪表盘
- **功能描述**: 系统总览页面，展示关键指标和快速访问入口
- **主要特性**:
  - 系统状态概览
  - 快速操作面板
  - 实时数据展示
  - 资源使用统计
<img width="1512" height="949" alt="截屏2025-07-31 00 34 53" src="https://github.com/user-attachments/assets/ff80c242-60c4-46e1-9145-c825f63adf06" />

#### 🤖 AI助手
- **功能描述**: 智能运维助手，支持自然语言交互执行运维命令
- **主要特性**:
  - 多模态AI模型支持（GPT-4o、deepseek等）
  - K8s集群和Linux系统模式智能切换
  - 快捷命令面板（系统监控、进程分析、存储管理等）
  - 远程主机命令执行，kubelet-wuhrai命令检测，没有安装会自动安装
  - 会话历史管理
  - 实时命令执行反馈
  <img width="1512" height="949" alt="截屏2025-07-31 00 35 10" src="https://github.com/user-attachments/assets/4c4019dd-9b19-4b30-a70c-604458e90df5" />

#### 🖥️ 主机管理
- **功能描述**: 统一管理本地和远程服务器资源
- **主要特性**:
  - SSH连接配置和测试
  - 服务器状态监控
  - 批量主机操作
  - 连接认证管理
  - 主机分组管理
<img width="1512" height="949" alt="截屏2025-07-31 00 36 09" src="https://github.com/user-attachments/assets/809e1c85-1a00-4202-95c7-1027a24df58a" />

#### 👥 用户管理
- **功能描述**: 完整的用户权限管理系统
- **子模块**:
  - **用户信息**: 用户账户管理、权限分配
  - **用户权限**: 基于角色的访问控制（RBAC）
  - **通知管理**: 系统通知、审批消息、工作流提醒
- **主要特性**:
  - 用户注册审批机制
  - 细粒度权限控制
  - 操作审计日志
  - 实时通知
    <img width="1512" height="949" alt="截屏2025-07-31 00 35 24" src="https://github.com/user-attachments/assets/54131833-1ea9-40f9-854d-6b182d13ea31" />

#### 🚀 CI/CD管理
- **功能描述**: 完整的持续集成和持续部署解决方案
- **子模块**:
  - **持续集成**: 代码构建、测试自动化
  - **持续部署**: 自动化部署流程管理
  - **Jenkins部署任务**: Jenkins集成和任务管理
  - **模板管理**: 部署模板配置（K8s、Docker、Shell、Ansible）
  - **审批管理**: 部署审批流程和历史记录
- **主要特性**:
  - 可视化流水线配置
  - 多环境部署支持
  - 审批工作流
  - 部署回滚机制
<img width="1512" height="949" alt="截屏2025-07-31 00 36 18" src="https://github.com/user-attachments/assets/63fb8237-e3f0-4334-9e5f-3cef255428cd" />

#### ⚙️ 模型管理
- **功能描述**: AI模型配置和API管理
- **子模块**:
  - **模型配置**: 自定义AI模型接入
  - **预设模型**: 系统预置的AI模型模板
- **主要特性**:
  - 多AI提供商支持
  - API密钥管理
  - 模型性能测试
  - 使用统计分析
<img width="1512" height="949" alt="截屏2025-07-31 00 35 38" src="https://github.com/user-attachments/assets/498cf1ba-6284-4355-b560-e0cdef530f28" />
<img width="1512" height="949" alt="截屏2025-07-31 00 35 52" src="https://github.com/user-attachments/assets/d27e490a-127a-491d-9124-17d6ff979400" />


#### 🔗 接入管理
- **功能描述**: 第三方系统集成和监控配置
- **子模块**:
  - **ELK日志**: Elasticsearch日志分析配置
  - **Grafana监控**: 性能监控面板配置
- **主要特性**:
  - 日志聚合和搜索
  - 自定义监控面板
  - 告警规则配置
  - 数据可视化
<img width="1512" height="949" alt="截屏2025-07-31 00 36 24" src="https://github.com/user-attachments/assets/f1542c91-c14a-4462-90f8-b7a8623458ea" />
<img width="1512" height="949" alt="截屏2025-07-31 00 36 29" src="https://github.com/user-attachments/assets/3be99a5b-a041-4468-afd0-ed78ff725f70" />

## 🚀 快速开始

### 系统要求

- **操作系统**: Linux/macOS
- **Node.js**: >= 18.0.0 (推荐 20.0+)
- **npm**: >= 8.0.0 (推荐 10.0+)
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **内存**: >= 4GB
- **硬盘**: >= 20GB 可用空间

### 一键启动
#### 📦 克隆部署

```bash
# 克隆项目
git clone https://github.com/st-lzh/wuhr-ai-ops.git
cd wuhr-ai-ops

# 国内用户使用中文安装脚本
./install-zh.sh

# 国外用户使用英文安装脚本
./install-en.sh

# docker一键脚本部署
./install-docker.sh
```

> **🔧 智能环境检测**：脚本会自动检测系统环境，如果缺少Docker、Node.js等必需组件，会询问是否自动安装
> 
> **🌍 环境适配**：
> - **国内版本 (install-zh.sh)**：使用国内镜像源，优化网络下载速度
> - **国外版本 (install-en.sh)**：使用官方镜像源，适合国际网络环境
> 
> **⚙️ 启动方式选择**：
> - **前台运行模式**：开发测试使用，可查看实时日志
> - **系统服务模式**：生产环境使用，开机自启，后台运行

### 手动部署

```bash
# 1. 环境准备
git clone https://github.com/st-lzh/wuhr-ai-ops.git
cd wuhr-ai-ops

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和AI API密钥

# 3. 配置npm镜像源（国内用户）
npm config set registry https://registry.npmmirror.com/

# 4. 下载kubelet-wuhrai工具
wget -O kubelet-wuhrai https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/kubelet-wuhrai
chmod +x kubelet-wuhrai

# 5. 启动数据库服务
docker-compose up -d postgres redis pgadmin
sleep 30

# 6. 安装依赖
npm install

# 7. 数据库初始化（导入完整数据）
docker-compose exec postgres psql -U wuhr_admin -d wuhr_ai_ops -f /docker-entrypoint-initdb.d/00-init-database.sql

# 8. 构建和启动应用
npm run build
npm start
```

> **📝 注意**: 手动部署已简化，只需要导入一个SQL文件即可完成数据库初始化，无需执行多个node脚本。

### 🐳 Docker一键部署（推荐）

#### 快速启动

```bash
# 克隆项目
git clone https://github.com/st-lzh/wuhr-ai-ops.git
cd wuhr-ai-ops

# 一键安装和启动所有服务
./install-docker.sh

# 或者使用docker-compose直接启动
docker-compose up -d
```

> **🚀 一键部署特性**:
> - 自动检测和安装Docker环境
> - 自动构建应用镜像
> - 自动初始化数据库和数据
> - 自动启动所有服务
> - 包含完整的系统数据，无需额外配置

#### 服务端口

- **应用服务**: http://localhost:3000
- **pgAdmin**: http://localhost:5050
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

#### 系统账户

系统已预配置超级管理员账户，可直接登录使用：

**超级管理员账户**：

| 角色 | 邮箱 | 密码 | 权限 |
|------|------|------|------|
| 超级管理员 | admin@wuhr.ai | Admin123! | 所有权限 |

> **🔐 安全提示**: 首次登录后请及时修改默认密码，并根据需要创建其他用户账户。

#### 技术特性

- **基础镜像**: Ubuntu 22.04 (支持SSH客户端工具)
- **中国镜像源**: 优化下载速度
- **数据持久化**: Docker volumes存储
- **健康检查**: 自动监控服务状态
- **一键部署**: 简化部署流程

#### 故障排除

```bash
# 查看服务日志
docker-compose logs [service_name]

# 重新构建镜像
docker-compose build --no-cache

# 完全清理重置
docker-compose down -v
docker-compose up -d
```

### 演示地址

- **主应用**: https://aiops.wuhrai.com

### 默认账户

- **邮箱**: admin@wuhr.ai
- **密码**: Admin123!

## ⚙️ 系统服务管理

### 服务管理

```bash
# 启动服务（后台运行）
./restart.sh

# 停止服务
./restart.sh stop

# 查看日志
tail -f app.log

# 清理构建缓存（解决构建问题）
./scripts/clean-build.sh

# 完全清理重建（包括依赖）
./scripts/clean-build.sh --full
```
## 📄 许可证

本项目采用 [MIT License (Modified)](./LICENSE) 开源协议。

### 🏢 商用说明

- **个人学习和非商业用途**: 完全免费使用
- **商业用途**: 请联系作者获得授权 (1139804291@qq.com)
- **二次开发和重新分发**: 请联系作者获得授权 (1139804291@qq.com)
- **教育机构**: 可免费用于教学和学术研究

### 📝 署名要求

使用本软件时，请保留以下署名信息：
```
技术支持：Wuhr AI Ops - https://github.com/st-lzh/Wuhr-AI-ops
```

## 🙏 致谢

感谢以下开源项目的支持：

- [Next.js](https://nextjs.org/) - React框架
- [Ant Design](https://ant.design/) - UI组件库
- [Prisma](https://www.prisma.io/) - 数据库ORM
- [Docker](https://www.docker.com/) - 容器化平台
- [ELK Stack](https://www.elastic.co/) - 日志分析套件

## 📞 联系我们

- **开发者**: st-lzh
- **邮箱**: 1139804291@qq.com
- **博客**: [wuhrai.com](https://wuhrai.com)
- **AI接口**: [ai.wuhrai.com](https://ai.wuhrai.com)
- **Chat服务**: [gpt.wuhrai.com](https://gpt.wuhrai.com)

##微信交流
![IMG_6845](https://github.com/user-attachments/assets/9b07e703-caf9-4af9-87ca-a0ad11669a13)



### 技术支持

- **GitHub Issues**: [提交问题](https://github.com/st-lzh/Wuhr-AI-ops/issues)
- **讨论区**: [GitHub Discussions](https://github.com/st-lzh/Wuhr-AI-ops/discussions)
- **文档**: [项目README](./README.md)


---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给我们一个星标！**

Made with ❤️ by [st-lzh](https://github.com/st-lzh)

</div>
