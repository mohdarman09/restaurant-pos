import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// Access/refresh tokens are kept in sessionStorage only (cleared when the tab closes),
// never localStorage, to reduce the window an XSS payload could exfiltrate them.
function loadPersisted(): Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'> {
  try {
    const raw = sessionStorage.getItem('pos_auth');
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    return JSON.parse(raw);
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function persist(state: AuthState) {
  sessionStorage.setItem('pos_auth', JSON.stringify(state));
}

const initialState: AuthState = loadPersisted();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      persist(state);
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      persist(state);
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      sessionStorage.removeItem('pos_auth');
    },
  },
});

export const { setCredentials, setAccessToken, logout } = authSlice.actions;
export default authSlice.reducer;
