// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetFamilyCode, setTargetFamilyCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // 🚀 백엔드 API(/api/auth)로 로그인/가입 요청 전송
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, targetFamilyCode, isSignUp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '인증 실패');
      }

      if (isSignUp) {
        // 회원가입 모드일 때
        setSuccessMessage('보안 메일 인증 링크가 발송되었습니다! 메일함을 확인하여 인증을 완료해 주세요. 🦚');
        alert('가입 승인 대기 중: 이메일 인증을 완료해야 로그인이 활성화됩니다.');
      } else {
        // 로그인 모드일 때 (세션 세팅 후 메인 관제탑으로 진입)
        alert('로그인 성공! 관제탑 입장');
        localStorage.setItem('familyCode', data.user.familyCode);
        localStorage.setItem('userEmail', email);
        router.push('/');
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        
        {/* 브랜딩 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400">
            PEACOCK TIME
          </h1>
          <p className="text-sm text-slate-400 mt-2">부부 공동 육아 실시간 관제 시스템 V2</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-400/50 transition-colors"
              placeholder="parent@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-400/50 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {/* 회원가입 모드일 때만 가족코드 입력칸 활성화 */}
          {isSignUp && (
            <div className="pt-2 border-t border-slate-800/60">
              <label className="block text-xs font-semibold text-amber-200/80 uppercase tracking-wider mb-2">
                가족 코드 연동 (선택)
              </label>
              <input
                type="text"
                value={targetFamilyCode}
                onChange={(e) => setTargetFamilyCode(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/20 text-amber-100 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-400 transition-colors uppercase"
                placeholder="배우자에게 받은 FAM-XXXXX 입력"
              />
              <p className="text-[11px] text-slate-500 mt-1">처음 가입하시는 경우 비워두면 코드가 자동 생성됩니다.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400 font-medium text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>}
          {successMessage && <p className="text-xs text-orange-400 font-medium text-center bg-orange-500/10 py-3 px-2 rounded-lg border border-orange-500/20 leading-relaxed">{successMessage}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400/90 to-orange-500 text-slate-950 font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '인프라 동기화 중...' : isSignUp ? '관제망 새로 구축하기' : '관제탑 입장'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccessMessage('');
            }}
            className="text-xs text-slate-400 hover:text-orange-400 underline underline-offset-4 transition-colors"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인하기' : '처음이신가요? 부부 계정 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}