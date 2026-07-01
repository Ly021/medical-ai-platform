import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  name: string;
  role: 'doctor' | 'patient' | null;
}

const initialState: UserState = {
  name: '',
  role: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<UserState>) {
      state.name = action.payload.name;
      state.role = action.payload.role;
    },
    clearUser(state) {
      state.name = '';
      state.role = null;
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
