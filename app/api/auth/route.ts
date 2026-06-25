// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';

// 6자리 고유 가족 코드 생성
function generateFamilyCode(): string {
  return `FAM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const { email, password, targetFamilyCode, isSignUp } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    if (isSignUp) {
      // ■ [1] 회원가입: Supabase Auth 인증 인프라에 계정 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
      
      const userId = authData.user?.id;
      if (!userId) return NextResponse.json({ error: '유저 서비스 생성 실패' }, { status: 500 });

      // 가족 코드 결정: 입력한 게 있다면 연동, 없다면 새로 발급
      const finalFamilyCode = targetFamilyCode?.trim() || generateFamilyCode();

      // ■ [2] DB 적재: PostgreSQL의 user_profiles 테이블에 비즈니스 데이터 insert
      const { error: dbError } = await supabase
        .from('user_profiles')
        .insert([{ id: userId, email, family_code: finalFamilyCode }]);

      if (dbError) {
        return NextResponse.json({ error: '프로필 저장 실패: ' + dbError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '회원가입 및 가족 관제망 매핑 성공',
        user: { id: userId, email, familyCode: finalFamilyCode }
      });

    } else {
      // ■ [3] 로그인: Supabase Auth 인증
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });

      const userId = authData.user?.id;

      // ■ [4] DB 조회: 로그인 성공한 유저가 어떤 가족 코드에 속해있는지 PostgreSQL에서 Select
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('family_code')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: '가족 프로필을 찾을 수 없습니다.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: '관제탑 입장 성공',
        user: { id: userId, email: authData.user?.email, familyCode: profile.family_code }
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: '서버 내부 에러: ' + error.message }, { status: 500 });
  }
}