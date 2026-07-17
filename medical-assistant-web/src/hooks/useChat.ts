import { useState, useRef, useCallback } from 'react';
import type { Message, UserContent } from '@/api/conversations';

interface UseChatOptions {
  threadId: string;
  onMessagesChange?: (messages: Message[]) => void;
}

export function useChat({ threadId, onMessagesChange }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async (content: UserContent) => {
    const text = typeof content === 'string' ? content : content.find((b) => b.type === 'text')?.text ?? '';
    if (!text.trim() && typeof content !== 'string' && !content.some((b) => b.type === 'image_url')) return;
    if (loading) return;
    if (typeof content === 'string' && !content.trim()) return;
    setLoading(true);

    const userMsg: Message = { id: Date.now(), role: 'user', content };
    const aiMsgId = Date.now() + 1;
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '' };

    setMessages((prev) => {
      const updated = [...prev, userMsg, aiMsg];
      onMessagesChange?.(updated);
      return updated;
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, threadId }),
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
            setMessages((prev) => {
              const updated = prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + data.content, status: undefined } : m,
              );
              onMessagesChange?.(updated);
              return updated;
            });
          } else if (data.type === 'status') {
            setMessages((prev) => {
              const updated = prev.map((m) =>
                m.id === aiMsgId ? { ...m, status: data.content } : m,
              );
              return updated;
            });
          } else if (data.type === 'error') {
            setMessages((prev) => {
              const updated = prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content || `错误: ${data.content}` } : m,
              );
              onMessagesChange?.(updated);
              return updated;
            });
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: m.content || `请求失败: ${err.message}` } : m,
        );
        onMessagesChange?.(updated);
        return updated;
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [threadId, loading, onMessagesChange]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, loading, sendMessage, stopGeneration, loadMessages, clearMessages };
}
