// 项目模板相关类型定义

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'devops'
  icon: string
  tags: string[]
  defaultConfig: {
    repositoryType: string
    branch: string
    buildScript: string
    testScript?: string
    environment: 'dev' | 'test' | 'prod'
    dockerFile?: string
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'maven' | 'gradle' | 'pip'
  }
  requirements?: string[]
  documentation?: string
}

export interface RepositoryInfo {
  url: string
  type: 'git' | 'svn'
  accessible: boolean
  branches?: string[]
  defaultBranch?: string
  projectType?: string
  packageManager?: string
  hasDockerfile?: boolean
  hasCI?: boolean
  error?: string
}

export interface CreateProjectWizardData {
  // 第一步：基本信息
  name: string
  description?: string
  template?: ProjectTemplate

  // 第二步：仓库配置
  repositoryUrl: string
  repositoryType: string
  branch: string
  repositoryInfo?: RepositoryInfo

  // 第三步：构建配置
  buildScript?: string
  testScript?: string
  environment: 'dev' | 'test' | 'prod'
  serverId?: string // 关联的主机ID
  dockerFile?: string

  // 第四步：高级配置
  autoDetectConfig?: boolean
  enableCI?: boolean
  notifications?: boolean
}

export interface WizardStep {
  key: string
  title: string
  description: string
  icon: string
  component: React.ComponentType<any>
  validation?: (data: Partial<CreateProjectWizardData>) => boolean
  optional?: boolean
}

// 预定义项目模板
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-app',
    name: 'React 应用',
    description: '基于 Create React App 的前端项目模板',
    category: 'frontend',
    icon: '⚛️',
    tags: ['React', 'JavaScript', 'Frontend', 'SPA'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'npm install && npm run build',

      environment: 'dev',
      packageManager: 'npm'
    },
    requirements: ['Node.js 16+', 'npm 或 yarn'],
    documentation: 'https://create-react-app.dev/'
  },
  {
    id: 'vue-app',
    name: 'Vue 应用',
    description: '基于 Vue CLI 的前端项目模板',
    category: 'frontend',
    icon: '🟢',
    tags: ['Vue', 'JavaScript', 'Frontend', 'SPA'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'npm install && npm run build',

      environment: 'dev',
      packageManager: 'npm'
    },
    requirements: ['Node.js 16+', 'Vue CLI'],
    documentation: 'https://cli.vuejs.org/'
  },
  {
    id: 'nextjs-app',
    name: 'Next.js 应用',
    description: '基于 Next.js 的全栈 React 应用模板',
    category: 'fullstack',
    icon: '▲',
    tags: ['Next.js', 'React', 'SSR', 'Fullstack'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'npm install && npm run build',

      environment: 'dev',
      packageManager: 'npm'
    },
    requirements: ['Node.js 18+', 'npm 或 yarn'],
    documentation: 'https://nextjs.org/docs'
  },
  {
    id: 'nodejs-api',
    name: 'Node.js API',
    description: '基于 Express.js 的后端 API 服务模板',
    category: 'backend',
    icon: '🟩',
    tags: ['Node.js', 'Express', 'API', 'Backend'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'npm install',

      environment: 'dev',
      packageManager: 'npm'
    },
    requirements: ['Node.js 16+', 'npm 或 yarn'],
    documentation: 'https://expressjs.com/'
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot 应用',
    description: '基于 Spring Boot 的 Java 后端服务模板',
    category: 'backend',
    icon: '🍃',
    tags: ['Java', 'Spring Boot', 'Backend', 'Microservice'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: './mvnw clean package',

      environment: 'dev',
      packageManager: 'maven'
    },
    requirements: ['Java 11+', 'Maven 或 Gradle'],
    documentation: 'https://spring.io/projects/spring-boot'
  },
  {
    id: 'python-flask',
    name: 'Python Flask 应用',
    description: '基于 Flask 的 Python Web 应用模板',
    category: 'backend',
    icon: '🐍',
    tags: ['Python', 'Flask', 'Web', 'Backend'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'pip install -r requirements.txt',

      environment: 'dev',
      packageManager: 'pip'
    },
    requirements: ['Python 3.8+', 'pip'],
    documentation: 'https://flask.palletsprojects.com/'
  },
  {
    id: 'docker-app',
    name: 'Docker 应用',
    description: '基于 Docker 的容器化应用模板',
    category: 'devops',
    icon: '🐳',
    tags: ['Docker', 'Container', 'DevOps'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'docker build -t app .',

      environment: 'dev',
      dockerFile: 'Dockerfile'
    },
    requirements: ['Docker', 'Docker Compose'],
    documentation: 'https://docs.docker.com/'
  },
  {
    id: 'kubernetes-app',
    name: 'Kubernetes 应用',
    description: '基于 Kubernetes 的容器化部署模板',
    category: 'devops',
    icon: '☸️',
    tags: ['Kubernetes', 'Docker', 'Container', 'DevOps'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .\ndocker push ${IMAGE_NAME}:${BUILD_NUMBER}',

      environment: 'dev',
      packageManager: 'npm',
      dockerFile: `FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`
    },
    requirements: ['Docker', 'Kubernetes Cluster', 'kubectl'],
    documentation: 'https://kubernetes.io/docs/'
  },
  {
    id: 'custom',
    name: '自定义项目',
    description: '自定义配置的项目模板',
    category: 'devops',
    icon: '⚙️',
    tags: ['Custom', 'Manual'],
    defaultConfig: {
      repositoryType: 'git',
      branch: 'main',
      buildScript: '',

      environment: 'dev'
    },
    requirements: [],
    documentation: ''
  }
]

// 根据仓库内容检测项目类型
export interface ProjectDetectionResult {
  detectedType?: string
  confidence: number
  suggestions: {
    template: ProjectTemplate
    reason: string
    confidence: number
  }[]
  packageManager?: string
  hasDockerfile: boolean
  hasCI: boolean
  frameworks: string[]
}
