'use client';

import React, { useState } from 'react';
import { Card, Row, Col, Typography, Button, Badge, Input, message, Space, Tabs, Slider, Switch, Checkbox, Divider, Tooltip } from 'antd';
import {
  ToolOutlined,
  CodeOutlined,
  CopyOutlined,
  ClearOutlined,
  FileTextOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import MainLayout from '../components/layout/MainLayout';
import { useTheme } from '../hooks/useGlobalState';

const { Title, Text } = Typography;
const { TextArea } = Input;

// JSON格式化工具组件
const JsonFormatter: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const formatJson = () => {
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutput(formatted);
      setIsValid(true);
      message.success('JSON格式化成功');
    } catch (error) {
      setIsValid(false);
      setOutput(`错误: ${(error as Error).message}`);
      message.error('JSON格式无效');
    }
  };

  const minifyJson = () => {
    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setIsValid(true);
      message.success('JSON压缩成功');
    } catch (error) {
      setIsValid(false);
      setOutput(`错误: ${(error as Error).message}`);
      message.error('JSON格式无效');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    message.success('已复制到剪贴板');
  };

  return (
    <div className="space-y-4">
      <div>
        <Text strong>输入JSON:</Text>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="请输入JSON数据..."
          rows={6}
          className="mt-2"
        />
      </div>
      <Space>
        <Button type="primary" onClick={formatJson} icon={<FileTextOutlined />}>
          格式化
        </Button>
        <Button onClick={minifyJson}>压缩</Button>
        <Button onClick={() => { setInput(''); setOutput(''); setIsValid(null); }} icon={<ClearOutlined />}>
          清空
        </Button>
      </Space>
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Text strong>输出结果:</Text>
          {isValid === true && <CheckCircleOutlined className="text-green-500" />}
          {isValid === false && <ExclamationCircleOutlined className="text-red-500" />}
          {output && (
            <Button size="small" icon={<CopyOutlined />} onClick={copyToClipboard}>
              复制
            </Button>
          )}
        </div>
        <TextArea
          value={output}
          readOnly
          rows={8}
          className={`${isValid === false ? 'border-red-500' : ''}`}
        />
      </div>
    </div>
  );
};

// Base64编码解码工具组件
const Base64Tool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const processBase64 = () => {
    try {
      if (mode === 'encode') {
        const encoded = btoa(unescape(encodeURIComponent(input)));
        setOutput(encoded);
        message.success('Base64编码成功');
      } else {
        const decoded = decodeURIComponent(escape(atob(input)));
        setOutput(decoded);
        message.success('Base64解码成功');
      }
    } catch (error) {
      message.error('处理失败，请检查输入内容');
      setOutput(`错误: ${(error as Error).message}`);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    message.success('已复制到剪贴板');
  };

  return (
    <div className="space-y-4">
      <div>
        <Space className="mb-2">
          <Button
            type={mode === 'encode' ? 'primary' : 'default'}
            onClick={() => setMode('encode')}
            icon={<LockOutlined />}
          >
            编码
          </Button>
          <Button
            type={mode === 'decode' ? 'primary' : 'default'}
            onClick={() => setMode('decode')}
            icon={<UnlockOutlined />}
          >
            解码
          </Button>
        </Space>
        <Text strong>输入内容:</Text>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'encode' ? '请输入要编码的文本...' : '请输入要解码的Base64字符串...'}
          rows={4}
          className="mt-2"
        />
      </div>
      <Space>
        <Button type="primary" onClick={processBase64}>
          {mode === 'encode' ? '编码' : '解码'}
        </Button>
        <Button onClick={() => { setInput(''); setOutput(''); }} icon={<ClearOutlined />}>
          清空
        </Button>
      </Space>
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Text strong>输出结果:</Text>
          {output && (
            <Button size="small" icon={<CopyOutlined />} onClick={copyToClipboard}>
              复制
            </Button>
          )}
        </div>
        <TextArea
          value={output}
          readOnly
          rows={4}
        />
      </div>
    </div>
  );
};

// YAML验证工具组件
const YamlValidator: React.FC = () => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const validateYaml = () => {
    try {
      // 简单的YAML语法检查
      const lines = input.split('\n');
      let indentStack: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;

        const indent = line.length - line.trimStart().length;

        // 检查缩进是否为2的倍数
        if (indent % 2 !== 0) {
          throw new Error(`第${i + 1}行: 缩进必须是2的倍数`);
        }

        // 检查键值对格式
        if (line.includes(':') && !line.trim().startsWith('-')) {
          const parts = line.split(':');
          if (parts.length < 2) {
            throw new Error(`第${i + 1}行: 键值对格式错误`);
          }
        }
      }

      setIsValid(true);
      setError('');
      message.success('YAML格式验证通过');
    } catch (error) {
      setIsValid(false);
      setError((error as Error).message);
      message.error('YAML格式验证失败');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Text strong>输入YAML:</Text>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="请输入YAML内容..."
          rows={8}
          className="mt-2"
        />
      </div>
      <Space>
        <Button type="primary" onClick={validateYaml} icon={<CheckCircleOutlined />}>
          验证YAML
        </Button>
        <Button onClick={() => { setInput(''); setIsValid(null); setError(''); }} icon={<ClearOutlined />}>
          清空
        </Button>
      </Space>
      {isValid !== null && (
        <Card
          className={`${isValid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
          size="small"
        >
          <div className="flex items-center space-x-2">
            {isValid ? (
              <>
                <CheckCircleOutlined className="text-green-500" />
                <Text className="text-green-700">YAML格式正确</Text>
              </>
            ) : (
              <>
                <ExclamationCircleOutlined className="text-red-500" />
                <Text className="text-red-700">{error}</Text>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

// 密码生成工具组件
const PasswordGenerator: React.FC = () => {
  const { isDark } = useTheme();
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [customChars, setCustomChars] = useState('');
  const [useCustomChars, setUseCustomChars] = useState(false);

  const generatePassword = () => {
    let charset = '';

    if (useCustomChars && customChars) {
      charset = customChars;
    } else {
      if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
      if (includeNumbers) charset += '0123456789';
      if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

      if (excludeSimilar) {
        charset = charset.replace(/[0O1lI]/g, '');
      }
    }

    if (!charset) {
      message.error('请至少选择一种字符类型');
      return;
    }

    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    setPassword(result);
    message.success('密码生成成功');
  };

  const copyPassword = async () => {
    if (!password) {
      message.warning('请先生成密码');
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      message.success('密码已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: '弱', color: '#ff4d4f' };
    if (score <= 4) return { level: '中', color: '#faad14' };
    return { level: '强', color: '#52c41a' };
  };

  const strength = password ? getPasswordStrength(password) : null;

  return (
    <div className="space-y-6">
      {/* 密码设置 */}
      <Card title="密码设置" size="small">
        <div className="space-y-4">
          {/* 密码长度 */}
          <div>
            <Text strong>密码长度: {length}</Text>
            <Slider
              min={4}
              max={128}
              value={length}
              onChange={setLength}
              style={{ marginTop: 8 }}
              marks={{
                4: '4',
                8: '8',
                16: '16',
                32: '32',
                64: '64',
                128: '128'
              }}
            />
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* 字符类型选择 */}
          <div>
            <Text strong>字符类型:</Text>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Checkbox
                checked={includeUppercase}
                onChange={(e) => setIncludeUppercase(e.target.checked)}
                disabled={useCustomChars}
              >
                大写字母 (A-Z)
              </Checkbox>
              <Checkbox
                checked={includeLowercase}
                onChange={(e) => setIncludeLowercase(e.target.checked)}
                disabled={useCustomChars}
              >
                小写字母 (a-z)
              </Checkbox>
              <Checkbox
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                disabled={useCustomChars}
              >
                数字 (0-9)
              </Checkbox>
              <Checkbox
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                disabled={useCustomChars}
              >
                特殊符号 (!@#$%^&*...)
              </Checkbox>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* 高级选项 */}
          <div>
            <Text strong>高级选项:</Text>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Checkbox
                checked={excludeSimilar}
                onChange={(e) => setExcludeSimilar(e.target.checked)}
                disabled={useCustomChars}
              >
                排除相似字符 (0, O, 1, l, I)
              </Checkbox>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={useCustomChars}
                  onChange={(e) => setUseCustomChars(e.target.checked)}
                >
                  使用自定义字符集:
                </Checkbox>
              </div>
              {useCustomChars && (
                <Input
                  value={customChars}
                  onChange={(e) => setCustomChars(e.target.value)}
                  placeholder="输入自定义字符集，如: abc123!@#"
                  style={{ marginTop: 4 }}
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 生成按钮 */}
      <div style={{ textAlign: 'center' }}>
        <Space size="large">
          <Button
            type="primary"
            size="large"
            icon={<KeyOutlined />}
            onClick={generatePassword}
          >
            生成密码
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={generatePassword}
            disabled={!password}
          >
            重新生成
          </Button>
        </Space>
      </div>

      {/* 生成的密码 */}
      {password && (
        <Card title="生成的密码" size="small">
          <div className="space-y-4">
            <div style={{
              background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f5f5f5',
              padding: '12px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '16px',
              wordBreak: 'break-all',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
              color: isDark ? '#fff' : '#000'
            }}>
              {password}
            </div>

            {strength && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>密码强度:</Text>
                <Badge
                  color={strength.color}
                  text={
                    <span style={{ color: strength.color, fontWeight: 'bold' }}>
                      {strength.level}
                    </span>
                  }
                />
                <Text type="secondary">({password.length} 个字符)</Text>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={copyPassword}
              >
                复制密码
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 密码安全提示 */}
      <Card
        title="安全提示"
        size="small"
        style={{
          background: isDark ? 'rgba(82, 196, 26, 0.05)' : '#f6ffed',
          borderColor: isDark ? 'rgba(82, 196, 26, 0.2)' : '#b7eb8f'
        }}
      >
        <div className="space-y-2">
          <div>• 建议密码长度至少12位</div>
          <div>• 包含大小写字母、数字和特殊符号</div>
          <div>• 不要使用个人信息作为密码</div>
          <div>• 定期更换密码</div>
          <div>• 不要在多个账户使用相同密码</div>
        </div>
      </Card>
    </div>
  );
};

export default function ToolsPage() {
  const { isDark } = useTheme();

  const toolItems = [
    {
      key: 'json',
      label: (
        <span>
          <FileTextOutlined /> JSON 格式化
        </span>
      ),
      children: <JsonFormatter />,
    },
    {
      key: 'base64',
      label: (
        <span>
          <LockOutlined /> Base64 编码
        </span>
      ),
      children: <Base64Tool />,
    },
    {
      key: 'yaml',
      label: (
        <span>
          <CheckCircleOutlined /> YAML 验证
        </span>
      ),
      children: <YamlValidator />,
    },
    {
      key: 'password',
      label: (
        <span>
          <KeyOutlined /> 密码生成
        </span>
      ),
      children: <PasswordGenerator />,
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Title level={2} className={`mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                🛠️ DevOps 工具箱
              </Title>
              <Text type="secondary" className="text-lg">
                实用的开发运维工具集合，提高工作效率
              </Text>
            </div>
            <Badge count={toolItems.length} showZero color="#52c41a">
              <Button
                type="primary"
                icon={<ToolOutlined />}
                size="large"
                className="bg-green-600 hover:bg-green-700"
              >
                可用工具
              </Button>
            </Badge>
          </div>

          {/* 统计信息 */}
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" className="text-center bg-blue-600/10 border-blue-500">
                <div className={isDark ? 'text-white' : 'text-gray-800'}>
                  <div className="text-2xl font-bold">{toolItems.length}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>可用工具</div>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" className="text-center bg-green-600/10 border-green-500">
                <div className={isDark ? 'text-white' : 'text-gray-800'}>
                  <div className="text-2xl font-bold">100%</div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>功能完整</div>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" className="text-center bg-cyan-600/10 border-cyan-500">
                <div className={isDark ? 'text-white' : 'text-gray-800'}>
                  <div className="text-2xl font-bold">0</div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>演示工具</div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        {/* 工具界面 */}
        <Card className="glass-card">
          <Tabs
            defaultActiveKey="json"
            items={toolItems}
            size="large"
            className={isDark ? 'dark-tabs' : ''}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
