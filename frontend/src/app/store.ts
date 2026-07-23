import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import posReducer from '../features/pos/posSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    pos: posReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
