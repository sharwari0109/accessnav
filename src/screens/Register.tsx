import { useState } from 'react';
import { registerUser } from '@/api';
import { useApp } from '@/store';

export default function Register() {
  const { go } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name,
        email,
        password,
      });

      setSuccess(
        'Account created successfully! You can now login.'
      );

      setName('');
      setEmail('');
      setPassword('');

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.'
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
          Create account
        </h1>

        <p className="mt-2 text-slate-500">
          Create your AccessMob account
        </p>

      </div>

      {/* Form */}
      <form
        onSubmit={handleRegister}
        className="flex flex-1 flex-col"
      >

        <div className="space-y-5">

          {/* Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Full name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
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
              placeholder="Create a password"
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

            <p className="mt-1 text-xs text-slate-400">
              Minimum 6 characters
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
              {success}
            </div>
          )}

        </div>

        {/* Bottom */}
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}

            <button
              type="button"
              onClick={() => go('login')}
              className="font-semibold text-blue-600"
            >
              Login
            </button>
          </p>

        </div>

      </form>

    </div>
  );
}