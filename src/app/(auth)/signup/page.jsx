'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FIELD =
  'rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
const LABEL = 'text-[11px] font-semibold uppercase tracking-[.06em] text-muted';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        setError(signupData.error || 'Something went wrong');
        return;
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        router.push('/login');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-ink">Create an account</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Staff accounts get their permissions from an administrator.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={LABEL}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
          <p className="text-[11px] text-muted">At least 8 characters.</p>
        </div>

        {error && (
          <p className="rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad-fg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-brand-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0A5453] disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="text-[12.5px] text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-[#0A5453]">
          Log in
        </Link>
      </p>
    </div>
  );
}
