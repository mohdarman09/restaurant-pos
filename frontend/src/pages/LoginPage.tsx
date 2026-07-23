import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { useAppDispatch } from '../app/hooks';
import { setCredentials } from '../features/auth/authSlice';
import { login } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('owner@spicejunction.example');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      dispatch(setCredentials(result));
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-paper-soft">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mb-3">
            <ChefHat size={28} className="text-brand-700" />
          </div>
          <h1 className="font-display text-2xl uppercase tracking-wide">Spice Junction</h1>
          <p className="text-brand-100/70 text-sm mt-1">Restaurant POS — staff sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="ticket p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="you@restaurant.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wide">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-brick-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-brand-700 font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button type="button" className="w-full text-center text-xs text-ink-faint hover:text-ink-muted">
            Forgot your password?
          </button>
        </form>

        <p className="text-center text-xs text-brand-100/50 mt-6">
          Demo: owner@spicejunction.example / Password@123
        </p>
      </div>
    </div>
  );
}
