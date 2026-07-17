import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/user.slice';
import conversationsReducer from './slices/conversations.slice';
import knowledgeBaseReducer from './slices/knowledgeBase.slice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    conversations: conversationsReducer,
    knowledgeBase: knowledgeBaseReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
