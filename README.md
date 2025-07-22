# Wuhr AI Ops 智能运维平台

**智能化运维管理平台，集成AI助手、多模态模型管理、主机监控和用户权限管理于一体**

🚀 平台概述
Wuhr AI Ops 是一个现代化的AI驱动运维管理平台，旨在通过智能化工具和直观的用户界面，简化复杂的运维任务。平台集成了多种AI模型、实时监控、日志分析和用户管理功能，为运维团队提供一站式解决方案。

📈 开发进度：目前平台开发已经完成80%，核心功能已基本实现并可正常使用。


## 📋 功能导航

### 🤖 AI助手

**智能对话式运维助手，支持多模态交互和自动化命令执行**

AI助手是平台的核心功能，提供基于GPT-4o等先进模型的智能对话服务。支持文本、图像等多模态输入，能够理解运维需求并自动执行系统命令，大幅提升运维效率。

![AI助手界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/AI%E5%8A%A9%E6%89%8B.png)

🎥 **视频演示：** [观看AI助手功能演示](https://www.bilibili.com/video/BV19A3jzyET4/?vd_source=56a061d9ef5994305d047165b2c6a3d5)

**核心特性：**
- 🎯 智能命令建议与自动执行
- 🖼️ 多模态输入支持（文本+图像）
- 🔧 DevOps快捷命令集成
- 💾 Redis持久化聊天历史
- 🌐 支持本地和远程主机操作

### ⚙️ 模型管理

**统一管理和配置多种AI模型，支持OpenAI、Gemini、自部署模型、第三方api等**

提供可视化的模型配置界面，支持多种主流AI服务提供商。用户可以灵活配置不同模型的参数，实现最佳的AI助手性能。

![模型管理界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/%E6%A8%A1%E5%9E%8B%E7%AE%A1%E7%90%86.png)

**支持的模型：**
- 🔥 OpenAI GPT系列（GPT-4o、GPT-4、GPT-3.5）
- 🌟 Google Gemini Pro Vision
- 🚀 自部署模型、第三方api（Ollama、vLLM等）
- 🎨 多模态模型配置
- 📊 模型性能监控

### 🖥️ 主机管理

**全方位的服务器监控、日志分析和性能管理中心**

集成多种监控和分析工具，提供服务器状态监控、日志分析、性能指标追踪等功能，支持多数据中心部署。

![主机管理仪表板](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/%E4%B8%BB%E6%9C%BA%E7%AE%A1%E7%90%86.png)

#### 📊 ELK日志

**基于Elasticsearch的智能日志分析和可视化平台**

- 🔍 实时日志搜索和过滤
- 📈 自定义Kibana仪表板
- 🎯 个性化日志查看器
- 🔗 自定义链接管理
- 🖼️ 嵌入式全屏查看

![ELK日志分析界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/ELK%E6%97%A5%E5%BF%97.png)

#### 📈 监控面板

**集成Grafana的实时性能监控**

- 📊 系统资源监控（CPU、内存、磁盘）
- 🌐 网络流量分析
- ⚡ 应用性能指标
- 🚨 智能告警系统
- 📍 多数据中心支持

### 🔧 CI/CD管理

**自动化部署和持续集成流水线管理**

- 🚀 部署流水线配置
- 📦 容器化应用管理
- 🔄 自动化测试集成
- 📋 部署历史追踪

![CI/CD管理界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/CICD.png)

### 👥 用户管理

**完整的用户权限体系和通知管理系统**

提供细粒度的用户权限控制，支持角色管理、审批流程和实时通知，确保平台安全性和协作效率。

![用户管理界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/%E7%94%A8%E6%88%B7%E7%AE%A1%E7%90%86.png)

### 🔐 权限管理

**基于角色的访问控制系统**

- 👤 用户注册审批机制
- 🎭 角色权限分配
- 🛡️ 功能模块访问控制
- 📝 操作日志审计

![权限管理界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/%E6%9D%83%E9%99%90%E7%AE%A1%E7%90%86.png)

### 🔔 通知管理

**集中化的消息通知和审批中心**

- 📬 实时通知推送
- ✅ 用户注册审批
- 📊 系统状态通知
- 🔄 工作流审批流程

### 🛠️ 工具箱

**集成常用运维工具和实用功能**

提供各种运维工具和辅助功能，包括API密钥管理、系统工具等，提升日常运维工作效率。

![工具箱界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/%E5%B7%A5%E5%85%B7%E7%AE%B1.png)

### 🔑 API密钥管理

**安全的API密钥存储和管理**

- 🔐 加密存储API密钥
- 🎯 分类管理不同服务密钥
- 🔄 密钥轮换和更新
- 📊 使用情况统计

![API密钥管理界面](https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/github/wuhraiops/api%E7%A7%98%E9%92%A5%E7%AE%A1%E7%90%86.png)

## 🎯 平台优势

### 🤖 AI驱动
- 集成多种先进AI模型
- 智能化运维决策支持
- 自然语言交互界面

### 🔧 一站式管理
- 统一的运维管理平台
- 多系统集成整合
- 简化的操作流程

### 🛡️ 安全可靠
- 完善的权限控制体系
- 操作审计和日志记录
- 数据安全保障

### 📊 可视化监控
- 实时性能监控
- 直观的数据展示
- 自定义仪表板

### 🌐 多环境支持
- 本地和云端部署
- 多数据中心管理
- 灵活的配置选项


## 📞 技术支持

- 📧 **联系邮箱**：1139804291@qq.com
- 📚 **个人博客**：www.wuhrai.com
- 🐛 **问题反馈**：GitHub Issues

---
平台运维群

![WechatIMG242](https://github.com/user-attachments/assets/845c6564-948b-480e-8044-9e2110c3c910)


**Wuhr AI Ops - 让AI为运维赋能，让管理更智能**
