import { Card, Input, Button, List, Avatar } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function HealthQA() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: '您好！我是智能医生助手，请问有什么健康方面的问题需要咨询？' },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const newMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputValue('');
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
                  {item.content}
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
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          className="h-auto"
        >
          发送
        </Button>
      </div>
    </div>
  );
}
