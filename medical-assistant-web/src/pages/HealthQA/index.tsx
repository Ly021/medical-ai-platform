import { Card, Input, Button, List, Avatar, Typography } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useState, useRef } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  typing?: boolean;
}

export default function HealthQA() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: '您好！我是智能医生助手，请问有什么健康方面的问题需要咨询？' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
    };
    const assistantId = Date.now() + 1;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '思考中...', typing: true }]);
    setInputValue('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === 'chunk') {
              if (firstChunk) {
                firstChunk = false;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: json.content, typing: false } : m,
                  ),
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + json.content } : m,
                  ),
                );
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '抱歉，服务暂时不可用，请稍后重试。', typing: false }
              : m,
          ),
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">健康问答</h2>

      <Card
        className="mb-4"
        styles={{ body: { height: 400, overflow: 'auto' } }}
      >
        <List
          dataSource={messages}
          split={false}
          renderItem={(item) => (
            <List.Item>
              <div className={`flex gap-3 w-full ${item.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {!item.typing && (
                  <Avatar
                    icon={item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                    style={{ backgroundColor: item.role === 'assistant' ? '#1677ff' : '#52c41a' }}
                  />
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    item.role === 'assistant'
                      ? item.typing ? 'text-gray-400' : 'bg-gray-100'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  {item.typing ? (
                    <Typography.Text type="secondary">{item.content}</Typography.Text>
                  ) : (
                    item.content
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <div className="flex gap-3">
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="请输入您的健康问题..."
          rows={2}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          className="h-auto"
        >
          发送
        </Button>
      </div>
    </div>
  );
}
