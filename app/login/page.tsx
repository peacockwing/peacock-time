// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// ⚠️ 중요: 프로젝트에서 사용 중인 Supabase 클라이언트 가져오기 경로를 확인하세요.
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; 

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetFamilyCode, setTargetFamilyCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 🌟 [실시간 관측 훅] 이메일 인증 완료 시 자동 로그인 처리
  useEffect(() => {
    // Supabase 인증 상태 변화를 실시간으로 감시하는 리스너 등록
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // 사용자가 메일 링크를 클릭하여 'SIGNED_IN' 상태가 되었을 때 작동
      if (event === 'SIGNED_IN' && session?.user) {
        
        // 사용자의 메타데이터나 프로필 테이블에서 가족 코드를 획득합니다.
        let familyCode = session.user.user_metadata?.family_code;

        // 만약 메타데이터에 없다면 DB 테이블(user_profiles)에서 한 번 더 크로스 체크
        if (!familyCode) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('family_code')
            .eq('id', session.user.id)
            .single();
          familyCode = profile?.family_code;
        }

        const userEmail = session.user.email || '';
        const finalFamilyCode = familyCode || 'FAM-DEFAULT';

        // 세션 정보를 로컬 스토리지에 세팅 (기존 관제탑 아키텍처 동기화)
        localStorage.setItem('familyCode', finalFamilyCode);
        localStorage.setItem('userEmail', userEmail);

        // 띵동! 소리 없이 자동으로 메인 대시보드로 진격합니다.
        alert('이메일 인증 완료가 실시간 감지되었습니다! 관제탑으로 자동 입장합니다. 🦚');
        router.push('/');
      }
    });

    // 컴포넌트가 언마운트될 때 리스너를 깔끔하게 해제(Memory Leak 방지)
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
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
        setSuccessMessage('보안 메일 인증 링크가 발송되었습니다! 이 창을 켜둔 채로 메일함에서 링크를 클릭하시면 화면이 자동으로 전환됩니다. 🦚');
      } else {
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
        
        {/* 시그니처 상용 브랜딩 타이틀 */}
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