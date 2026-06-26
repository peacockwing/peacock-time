// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // ⚠️ 중요: 본인의 프로젝트 구조에 맞는 supabase client 경로인지 꼭 확인하세요!

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, targetFamilyCode, isSignUp } = body;

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 🚀 CASE 1: 회원가입 (Sign Up)
    // -------------------------------------------------------------
    if (isSignUp) {
      // 1. 가족 코드 정의 (입력한 코드가 없으면 고유 코드 신규 생성)
      let finalFamilyCode = targetFamilyCode?.trim().toUpperCase();
      
      if (!finalFamilyCode) {
        const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
        finalFamilyCode = `FAM-${randomHex}`; // 예: FAM-A3B94C
      }

      // 🌟 2. 인프라 환경 변수 분기 처리 (여기가 핵심!)
      // 개발 모드면 로컬 호스트로, 실서버 배포 모드면 render.com 도메인으로 자동 지정
      const targetRedirectTo = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://peacock-time.vercel.app';

      // 3. Supabase Auth 회원가입 진행
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          redirectTo: targetRedirectTo, // 분기 처리된 주소 주입
          data: {
            family_code: finalFamilyCode, // 데이터베이스 트리거 연동용 메타데이터
          },
        },
      });

      if (authError) throw authError;

      return NextResponse.json({
        success: true,
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          familyCode: finalFamilyCode,
        },
      }, { status: 200 });
    }

    // -------------------------------------------------------------
    // 🔒 CASE 2: 로그인 (Sign In)
    // -------------------------------------------------------------
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;

    // 로그인이 성공하면 user_profiles 테이블에서 유저의 가족 코드를 가져옵니다.
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('family_code')
      .eq('id', signInData.user?.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile Fetch Error:', profileError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: signInData.user?.id,
        email: signInData.user?.email,
        familyCode: profileData?.family_code || 'FAM-DEFAULT',
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 /api/auth Error:', error.message);
    
    // 이메일 미인증 상태일 때 예외 처리
    if (error.message.includes('Email not confirmed')) {
      return NextResponse.json({ 
        error: '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요! 🦚' 
      }, { status: 401 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}