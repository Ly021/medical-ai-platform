import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import {
  conversationsApi,
  type Conversation,
  type CreateConversationParams,
  type UpdateConversationParams,
} from '@/api/conversations';

interface ConversationsState {
  list: Conversation[];
  activeId: string | null;
  loading: boolean;
}

const initialState: ConversationsState = { list: [], activeId: null, loading: false };

export const fetchConversations = createAsyncThunk('conversations/fetchAll', async () => {
  const res = await conversationsApi.list();
  return res.data;
});

export const createConversation = createAsyncThunk(
  'conversations/create',
  async (params: CreateConversationParams) => {
    const res = await conversationsApi.create(params);
    return res.data;
  },
);

export const updateConversation = createAsyncThunk(
  'conversations/update',
  async ({ id, params }: { id: string; params: UpdateConversationParams }) => {
    const res = await conversationsApi.update(id, params);
    return res.data;
  },
);

export const deleteConversation = createAsyncThunk(
  'conversations/delete',
  async (id: string) => {
    await conversationsApi.remove(id);
    return id;
  },
);

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setActiveId(state, action: PayloadAction<string | null>) {
      state.activeId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.list = action.payload;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        state.activeId = action.payload.id;
      })
      .addCase(updateConversation.fulfilled, (state, action) => {
        const idx = state.list.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.list = state.list.filter((c) => c.id !== action.payload);
        if (state.activeId === action.payload) {
          state.activeId = state.list[0]?.id ?? null;
        }
      });
  },
});

export const { setActiveId } = conversationsSlice.actions;
export default conversationsSlice.reducer;
