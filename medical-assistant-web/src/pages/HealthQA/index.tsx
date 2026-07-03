import { Card, Input, Button, List, Avatar, Spin, Tag } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, LoadingOutlined } from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  status?: string;
}

export default function HealthQA() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: '您好！我是智能医生助手，请问有什么健康方面的问题需要咨询？' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: inputValue };
    const aiMsgId = Date.now() + 1;
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
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
      if (!reader) throw new Error('不支持流式响应');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + data.content, status: undefined } : m,
              ),
            );
          } else if (data.type === 'status') {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, status: data.content } : m)),
            );
          } else if (data.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content || `错误: ${data.content}` } : m,
              ),
            );
          }
          // data.type === 'done' → keep current content
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: m.content || `请求失败: ${err.message}` } : m,
        ),
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">健康问答</h2>

      <Card className="mb-4" styles={{ body: { padding: 0 } }}>
        <div ref={listRef} className="h-[400px] overflow-auto px-6 py-4">
          <List
            dataSource={messages}
            split={false}
            renderItem={(item) => (
              <List.Item>
                <div className={`flex gap-3 w-full ${item.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <Avatar
                    icon={item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                    style={{ backgroundColor: item.role === 'assistant' ? '#1677ff' : '#52c41a' }}
                  />
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      item.role === 'assistant'
                        ? 'bg-gray-100'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {item.status && (
                      <Tag color="orange" className="mb-1">
                        <LoadingOutlined spin className="mr-1" />
                        {item.status}
                      </Tag>
                    )}
                    {item.content || (loading && item.role === 'assistant' && <Spin size="small" />)}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
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
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={loading}
          className="h-auto"
        >
          发送
        </Button>
      </div>
    </div>
  );
}