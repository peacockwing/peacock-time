'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // [1번 해결법 적용] 뒤의 /login을 떼고 현재 존재하는 백엔드 주소인 '/api/auth'로 직행합니다.
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      // 이제 404 HTML이 아니라 백엔드가 리턴하는 정상적인 JSON 데이터를 받아옵니다.
      const data = await res.json();

      if (data.success) {
        // 로그인 성공 시 백엔드에서 매핑해서 준 세션 데이터들을 스토리지에 탑재
        localStorage.setItem('familyCode', data.familyCode);
        localStorage.setItem('userEmail', email.trim());
        if (data.userName) {
          localStorage.setItem('peacock_name', data.userName);
        }

        // Next.js 라우터 캐시 강제 무효화 및 동기화 청소
        router.refresh(); 

        // 대시보드로 안전하게 격리 이동
        router.push('/');
      } else {
        setErrorMessage(data.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('로그인 파이프라인 에러:', err);
      setErrorMessage('서버 커넥션이 불안정합니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-center items-center px-4 max-w-md mx-auto shadow-2xl font-sans select-none">
      <div className="w-full bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
        <div className="text-center space-y-1">
          <span className="text-3xl">🦚</span>
          <h2 className="text-base font-black tracking-wider text-white">피콕 관제 시스템 로그인</h2>
          <p className="text-[11px] text-slate-500">계정 인증 및 실시간 레이더 동기화</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* 이메일 입력 컴포넌트 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">User Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-3 text-xs font-mono text-slate-200 outline-none transition-all placeholder:text-slate-600"
              disabled={isLoading}
            />
          </div>

          {/* 패스워드 입력 컴포넌트 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-3 text-xs text-slate-200 outline-none transition-all placeholder:text-slate-600 font-mono"
              disabled={isLoading}
            />
          </div>

          {errorMessage && (
            <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl text-[11px] text-rose-400 font-bold animate-in fade-in duration-200">
              ⚠️ {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-600 py-3.5 rounded-xl text-xs font-bold active:scale-98 transition-all shadow-md flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? '⏳' : '🔑'}</span>
            <span>{isLoading ? '관제 레이더 동기화 중...' : '시스템 접속 및 실시간 동기화'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}