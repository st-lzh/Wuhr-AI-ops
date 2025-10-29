'use client';

import React, { useState } from 'react';
import { Card, Button, Input, Select, message, Typography, Space, Divider, Alert, Upload } from 'antd';
import { copyWithFeedback } from '../../utils/clipboard';
import { 
  PlayCircleOutlined, 
  UploadOutlined, 
  SaveOutlined,
  DeleteOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  script: string;
  language: string;
}

interface ScriptExecutorProps {
  onClose?: () => void;
}

const ScriptExecutor: React.FC<ScriptExecutorProps> = ({ onClose }) => {
  const [script, setScript] = useState('');
  const [language, setLanguage] = useState('bash');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [templates, setTemplates] = useState<ScriptTemplate[]>([
    {
      id: 'system-info',
      name: '系统信息查询',
      description: '获取系统基本信息',
      language: 'bash',
      script: `#!/bin/bash
echo "=== 系统信息 ==="
uname -a
echo ""
echo "=== 内存使用情况 ==="
free -h
echo ""
echo "=== 磁盘使用情况 ==="
df -h
echo ""
echo "=== CPU 信息 ==="
lscpu | head -10`
    },
    {
      id: 'port-check',
      name: '端口检查',
      description: '检查指定端口是否开放',
      language: 'bash',
      script: `#!/bin/bash
# 检查端口是否开放
PORT=\${1:-80}
HOST=\${2:-localhost}

echo "检查 \$HOST:\$PORT 端口状态..."
if timeout 3 bash -c "</dev/tcp/\$HOST/\$PORT"; then
    echo "✅ 端口 \$PORT 在 \$HOST 上是开放的"
else
    echo "❌ 端口 \$PORT 在 \$HOST 上是关闭的或不可达"
fi`
    },
    {
      id: 'log-analyzer',
      name: '日志分析',
      description: '分析日志文件中的错误信息',
      language: 'bash',
      script: `#!/bin/bash
LOG_FILE=\${1:-/var/log/syslog}

echo "=== 分析日志文件: \$LOG_FILE ==="
echo ""

if [ ! -f "\$LOG_FILE" ]; then
    echo "❌ 日志文件不存在: \$LOG_FILE"
    exit 1
fi

echo "📊 文件大小: \$(du -h \$LOG_FILE | cut -f1)"
echo "📅 最后修改: \$(stat -c %y \$LOG_FILE)"
echo ""

echo "🔍 错误统计:"
echo "ERROR: \$(grep -c 'ERROR' \$LOG_FILE)"
echo "WARN: \$(grep -c 'WARN' \$LOG_FILE)"
echo "FATAL: \$(grep -c 'FATAL' \$LOG_FILE)"
echo ""

echo "📝 最近10条错误日志:"
grep 'ERROR' \$LOG_FILE | tail -10`
    }
  ]);

  const handleExecute = async () => {
    if (!script.trim()) {
      message.error('请输入要执行的脚本');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 这里应该调用后端 API 执行脚本
      const response = await fetch('/api/tools/execute-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          script,
          language,
          timeout: 30000
        })
      });

      if (!response.ok) {
        throw new Error(`执行失败: ${response.statusText}`);
      }

      const result = await response.json();
      setResult(result);

      if (result.success) {
        message.success('脚本执行成功');
      } else {
        message.error(`执行失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Script execution error:', error);
      const errorResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : '脚本执行失败',
        executionTime: 0
      };
      setResult(errorResult);
      message.error(`脚本执行失败: ${errorResult.error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setScript(template.script);
      setLanguage(template.language);
      message.success(`已加载模板: ${template.name}`);
    }
  };

  const handleSaveTemplate = () => {
    if (!script.trim()) {
      message.error('请输入脚本内容');
      return;
    }

    const name = prompt('请输入模板名称:');
    if (!name) return;

    const description = prompt('请输入模板描述:');
    if (!description) return;

    const newTemplate: ScriptTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description,
      script,
      language
    };

    setTemplates([...templates, newTemplate]);
    message.success('模板保存成功');
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setScript(content);
      message.success('文件上传成功');
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  return (
    <Card 
      title={
        <div className="flex items-center space-x-2">
          <FileTextOutlined />
          <span>脚本执行器</span>
        </div>
      }
      className="glass-card"
      extra={onClose && (
        <Button onClick={onClose} type="text">
          关闭
        </Button>
      )}
    >
      <div className="space-y-6">
        {/* 安全警告 */}
        <Alert
          message="安全提示"
          description="请谨慎执行脚本，确保脚本内容安全可信。恶意脚本可能对系统造成损害。"
          type="warning"
          showIcon
          className="bg-yellow-900/20 border-yellow-600"
        />

        {/* 模板选择 */}
        <div>
          <Title level={5} className="text-white mb-3">选择模板</Title>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                size="small"
                className="bg-gray-800/50 border-gray-600 hover:border-blue-500 cursor-pointer transition-all"
                onClick={() => handleLoadTemplate(template.id)}
              >
                <div className="space-y-2">
                  <Text strong className="text-white">{template.name}</Text>
                  <Text type="secondary" className="block text-sm">
                    {template.description}
                  </Text>
                  <div className="flex justify-between items-center">
                    <Text type="secondary" className="text-xs">
                      {template.language}
                    </Text>
                    {template.id.startsWith('custom-') && (
                      <Button
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplates(templates.filter(t => t.id !== template.id));
                          message.success('模板已删除');
                        }}
                        className="text-red-400 hover:text-red-300"
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Divider className="border-gray-600" />

        {/* 脚本编辑区 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Title level={5} className="text-white mb-0">编写脚本</Title>
            <Space>
              <Select
                value={language}
                onChange={setLanguage}
                style={{ width: 120 }}
              >
                <Option value="bash">Bash</Option>
                <Option value="python">Python</Option>
                <Option value="javascript">JavaScript</Option>
                <Option value="powershell">PowerShell</Option>
              </Select>
              <Upload
                beforeUpload={handleFileUpload}
                showUploadList={false}
                accept=".sh,.py,.js,.ps1,.txt"
              >
                <Button icon={<UploadOutlined />}>上传脚本</Button>
              </Upload>
              <Button 
                icon={<SaveOutlined />} 
                onClick={handleSaveTemplate}
                type="dashed"
              >
                保存为模板
              </Button>
            </Space>
          </div>

          <TextArea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={`请输入 ${language} 脚本...`}
            rows={12}
            className="font-mono"
            style={{ fontSize: '14px' }}
          />

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={loading}
            size="large"
            block
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? '执行中...' : '执行脚本'}
          </Button>
        </div>

        {/* 执行结果 */}
        {result && (
          <div className="space-y-3">
            <Title level={5} className="text-white">执行结果</Title>
            <div className="bg-gray-900/50 p-4 rounded border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {result.success ? (
                    <Text type="success">✅ 执行成功</Text>
                  ) : (
                    <Text type="danger">❌ 执行失败</Text>
                  )}
                  {result.executionTime && (
                    <Text type="secondary">
                      ({result.executionTime}ms)
                    </Text>
                  )}
                </div>
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={async () => {
                    await copyWithFeedback(
                      result.output || result.error || '',
                      (msg) => message.success(msg),
                      (msg) => message.error(msg)
                    );
                  }}
                >
                  复制
                </Button>
              </div>
              
              <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-auto max-h-96">
                {result.output || result.error || '无输出'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ScriptExecutor; 