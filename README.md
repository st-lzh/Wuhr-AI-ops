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
- 🌐 **远程执行架构** - 统一的远程主机管理和命令执行

## 🎥 视频操作指南

完整讲解演示视频
https://www.bilibili.com/video/BV11vyWBQEDV/?vd_source=56a061d9ef5994305d047165b2c6a3d5


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
- **高级功能**:
  - **安全控制**
    - 命令执行前需用户审批确认
    - 风险命令智能识别和拦截
    - 操作审计日志完整记录
  - **Agent执行流程可视化**
    - 实时显示AI思考和决策过程
    - 可视化展示工具调用链路
    - 执行步骤详细日志追踪
  - **流式传输**
    - 实时流式输出AI响应内容
    - 命令执行进度实时反馈
    - 提升交互响应体验
  - **MCP工具支持**
    - 集成Model Context Protocol标准工具
    - 支持自定义MCP服务器配置
    - 扩展AI能力边界
  - **自定义工具**
    - 大模型可调用用户自定义脚本
    - 支持Python、Shell、Node.js等脚本
    - 灵活扩展AI助手功能
    - 脚本参数自动识别和传递
  <img width="1512" height="982" alt="截屏2025-10-29 22 41 33" src="https://github.com/user-attachments/assets/a5c06e62-10d8-4739-8fea-9acd21349824" />


#### 🖥️ 主机管理
- **功能描述**: 统一管理远程服务器资源
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
git clone https://github.com/st-lzh/wuhr-AI-ops.git
cd wuhr-AI-ops

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

### 🐳 Docker一键部署（推荐）

#### 快速启动

```bash
# 克隆项目
git clone https://github.com/st-lzh/wuhr-AI-ops.git
cd wuhr-AI-ops

# 一键安装和启动所有服务
./install-docker.sh

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

### 演示地址

- **主应用**: https://aiops.wuhrai.com

### 默认账户

- **邮箱**: admin@wuhr.ai
- **密码**: Admin123!


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

![微信图片_20251105135508_33_633](https://github.com/user-attachments/assets/a904f421-e7e1-4991-8d31-70f74be747a3)


### 📚 技术文档

- **📋 [完整技术文档](./docs/Wuhr-AI-System-Technical-Documentation.md)** - 系统架构、核心功能、最新修复详解
- **⚡ [快速参考指南](./docs/Quick-Reference-Guide.md)** - 常用命令、故障排查、开发指南
- **🔧 [API接口文档](./docs/api/)** - 详细的API接口说明和使用示例
- **🚀 [部署运维指南](./docs/deployment/)** - 生产环境部署和运维最佳实践

### 🔧 最新系统优化 (v2.0.0)

#### ✅ 核心问题修复
- **Linux模式参数传递问题** - 修复了参数传递链路，确保Linux模式下执行正确的系统命令
- **执行总结功能恢复** - 重新实现了智能执行总结，提供美观的结果展示卡片
- **代理模式切换删除** - 清理了冗余UI组件，简化用户界面，提升使用体验

#### 🚀 功能增强
- **自动重连机制** - HTTP客户端支持智能重连和指数退避策略
- **Agent流式UI** - 修复了React无限循环问题，优化了流式执行过程显示
- **连接管理优化** - 实时跟踪连接状态，优雅处理各种网络异常情况

#### AI助手重大升级 (v2.1.0)
- **安全控制系统**
  - 命令审批机制 - 执行前需用户确认，防止误操作
  - 风险命令识别 - 智能识别rm、format等高危操作
  - 完整审计日志 - 记录所有命令执行历史

- **Agent执行可视化**
  - 思考过程实时展示 - 可视化AI决策路径
  - 工具调用链路追踪 - 清晰展示每个工具的调用和结果
  - 执行步骤详细日志 - 完整记录执行过程

- **流式传输优化**
  - 实时响应输出 - 用户体验更流畅
  - 进度实时反馈 - 长时间任务不再等待
  - 中断恢复支持 - 网络异常自动重连

- **工具生态扩展**
  - **MCP工具集成** - 支持Model Context Protocol标准工具
  - **自定义脚本调用** - AI可直接调用用户编写的Python/Shell/Node.js脚本
  - **参数智能识别** - 自动解析脚本参数和返回值
  - **多语言支持** - 支持主流脚本语言扩展

- **日志管理优化**
  - Docker日志轮转 - 自动限制日志文件大小（最大30MB）
  - 定时清理脚本 - 支持手动和自动清理日志
  - Next.js日志优化 - 减少不必要的详细输出

### 技术支持

- **GitHub Issues**: [提交问题](https://github.com/st-lzh/Wuhr-AI-ops/issues)
- **讨论区**: [GitHub Discussions](https://github.com/st-lzh/Wuhr-AI-ops/discussions)
- **技术文档**: [完整文档导航](./docs/)


---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给我们一个星标！**

Made with ❤️ by [st-lzh](https://github.com/st-lzh)

</div>
