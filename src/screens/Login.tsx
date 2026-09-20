import { useState } from 'react';
import { loginUser } from '@/api';
import { useApp } from '@/store';

export default function Login() {
  const { go } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    try {
      setLoading(true);

      await loginUser({
        email,
        password,
      });

      // Login successful
      go('setup');

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => go('welcome')}
          className="mb-6 text-2xl text-slate-700"
        >
          ←
        </button>

        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back
        </h1>

        <p className="mt-2 text-slate-500">
          Login to continue using AccessMob
        </p>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleLogin}
        className="flex flex-1 flex-col"
      >

        <div className="space-y-5">

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                px-4
                py-3
                text-slate-900
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                px-4
                py-3
                text-slate-900
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

        </div>

        {/* Bottom section */}
        <div className="mt-auto pt-8">

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              rounded-xl
              bg-blue-600
              px-4
              py-3.5
              font-semibold
              text-white
              transition
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            Don't have an account?{' '}

            <button
              type="button"
              onClick={() => go('register')}
              className="font-semibold text-blue-600"
            >
              Create account
            </button>
          </p>

        </div>

      </form>

    </div>
  );
}