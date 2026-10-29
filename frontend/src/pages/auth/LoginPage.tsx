import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CakeSlice, LogIn } from 'lucide-react';
import { authApi } from '@/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate    = useNavigate();
  const { setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin,      setPin]      = useState('');
  const [mode,     setMode]     = useState<'password' | 'pin'>('password');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'password'
        ? await authApi.login(username, password)
        : await authApi.pinLogin(pin);

      localStorage.setItem('accessToken',  res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: '#FBF6EE' }}
    >
      <div
        className="w-full max-w-md rounded-card"
        style={{
          background: '#fff',
          border: '1px solid #EADFD0',
          boxShadow: '0 4px 16px rgba(43,27,20,0.12)',
          padding: '40px 36px',
        }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: '#E8590C' }}
          >
            <CakeSlice size={32} color="#fff" strokeWidth={2} />
          </div>
          <h1
            className="leading-tight"
            style={{
              fontFamily: '"DM Serif Display", serif',
              fontSize: '28px', fontWeight: 700, color: '#1F1611',
            }}
          >
            Bakery CRM
          </h1>
          <p className="mt-1" style={{ fontSize: '16px', color: '#7A6A5F' }}>
            Sign in to your account
          </p>
        </div>

        {/* Mode toggle */}
        <div
          className="mb-6 flex rounded-btn p-1"
          style={{ background: '#EADFD0' }}
        >
          {(['password', 'pin'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 rounded-[10px] py-2 text-[15px] font-semibold transition-colors"
              style={mode === m
                ? { background: '#E8590C', color: '#fff' }
                : { background: 'transparent', color: '#7A6A5F' }
              }
            >
              {m === 'password' ? 'Password' : 'PIN (Cashier)'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'password' && (
            <>
              <div>
                <label
                  className="mb-1.5 block font-medium"
                  style={{ fontSize: '15px', color: '#1F1611' }}
                >
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-btn px-4 py-3 text-[16px] outline-none transition"
                  style={{
                    border: '1.5px solid #EADFD0',
                    background: '#FBF6EE',
                    color: '#1F1611',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block font-medium"
                  style={{ fontSize: '15px', color: '#1F1611' }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-btn px-4 py-3 text-[16px] outline-none transition"
                  style={{
                    border: '1.5px solid #EADFD0',
                    background: '#FBF6EE',
                    color: '#1F1611',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
                  required
                  autoComplete="current-password"
                />
              </div>
            </>
          )}

          {mode === 'pin' && (
            <div>
              <label
                className="mb-1.5 block font-medium"
                style={{ fontSize: '15px', color: '#1F1611' }}
              >
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-btn px-4 py-3 text-center text-3xl tracking-widest outline-none transition"
                style={{
                  border: '1.5px solid #EADFD0',
                  background: '#FBF6EE',
                  color: '#1F1611',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#E8590C')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = '#EADFD0')}
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                required
                placeholder="••••"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div
              className="rounded-btn px-4 py-3 text-[15px]"
              style={{ background: '#FDE5E0', color: '#C0392B' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="press flex w-full items-center justify-center gap-2 rounded-btn py-3.5 text-[16px] font-semibold text-white transition-colors"
            style={{
              background: loading ? '#F0A580' : '#E8590C',
              minHeight: '52px',
              border: 'none',
            }}
          >
            <LogIn size={18} strokeWidth={2.5} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center" style={{ fontSize: '14px', color: '#7A6A5F' }}>
          Default admin:{' '}
          <span className="font-mono" style={{ color: '#1F1611' }}>admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
