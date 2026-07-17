import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { knowledgeBaseApi, type DocumentInfo, type PreviewResult } from '@/api/knowledgeBase';

interface KnowledgeBaseState {
  documents: DocumentInfo[];
  loading: boolean;
  preview: PreviewResult | null;
  previewLoading: boolean;
  uploading: boolean;
  error: string | null;
}

const initialState: KnowledgeBaseState = {
  documents: [],
  loading: false,
  preview: null,
  previewLoading: false,
  uploading: false,
  error: null,
};

export const fetchDocuments = createAsyncThunk(
  'knowledgeBase/fetchDocuments',
  async () => {
    const res = await knowledgeBaseApi.list();
    return res.data.data;
  },
);

export const deleteDocuments = createAsyncThunk(
  'knowledgeBase/deleteDocuments',
  async (ids: string[]) => {
    await knowledgeBaseApi.remove(ids);
    return ids;
  },
);

export const ingestFile = createAsyncThunk(
  'knowledgeBase/ingestFile',
  async (file: File) => {
    const res = await knowledgeBaseApi.ingestUpload(file);
    return res.data;
  },
);

export const previewFile = createAsyncThunk(
  'knowledgeBase/previewFile',
  async (file: File) => {
    const res = await knowledgeBaseApi.previewUpload(file);
    return res.data;
  },
);

const knowledgeBaseSlice = createSlice({
  name: 'knowledgeBase',
  initialState,
  reducers: {
    clearPreview(state) {
      state.preview = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.documents = action.payload;
        state.loading = false;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? '获取文档列表失败';
      })
      .addCase(deleteDocuments.fulfilled, (state, action) => {
        const deletedIds = new Set(action.payload);
        state.documents = state.documents
          .map((doc) => ({ ...doc, ids: doc.ids.filter((id) => !deletedIds.has(id)) }))
          .map((doc) => ({ ...doc, chunks: doc.ids.length }))
          .filter((doc) => doc.chunks > 0);
      })
      .addCase(deleteDocuments.rejected, (state, action) => {
        state.error = action.error.message ?? '删除失败';
      })
      .addCase(ingestFile.pending, (state) => { state.uploading = true; state.error = null; })
      .addCase(ingestFile.fulfilled, (state) => { state.uploading = false; })
      .addCase(ingestFile.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.error.message ?? '上传失败';
      })
      .addCase(previewFile.pending, (state) => { state.previewLoading = true; state.error = null; })
      .addCase(previewFile.fulfilled, (state, action) => {
        state.preview = action.payload;
        state.previewLoading = false;
      })
      .addCase(previewFile.rejected, (state, action) => {
        state.previewLoading = false;
        state.error = action.error.message ?? '预览失败';
      });
  },
});

export const { clearPreview, clearError } = knowledgeBaseSlice.actions;
export default knowledgeBaseSlice.reducer;
