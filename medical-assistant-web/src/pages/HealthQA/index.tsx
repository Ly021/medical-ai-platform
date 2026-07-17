import { Card, Input, Button, List, Avatar, Spin, Tag } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  LoadingOutlined,
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
  PictureOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  setActiveId,
} from '@/store/slices/conversations.slice';
import type { Message, ContentBlock, UserContent } from '@/api/conversations';
import { useChat } from '@/hooks/useChat';

export default function HealthQA() {
  const dispatch = useAppDispatch();
  const { list, activeId } = useAppSelector((s) => s.conversations);
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [initialMsg, setInitialMsg] = useState<Message[]>([]);
  const pendingMessage = useRef<UserContent | null>(null);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1024;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = async (files: FileList | File[]) => {
    const results: { url: string; name: string }[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = await compressImage(f);
      results.push({ url, name: f.name });
    }
    setImages((prev) => [...prev, ...results]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      addImages(files);
    }
  };

  const onMessagesChange = useCallback(
    (messages: Message[]) => {
      if (!activeId) return;
      dispatch(updateConversation({ id: activeId, params: { messages } }));
    },
    [activeId, dispatch],
  );

  const activeConv = list.find((c) => c.id === activeId);
  const threadId = activeConv?.threadId ?? 'default';

  const { messages, loading, sendMessage, loadMessages, clearMessages } = useChat({
    threadId,
    onMessagesChange,
  });

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // send pending message once threadId is available for the new conversation
  useEffect(() => {
    if (activeConv && pendingMessage.current) {
      const content = pendingMessage.current;
      pendingMessage.current = null;
      const firstUser = messages.find((m) => m.role === 'user');
      if (!firstUser) {
        const titleText =
          typeof content === 'string'
            ? content
            : content.find((b) => b.type === 'text')?.text ?? '[图片]';
        dispatch(updateConversation({ id: activeConv.id, params: { title: titleText.slice(0, 20) } }));
      }
      sendMessage(content);
    }
  }, [activeConv?.threadId]);

  useEffect(() => {
    if (!activeConv) {
      clearMessages();
      return;
    }
    const parsed = JSON.parse(activeConv.messages || '[]') as Message[];
    if (parsed.length > 0) {
      loadMessages(parsed);
    } else {
      clearMessages();
      setInitialMsg([
        { id: 1, role: 'assistant', content: '您好！我是智能客服，请问有什么健康方面的问题需要咨询？' },
      ]);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if ((!text && images.length === 0) || loading) return;
    setInputValue('');
    const imgBlocks: ContentBlock[] = images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: img.url },
    }));
    setImages([]);
    const message: UserContent =
      images.length > 0
        ? [...(text ? [{ type: 'text' as const, text }] : []), ...imgBlocks]
        : text;

    if (!activeId) {
      const newThreadId = crypto.randomUUID();
      dispatch(createConversation({ threadId: newThreadId }));
      pendingMessage.current = message;
      return;
    }

    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser && activeConv?.title === '新对话') {
      const titleText = text || '[图片]';
      const title = titleText.slice(0, 20);
      dispatch(updateConversation({ id: activeId, params: { title } }));
    }

    sendMessage(message);
  };

  const handleNewConv = () => {
    if (activeId === null) return;
    dispatch(setActiveId(null));
    clearMessages();
    setImages([]);
    setInitialMsg([
      { id: 1, role: 'assistant', content: '您好！我是智能客服，请问有什么健康方面的问题需要咨询？' },
    ]);
  };

  const handleSelect = async (id: string) => {
    dispatch(setActiveId(id));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(deleteConversation(id));
    if (activeId === id) {
      clearMessages();
      setImages([]);
      setInitialMsg([
        { id: 1, role: 'assistant', content: '您好！我是智能客服，请问有什么健康方面的问题需要咨询？' },
      ]);
    }
  };

  const displayMsgs = messages.length === 0 ? initialMsg : messages;

  const renderMessageContent = (msg: Message) => {
    if (typeof msg.content === 'string') {
      return msg.content || (loading && msg.role === 'assistant' && <Spin size="small" />);
    }
    return (
      <div className="flex flex-col gap-2">
        {msg.content.map((block, i) => {
          if (block.type === 'text') return <span key={i}>{block.text}</span>;
          if (block.type === 'image_url')
            return (
              <img
                key={i}
                src={block.image_url.url}
                alt="uploaded"
                className="rounded-lg max-w-[200px] cursor-pointer hover:opacity-90"
                style={{ maxWidth: 200 }}
                onClick={() => window.open(block.image_url.url, '_blank')}
              />
            );
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Sidebar */}
      <Card
        className="shrink-0"
        styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
        style={{ width: 260 }}
      >
        <div className="p-3 border-b border-gray-200">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleNewConv}
            block
          >
            新建对话
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <List
            dataSource={list}
            split={false}
            renderItem={(item) => (
              <List.Item
                className={`cursor-pointer hover:bg-gray-50 px-3 py-2 ${
                  item.id === activeId ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleSelect(item.id)}
              >
                <div className="flex items-center gap-2 w-full">
                  <MessageOutlined className="text-gray-400 shrink-0" />
                  <span className="truncate text-sm flex-1">{item.title}</span>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDelete(item.id, e)}
                  />
                </div>
              </List.Item>
            )}
          />
        </div>
      </Card>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <h2 className="text-2xl font-semibold mb-4 shrink-0">健康问答</h2>

        <Card className="mb-4 flex-1 min-h-0" styles={{ body: { padding: 0, height: '100%' } }}>
          <div ref={listRef} className="h-full overflow-auto px-6 py-4">
            <List
              dataSource={displayMsgs}
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
                        item.role === 'assistant' ? 'bg-gray-100' : 'bg-blue-500 text-white'
                      }`}
                    >
                      {item.status && (
                        <Tag color="orange" className="mb-1">
                          <LoadingOutlined spin className="mr-1" />
                          {item.status}
                        </Tag>
                      )}
                      {renderMessageContent(item)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Card>

        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50 border border-gray-200"
                  onClick={() => removeImage(i)}
                >
                  <CloseOutlined className="text-[10px] text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addImages(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            icon={<PictureOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          />
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
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
    </div>
  );
}
