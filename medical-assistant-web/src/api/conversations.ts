import apiClient from './client';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type UserContent = string | ContentBlock[];

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: UserContent;
  status?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationParams {
  title?: string;
  threadId: string;
}

export interface UpdateConversationParams {
  title?: string;
  messages?: Message[];
}

export const conversationsApi = {
  list: () => apiClient.get<Conversation[]>('/conversations'),

  get: (id: string) => apiClient.get<Conversation>(`/conversations/${id}`),

  create: (params: CreateConversationParams) =>
    apiClient.post<Conversation>('/conversations', params),

  update: (id: string, params: UpdateConversationParams) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, params),

  remove: (id: string) => apiClient.delete(`/conversations/${id}`),
};