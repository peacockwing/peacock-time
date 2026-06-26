// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// ⚠️ 중요: 프로젝트에서 사용 중인 Supabase 클라이언트 가져오기 경로를 확인하세요.
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '../lib/supabase';

// 인터페이스 정의
interface BabyLog { id: number; category_name_han: string; event_value: string; event_date: string; event_time: string; display_emoji: string; actor_email: string; }
interface ChecklistItem { id: number; period_type: string; task_name: string; tips: string; is_completed: number; }
interface InventoryItem { id: number; section_name: string; item_name: string; brand_name: string; target_cnt: number; status: string; memo: string; }

export default function DashboardPage() {
  const router = useRouter();
  // const supabase = createClient();
  
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('parent@example.com');
  
  // 🚀 내비게이션 제어
  const [activeMenu, setActiveMenu] = useState<'timeline' | 'checklist' | 'inventory'>('timeline');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 데이터 상태
  const [logs, setLogs] = useState<BabyLog[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // 입력 폼
  const [selectedPreset, setSelectedPreset] = useState('FEED_MILK');
  const [eventValue, setEventValue] = useState('');
  const [loading, setLoading] = useState(false);

  const presets: Record<string, { name: string; emoji: string; placeholder: string }> = {
    FEED_MILK: { name: '분유수유', emoji: '🍼', placeholder: '예: 120ml' },
    FEED_BREAST: { name: '모유수유', emoji: '🤱', placeholder: '예: 15분' },
    SLEEP_START: { name: '수면 시작', emoji: '💤', placeholder: '예: 밤잠 시작' },
    SLEEP_END: { name: '수면 종료', emoji: '☀️', placeholder: '예: 2시간 취침' },
    POOP: { name: '배변(대변)', emoji: '💩', placeholder: '예: 정상/묽음' },
    PEE: { name: '배변(소변)', emoji: '💦', placeholder: '예: 정상' },
    TEMP: { name: '체온측정', emoji: '🌡️', placeholder: '예: 36.5도' },
  };

  // 기존 데이터 조회 API 함수들
  const fetchLogs = async (code: string) => {
    const res = await fetch(`/api/baby-log?familyCode=${code}`);
    const data = await res.json();
    if (data.success) setLogs(data.logs);
  };

  const fetchOtherTabs = async (code: string, tabName: string, setter: Function) => {
    const res = await fetch(`/api/tabs?familyCode=${code}&targetTab=${tabName}`);
    const data = await res.json();
    if (data.success) setter(data.data);
  };

  const loadMenuData = (code: string, menu: string) => {
    if (menu === 'timeline') fetchLogs(code);
    if (menu === 'checklist') fetchOtherTabs(code, 'checklist', setChecklist);
    if (menu === 'inventory') fetchOtherTabs(code, 'inventory', setInventory);
  };

  // 1. 유저 인증 체크 및 기저 데이터 전체 선행 로드
  useEffect(() => {
    const code = localStorage.getItem('familyCode');
    const email = localStorage.getItem('userEmail') || 'parent@example.com';
    
    if (!code) { 
      router.push('/login'); 
    } else { 
      setFamilyCode(code); 
      setUserEmail(email); 
      
      // 화면 전환 지연 현상을 방지하기 위해 진입 시 세 탭의 데이터를 미리 긁어옵니다.
      fetchLogs(code);
      fetchOtherTabs(code, 'checklist', setChecklist);
      fetchOtherTabs(code, 'inventory', setInventory);
    }
  }, [router]);

  // 메뉴 탭 스위칭 최적화 핸들러
  useEffect(() => {
    if (familyCode) {
      loadMenuData(familyCode, activeMenu);
    }
  }, [activeMenu, familyCode]);

  // 🌟 2. [핵심 엔진] 단말기 간 상호작용 실시간 동기화 리스너 파이프라인 심기
  useEffect(() => {
    if (!familyCode) return;

    // 대시보드 전 전용 리얼타임 웹소켓 채널 구독 개설
    const globalChannel = supabase
      .channel('peacock-space-channel')
      
      // A. 타임라인(baby_log) 실시간 관측 스트림
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baby_log' }, (payload) => {
        console.log('📡 [타임라인] 실시간 트래픽 포착:', payload);
        if (payload.eventType === 'INSERT') {
          setLogs((prev) => [payload.new as BabyLog, ...prev]);
        }
        if (payload.eventType === 'UPDATE') {
          setLogs((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as BabyLog) : item)));
        }
        if (payload.eventType === 'DELETE') {
          setLogs((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      })
      
      // B. 미션 체크리스트(checklist) 실시간 관측 스트림
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist' }, (payload) => {
        console.log('📡 [체크리스트] 실시간 트래픽 포착:', payload);
        if (payload.eventType === 'UPDATE') {
          setChecklist((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as ChecklistItem) : item)));
        }
        if (payload.eventType === 'INSERT') {
          setChecklist((prev) => [...prev, payload.new as ChecklistItem]);
        }
      })
      
      // C. 출산 인벤토리(inventory) 실시간 관측 스트림
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        console.log('📡 [인벤토리] 실시간 트래픽 포착:', payload);
        if (payload.eventType === 'UPDATE') {
          setInventory((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as InventoryItem) : item)));
        }
      })
      .subscribe();

    // 언마운트 시 소켓 포트 깔끔하게 청소 (리소스 확보)
    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [supabase, familyCode]);

  // 데이터 CUD 비동기 핸들러들
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode || !eventValue) return;
    setLoading(true);
    const res = await fetch('/api/baby-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode, categoryCode: selectedPreset, categoryNameHan: presets[selectedPreset].name, eventValue, displayEmoji: presets[selectedPreset].emoji, actorEmail: userEmail }),
    });
    if (res.ok) { 
      setEventValue(''); 
      // 💡 내 단말기에서 보낸 트래픽도 리얼타임 채널이 INSERT 이벤트를 물어와서 화면에 꽂아주므로 fetchLogs 중복 생략 가능
    }
    setLoading(false);
  };

  const handleChecklistToggle = async (id: number, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    // UI 낙관적 업데이트(UX 고도화): 서버 응답 전에 내 화면 먼저 튕겨주기
    setChecklist((prev) => prev.map((item) => item.id === id ? { ...item, is_completed: nextStatus } : item));
    
    await fetch('/api/tabs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTab: 'checklist', id, isCompleted: nextStatus }) });
  };

  const handleInventoryStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'READY' ? 'BOUGHT' : currentStatus === 'BOUGHT' ? 'GIFT' : 'READY';
    // UI 낙관적 업데이트(UX 고도화)
    setInventory((prev) => prev.map((item) => item.id === id ? { ...item, status: nextStatus } : item));
    
    await fetch('/api/tabs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTab: 'inventory', id, status: nextStatus }) });
  };

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  if (!familyCode) return <div className="text-center p-20 text-slate-500 font-mono">INITIALIZING COMMAND CENTER...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-orange-500/30">
      
      {/* 🚀 1. 상단 글로벌 관제 헤더 */}
      <header className="h-16 border-b border-slate-900 bg-[#020617]/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="group p-2 hover:bg-slate-900 rounded-xl transition-all active:scale-95"
          >
            <div className="w-6 h-0.5 bg-orange-500 mb-1.5 group-hover:w-8 transition-all"></div>
            <div className="w-8 h-0.5 bg-orange-500 mb-1.5"></div>
            <div className="w-5 h-0.5 bg-orange-500 group-hover:w-8 transition-all"></div>
          </button>
          <h1 className="text-xl font-black tracking-tighter text-white">
            PEACOCK <span className="text-orange-500">TIME</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Operator</span>
            <span className="text-xs text-slate-300 font-medium">{userEmail.split('@')[0]}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 p-[1px]">
             <div className="w-full h-full bg-[#020617] rounded-2xl flex items-center justify-center text-orange-500 font-black">
                {userEmail[0].toUpperCase()}
             </div>
          </div>
        </div>
      </header>

      {/* 🚀 2. 사이드바 */}
      <div 
        className={`fixed inset-0 z-50 transition-all duration-500 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>
        <aside className={`absolute left-0 top-0 h-full w-80 bg-[#020617] border-r border-slate-900 p-8 shadow-2xl transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex justify-between items-center mb-12">
            <span className="text-xs font-black text-slate-600 tracking-[0.2em] uppercase">Control Panel</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white transition-colors text-2xl">✕</button>
          </div>

          <nav className="space-y-3">
            <button 
              onClick={() => { setActiveMenu('timeline'); setIsSidebarOpen(false); }}
              className={`w-full group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeMenu === 'timeline' ? 'bg-orange-500 text-[#020617] shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}
            >
              <span className="text-xl">🍼</span>
              <span className="font-bold tracking-tight text-base">실시간 타임라인</span>
              {activeMenu === 'timeline' && <span className="ml-auto animate-pulse">●</span>}
            </button>
            <button 
              onClick={() => { setActiveMenu('checklist'); setIsSidebarOpen(false); }}
              className={`w-full group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeMenu === 'checklist' ? 'bg-orange-500 text-[#020617] shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}
            >
              <span className="text-xl">👨‍💻</span>
              <span className="font-bold tracking-tight text-base">아빠 필수 미션</span>
            </button>
            <button 
              onClick={() => { setActiveMenu('inventory'); setIsSidebarOpen(false); }}
              className={`w-full group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeMenu === 'inventory' ? 'bg-orange-500 text-[#020617] shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}
            >
              <span className="text-xl">📦</span>
              <span className="font-bold tracking-tight text-base">출산 준비 인벤토리</span>
            </button>
          </nav>

          <div className="absolute bottom-8 left-8 right-8 pt-6 border-t border-slate-900">
            <div className="bg-slate-900/50 p-4 rounded-2xl mb-6">
               <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Family Cloud Code</p>
               <p className="text-sm font-mono text-orange-400 font-bold">{familyCode}</p>
            </div>
            <button onClick={handleLogout} className="w-full text-center py-3 text-xs text-slate-600 font-bold hover:text-red-400 transition-colors">
              TERMINATE SESSION
            </button>
          </div>
        </aside>
      </div>

      {/* 🚀 3. 메인 관제 콘텐츠 */}
      <main className="flex-grow p-5 md:p-10 max-w-6xl mx-auto w-full">
        
        {/* Baby Log (기본 페이지) */}
        {activeMenu === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 왼쪽: 입력 폼 */}
            <div className="lg:col-span-4">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-[32px] p-8 sticky top-24 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                  <h2 className="text-xl font-black text-white">Quick Log</h2>
                </div>
                <form onSubmit={handleLogSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Category</label>
                    <select value={selectedPreset} onChange={(e) => { setSelectedPreset(e.target.value); setEventValue(''); }} className="w-full bg-[#020617] border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-orange-500 outline-none appearance-none transition-all cursor-pointer">
                      {Object.keys(presets).map((key) => <option key={key} value={key}>{presets[key].emoji} {presets[key].name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Measurement</label>
                    <input type="text" value={eventValue} onChange={(e) => setEventValue(e.target.value)} placeholder={presets[selectedPreset].placeholder} className="w-full bg-[#020617] border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:border-orange-500 outline-none transition-all placeholder:text-slate-700" required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-orange-500 text-[#020617] font-black py-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-orange-500/10">
                    {loading ? 'UPLOADING...' : 'SEND TO CLOUD 🦚'}
                  </button>
                </form>
              </div>
            </div>

            {/* 오른쪽: 타임라인 피드 */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex justify-between items-end px-2">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Live Feed</h2>
                <span className="text-[10px] text-orange-500/60 font-bold animate-pulse">● STREAMING ACTIVE</span>
              </div>
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-[32px] py-32 text-center">
                    <p className="text-slate-600 font-bold">No synchronization data available.</p>
                  </div>
                ) : logs.map((log) => (
                  <div key={log.id} className="group bg-slate-900/30 border border-slate-900 rounded-[28px] p-5 flex justify-between items-center hover:bg-slate-900/50 hover:border-orange-500/20 transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className="text-3xl bg-[#020617] w-16 h-16 rounded-[22px] flex items-center justify-center border border-slate-800 group-hover:border-orange-500/40 transition-colors shadow-inner">
                        {log.display_emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white tracking-tight">{log.category_name_han}</span>
                          <span className="text-[11px] bg-orange-500/10 text-orange-500 px-3 py-0.5 rounded-full font-black tracking-tighter">
                            {log.event_value}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                           <span className="text-[10px] text-slate-600 font-bold">{log.event_date.slice(0,4)}·{log.event_date.slice(4,6)}·{log.event_date.slice(6,8)}</span>
                           <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-medium">by {log.actor_email.split('@')[0]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-sm font-black text-slate-400 font-mono tracking-tighter">{log.event_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 📋 탭 전환 로직: 아빠 필수 미션 */}
        {activeMenu === 'checklist' && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[40px] p-10 animate-in zoom-in-95 duration-500 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-10 flex items-center gap-4">
              <span className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-2xl">🛡️</span>
              아빠 출산 복귀 미션 가이드
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {checklist.map((item) => (
                <div key={item.id} className="bg-[#020617]/60 border border-slate-800 rounded-[28px] p-6 flex justify-between items-start group hover:border-emerald-500/30 transition-all">
                  <div className="space-y-3">
                    <span className="inline-block bg-amber-500/10 text-amber-500 text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase">{item.period_type}</span>
                    <h3 className={`text-lg font-bold tracking-tight ${item.is_completed === 1 ? 'line-through text-slate-700' : 'text-slate-100'}`}>{item.task_name}</h3>
                    {item.tips && <p className="text-xs text-slate-500 font-medium leading-relaxed">💡 TIP: {item.tips}</p>}
                  </div>
                  <button onClick={() => handleChecklistToggle(item.id, item.is_completed)} className={`mt-1 p-3 rounded-2xl transition-all ${item.is_completed === 1 ? 'bg-emerald-500 text-[#020617]' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                    <span className="font-black text-xs">{item.is_completed === 1 ? 'DONE' : 'CHECK'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 📦 탭 전환 로직: 출산 준비 인벤토리 */}
        {activeMenu === 'inventory' && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[40px] p-10 animate-in zoom-in-95 duration-500 shadow-2xl overflow-hidden">
            <h2 className="text-2xl font-black text-white mb-10 flex items-center gap-4">
              <span className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-2xl">📦</span>
              출산 준비 인벤토리
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] border-b border-slate-800">
                  <tr><th className="pb-6 px-4">Section</th><th className="pb-6">Item Detail</th><th className="pb-6 text-center">Qty</th><th className="pb-6 text-right px-4">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {inventory.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-800/20 transition-colors">
                      <td className="py-6 px-4 font-black text-xs text-orange-500/80 uppercase">{item.section_name}</td>
                      <td className="py-6">
                        <p className="text-slate-100 font-bold text-base tracking-tight">{item.item_name}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-1">{item.brand_name} {item.memo && `· ${item.memo}`}</p>
                      </td>
                      <td className="py-6 text-center font-mono font-bold text-slate-400">{item.target_cnt}</td>
                      <td className="py-6 text-right px-4">
                        <button onClick={() => handleInventoryStatus(item.id, item.status)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${item.status === 'BOUGHT' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'GIFT' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-800 text-slate-600'}`}>
                          {item.status || 'READY'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 🚀 커스텀 스크롤바 & 애니메이션 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  );
}