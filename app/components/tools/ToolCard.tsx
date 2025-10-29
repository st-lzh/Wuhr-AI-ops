'use client';

import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, InputNumber, message, Badge, Typography, Space, Tooltip } from 'antd';
import { 
  PlayCircleOutlined, 
  HeartOutlined, 
  HeartFilled, 
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { Tool, ToolInput, ToolResult, executeBuiltInTool, toggleToolFavorite, saveToolToHistory } from '../../utils/tools';
import { copyWithFeedback } from '../../utils/clipboard';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ToolCardProps {
  tool: Tool;
  onFavoriteChange?: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onFavoriteChange }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [showInputs, setShowInputs] = useState(false);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setResult(null);

      const executionResult = await executeBuiltInTool(tool.id, values);
      setResult(executionResult);

      // 保存到历史记录
      saveToolToHistory(tool, values, executionResult);

      if (executionResult.success) {
        message.success('工具执行成功');
      } else {
        message.error(`执行失败: ${executionResult.error}`);
      }
    } catch (error) {
      console.error('Tool execution error:', error);
      message.error('工具执行失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = () => {
    toggleToolFavorite(tool.id);
    onFavoriteChange?.();
    message.success(tool.isFavorite ? '已取消收藏' : '已添加到收藏');
  };

  const handleCopyResult = async () => {
    if (result?.data) {
      const textToCopy = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      await copyWithFeedback(
        textToCopy,
        (msg) => message.success(msg),
        (msg) => message.error(msg)
      );
    }
  };

  const handleDownloadResult = () => {
    if (result?.data) {
      const textToDownload = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      const blob = new Blob([textToDownload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tool.name}_result.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('结果已下载');
    }
  };

  const renderInput = (input: ToolInput) => {
    const commonProps = {
      placeholder: input.placeholder,
      size: 'large' as const
    };

    switch (input.type) {
      case 'textarea':
        return (
          <TextArea
            {...commonProps}
            rows={4}
            autoSize={{ minRows: 3, maxRows: 8 }}
          />
        );
      case 'number':
        return (
          <InputNumber
            {...commonProps}
            min={1}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <Select {...commonProps} options={input.options?.map(opt => ({ label: opt, value: opt }))} />
        );
      default:
        return <Input {...commonProps} />;
    }
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Badge 
              status={result.success ? 'success' : 'error'} 
              text={result.success ? '执行成功' : '执行失败'} 
            />
            {result.executionTime && (
              <Text type="secondary" className="flex items-center space-x-1">
                <ClockCircleOutlined />
                <span>{result.executionTime}ms</span>
              </Text>
            )}
          </div>
          {result.success && result.data && (
            <Space>
              <Tooltip title="复制结果">
                <Button 
                  size="small" 
                  icon={<CopyOutlined />} 
                  onClick={handleCopyResult}
                  type="text"
                />
              </Tooltip>
              <Tooltip title="下载结果">
                <Button 
                  size="small" 
                  icon={<DownloadOutlined />} 
                  onClick={handleDownloadResult}
                  type="text"
                />
              </Tooltip>
            </Space>
          )}
        </div>

        {result.success ? (
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            {typeof result.data === 'string' ? (
              <Paragraph 
                copyable 
                className="mb-0 font-mono text-sm whitespace-pre-wrap"
              >
                {result.data}
              </Paragraph>
            ) : (
              <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <div className="text-red-400 bg-red-900/20 p-3 rounded border border-red-600">
            {result.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card 
      className="glass-card hover:shadow-lg transition-all duration-300 h-full"
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge color="blue" />
            <span className="text-white font-medium">{tool.name}</span>
          </div>
          <Button
            type="text"
            icon={tool.isFavorite ? <HeartFilled className="text-red-500" /> : <HeartOutlined />}
            onClick={handleFavoriteToggle}
            className="text-gray-400 hover:text-red-500"
          />
        </div>
      }
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => setShowInputs(!showInputs)}
          size="small"
        >
          {showInputs ? '收起' : '使用'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Text type="secondary" className="block">
          {tool.description}
        </Text>

        {showInputs && (
          <div className="space-y-4">
            <Form
              form={form}
              layout="vertical"
              initialValues={tool.inputs.reduce((acc, input) => {
                if (input.defaultValue) {
                  acc[input.name] = input.defaultValue;
                }
                return acc;
              }, {} as Record<string, any>)}
            >
              {tool.inputs.map((input) => (
                <Form.Item
                  key={input.name}
                  name={input.name}
                  label={<span className="text-gray-300">{input.label}</span>}
                  rules={[
                    {
                      required: input.required,
                      message: `请输入${input.label}`
                    }
                  ]}
                >
                  {renderInput(input)}
                </Form.Item>
              ))}
            </Form>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={loading}
              block
              size="large"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? '执行中...' : '执行工具'}
            </Button>

            {renderResult()}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ToolCard; 