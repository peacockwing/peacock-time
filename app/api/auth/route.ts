// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    const targetFamilyCode = typeof body.targetFamilyCode === 'string' ? body.targetFamilyCode.trim().toUpperCase() : '';
    const isSignUp = Boolean(body.isSignUp);

    if (!email || !password) {
      return NextResponse.json({ success: false, error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 🚀 CASE 1: 회원가입 (Sign Up)
    // -------------------------------------------------------------
    if (isSignUp) {
      let finalFamilyCode = targetFamilyCode || '';
      if (!finalFamilyCode) {
        const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
        finalFamilyCode = `FAM-${randomHex}`;
      }

      if (!/^[A-Z0-9_-]{3,20}$/.test(finalFamilyCode)) {
        return NextResponse.json({ success: false, error: '유효한 가족 코드를 입력해 주세요.' }, { status: 400 });
      }

      const targetRedirectTo = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://peacock-time.vercel.app';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: targetRedirectTo,
          data: {
            family_code: finalFamilyCode,
          },
        },
      });

      if (authError) throw authError;

      // 로그인 화면과 스펙을 맞춰 success: true 및 familyCode 매핑 리턴
      return NextResponse.json({
        success: true,
        familyCode: finalFamilyCode,
        family_code: finalFamilyCode,
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
    const { data: profileData, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('family_code, user_name')
      .eq('id', signInData.user?.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile Fetch Error:', profileError);
    }

    const fetchedFamilyCode = profileData?.family_code || 'FAM-DEFAULT';
    const fetchedUserName = profileData?.user_name || signInData.user?.email?.split('@')[0] || '보호자';

    // [핵심 조치] 프론트엔드 최상단과 데이터 바인딩 규격 일치화
    return NextResponse.json({
      success: true,
      familyCode: fetchedFamilyCode,
      family_code: fetchedFamilyCode, // 2중 예방 레이어
      userName: fetchedUserName,
      user_name: fetchedUserName,
      user: {
        id: signInData.user?.id,
        email: signInData.user?.email,
        familyCode: fetchedFamilyCode,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 /api/auth Error:', error.message);
    
    if (error.message.includes('Email not confirmed')) {
      return NextResponse.json({ 
        success: false,
        error: '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요! 🦚' 
      }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}