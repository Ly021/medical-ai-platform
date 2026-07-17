import apiClient from './client';

export interface DocumentInfo {
  source: string;
  filename: string;
  chunks: number;
  ids: string[];
}

export interface PreviewChunk {
  index: number;
  content: string;
  charCount: number;
}

export interface PreviewResult {
  success: boolean;
  source?: string;
  fileName?: string;
  chunks: number;
  preview: PreviewChunk[];
}

export const knowledgeBaseApi = {
  list: () => apiClient.get<{ success: boolean; data: DocumentInfo[] }>('/rag/documents'),

  remove: (ids: string[]) =>
    apiClient.delete<{ success: boolean; deleted: number }>('/rag/documents', { data: { ids } }),

  ingestUpload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ success: boolean; fileName: string; sourceDocuments: number; chunks: number; ids: string[] }>(
      '/rag/ingest/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 },
    );
  },

  previewUpload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<PreviewResult>('/rag/preview/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    });
  },
};
