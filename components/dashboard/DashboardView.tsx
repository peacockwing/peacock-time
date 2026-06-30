'use client';

import { useDashboard } from '../../hooks/useDashboard';

export default function DashboardView() {
  const {
    familyCode,
    userEmail,
    userName,
    activeMenu,
    isMenuOpen,
    modalType,
    isRecording,
    recordingStatusText,
    cryAnalysisResult,
    logs,
    checklist,
    inventory,
    lastFeedText,
    lastPoopText,
    isSleeping,
    sleepTimerText,
    sleepTimerTitle,
    inventorySections,
    invProgressPct,
    totalInv,
    completedInv,
    checklistPeriods,
    checkProgressPct,
    completedCheck,
    totalCheck,
    setActiveMenu,
    setIsMenuOpen,
    setModalType,
    submitQuickEvent,
    handleDeleteLog,
    handleToggleSleep,
    handleChecklistToggle,
    handleInventoryStatus,
    startCryAnalysis,
    handleLogout,
  } = useDashboard();

  if (!familyCode || familyCode === 'undefined' || familyCode === 'null') {
    return <div className="text-center p-20 text-slate-500 font-mono text-xs">INITIALIZING COMMAND CENTER...</div>;
  }

  return (
    <div className="bg-slate-900 text-slate-100 font-sans antialiased max-w-md mx-auto min-h-screen shadow-2xl flex flex-col select-none relative overflow-x-hidden">
      <header className="bg-slate-950 h-14 px-4 flex justify-between items-center border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none" aria-label="메뉴 열기">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <h1 className="text-sm font-black tracking-wider text-slate-100">
          {activeMenu === 'baby-log' && '👶 육아 레이더'}
          {activeMenu === 'prep-list' && '🎁 출산 인벤토리'}
          {activeMenu === 'after-delivery' && '🚨 아빠 필수 미션'}
        </h1>
        <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">🦚</div>
      </header>

      {isMenuOpen && (
        <div onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 max-w-md mx-auto" />
      )}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-slate-950 z-50 transition-transform duration-300 ease-in-out border-r border-slate-800 flex flex-col justify-between ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="p-5 border-b border-slate-900 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <span className="text-lg font-black text-white">🦚 관제 메뉴</span>
              <button onClick={() => setIsMenuOpen(false)} className="text-slate-500 hover:text-white p-1 text-xs">닫기 ✕</button>
            </div>
            <div className="mt-4 space-y-0.5">
              <p className="text-xs font-bold text-slate-200">👑 {userName}님</p>
              <p className="text-[10px] text-slate-400 font-mono">가족코드: <span className="text-amber-400 font-bold">{familyCode}</span></p>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <button onClick={() => { setActiveMenu('baby-log'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3.5 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${activeMenu === 'baby-log' ? 'bg-indigo-950 text-indigo-300 font-black' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>👶</span> <span>육아 레이더 (타임라인)</span>
            </button>
            <button onClick={() => { setActiveMenu('prep-list'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3.5 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${activeMenu === 'prep-list' ? 'bg-indigo-950 text-indigo-300 font-black' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>🎁</span> <span>출산 인벤토리 (체크리스트)</span>
            </button>
            <button onClick={() => { setActiveMenu('after-delivery'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-3.5 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${activeMenu === 'after-delivery' ? 'bg-indigo-950 text-indigo-300 font-black' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>🚨</span> <span>아빠 필수 미션 (출산 후)</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-900 bg-slate-900/20">
          <button onClick={handleLogout} className="w-full bg-slate-900 hover:bg-rose-950/40 hover:text-rose-400 py-2.5 rounded-xl text-[11px] text-slate-500 font-bold transition-all text-center">
            안전하게 로그아웃 🔓
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {activeMenu === 'baby-log' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center space-x-2 text-[11px] font-bold overflow-x-auto pb-1">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50 text-indigo-300 whitespace-nowrap">{lastFeedText}</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50 text-emerald-300 whitespace-nowrap">{lastPoopText}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 border border-slate-700/60 p-4 rounded-2xl flex flex-col items-center space-y-1 w-full">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">{sleepTimerTitle}</span>
                <span className="text-base font-black text-white font-mono tracking-tight">{sleepTimerText}</span>
              </div>
              <button onClick={handleToggleSleep} className={`p-4 rounded-2xl flex flex-col items-center space-y-1 w-full transition-all ${isSleeping ? 'bg-indigo-950 border border-indigo-500' : 'bg-slate-800 border border-slate-700/60'}`}>
                <span className="text-xl">{isSleeping ? '☀️' : '😴'}</span>
                <span className="text-xs font-bold text-slate-200">{isSleeping ? '아기 깨어남' : '아기 잠듦'}</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setModalType('FEED')} className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform">
                <span className="text-lg">🍼</span><span className="text-[10px] font-bold text-slate-300">분유수유</span>
              </button>
              <button onClick={() => submitQuickEvent('FEED', '수유', '모유수유 진행', '🤱')} className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform">
                <span className="text-lg">🤱</span><span className="text-[10px] font-bold text-slate-300">모유수유</span>
              </button>
              <button onClick={() => submitQuickEvent('POOP_PEE', '배변', '정상 대변 💩', '💩')} className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform">
                <span className="text-lg">💩</span><span className="text-[10px] font-bold text-slate-300">대변기록</span>
              </button>
              <button onClick={() => setModalType('TEMP')} className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform">
                <span className="text-lg">🌡️</span><span className="text-[10px] font-bold text-slate-300">체온측정</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-inner">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase flex items-center space-x-1.5">
                  <span>🎙️</span> <span>AI 실시간 울음 주파수 분석기</span>
                </h3>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${isRecording ? 'bg-rose-600 animate-pulse text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {recordingStatusText}
                </span>
              </div>
              <button onClick={startCryAnalysis} disabled={isRecording} className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-3 rounded-xl text-xs font-bold active:scale-98 transition-all hover:bg-slate-750 flex items-center justify-center space-x-2">
                <span>{isRecording ? '⏳' : '🎵'}</span>
                <span>{isRecording ? '소리 주파수 정밀 포착 중... (5초)' : '울음소리 분석 기동 (5초 스마트 청취)'}</span>
              </button>

              {cryAnalysisResult && (
                <div className="bg-indigo-950/40 border border-indigo-500/30 p-3 rounded-xl flex items-center space-x-3 animate-in slide-in-from-top-2 duration-300">
                  <span className="text-2xl">{cryAnalysisResult.emoji}</span>
                  <div className="flex-1">
                    <p className="text-xs font-black text-indigo-300">{cryAnalysisResult.prediction}</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">평균: {cryAnalysisResult.avg_frequency}Hz | 볼륨: {cryAnalysisResult.max_decibel}pt</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-500 tracking-widest uppercase px-1">Live Monitor Feed</h3>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-10">기록이 비어있습니다.</p>
                ) : (
                  logs.map((item) => (
                    <div key={item.id} className="bg-slate-800/60 border border-slate-800/80 p-3.5 rounded-2xl flex justify-between items-center shadow-sm">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl bg-slate-950/60 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-800">{item.display_emoji}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-200">
                            {item.category_name_han} - <span className="text-indigo-400 font-mono">{item.event_value}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {item.event_date.substring(4, 6)}/{item.event_date.substring(6, 8)} {item.event_time} · <span className="text-slate-600">{item.actor_email.split('@')[0]}</span>
                          </p>
                        </div>
                      </div>
                      <button className="text-[10px] text-slate-600 hover:text-rose-400 font-bold px-2 py-1" onClick={() => handleDeleteLog(item.id)}>삭제 ✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'prep-list' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-inner">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">🎁 준비물 패킹 진척도</span>
                <span className="text-indigo-400 font-mono">{invProgressPct}% ({completedInv}/{totalInv} 완료)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${invProgressPct}%` }} />
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(inventorySections).length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">품목 데이터가 비어 있습니다.</p>
              ) : (
                Object.entries(inventorySections).map(([sectionName, items]) => (
                  <div key={sectionName} className="space-y-2">
                    <h3 className="text-xs font-black text-indigo-400 tracking-wider px-1 uppercase mb-1">🏷️ {sectionName}</h3>
                    <div className="space-y-2">
                      {items.map((item) => {
                        let statusBtnClass = 'bg-slate-700 text-slate-300';
                        let statusText = '⏳ 준비필요';
                        if (item.status === 'BOUGHT') {
                          statusBtnClass = 'bg-indigo-600 text-white font-bold';
                          statusText = '🍼 구매완료';
                        } else if (item.status === 'GIFT') {
                          statusBtnClass = 'bg-emerald-600 text-white font-bold';
                          statusText = '🎁 중고/선물';
                        }
                        return (
                          <div key={item.id} className="bg-slate-800/90 border border-slate-700/50 p-3.5 rounded-xl flex justify-between items-center shadow-md">
                            <div className="space-y-0.5 flex-1 pr-2">
                              <h4 className="text-xs font-black text-white">
                                {item.item_name} <span className="text-[10px] text-slate-400 font-normal">({item.brand_name || '미정'}) · {item.target_cnt}개</span>
                              </h4>
                              <p className="text-[10px] text-amber-400 font-mono">🎯 목표핫딜가: {item.hotdeal_price ? `${item.hotdeal_price.toLocaleString()}원` : '정보없음'}</p>
                              {item.memo && <p className="text-[10px] text-slate-500 italic leading-tight">{item.memo}</p>}
                            </div>
                            <button type="button" onClick={() => handleInventoryStatus(item.id, item.status)} className={`${statusBtnClass} text-[10px] px-3 py-2 rounded-lg min-w-[75px] text-center font-bold shadow-sm active:scale-95 transition-transform`}>
                              {statusText}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeMenu === 'after-delivery' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-inner">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">🚨 아빠 전용 미션 클리어 비율</span>
                <span className="text-amber-400 font-mono">{checkProgressPct}% ({completedCheck}/{totalCheck} 해결)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${checkProgressPct}%` }} />
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(checklistPeriods).length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">미션 데이터가 비어 있습니다.</p>
              ) : (
                Object.entries(checklistPeriods).map(([period, tasks]) => (
                  <div key={period} className="space-y-2">
                    <h3 className="text-xs font-black text-amber-400 tracking-wider px-1 flex items-center space-x-2">
                      <span>📅</span> <span>시기: {period}</span>
                    </h3>
                    <div className="space-y-2">
                      {tasks.map((t) => {
                        const isDone = t.is_completed === 1;
                        return (
                          <div key={t.id} className={`bg-slate-800/90 border ${isDone ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-slate-700/50'} p-3.5 rounded-xl flex justify-between items-start shadow-md`}>
                            <div className="space-y-1 pr-2 flex-1">
                              <h4 className="text-xs font-black transition-colors" style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#ffffff' }}>
                                {t.task_name}
                              </h4>
                              <p className="text-[10px] text-slate-400 leading-tight bg-slate-950/40 p-2 rounded-lg font-sans">{t.tips || '정보 없음'}</p>
                            </div>
                            <button type="button" onClick={() => handleChecklistToggle(t.id, t.is_completed)} className={`text-[10px] px-2.5 py-1.5 rounded-md min-w-[65px] text-center font-bold shadow-sm active:scale-95 transition-transform ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                              {isDone ? '✅ 완료' : '⏳ 미완료'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center max-w-md mx-auto" onClick={() => setModalType(null)}>
          <div className="bg-slate-800 w-full p-6 rounded-t-3xl border-t border-slate-700 space-y-4 animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">
                {modalType === 'FEED' ? '🍼 분유 수유량 선택' : '🌡️ 아기 체온 선택'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 text-xs p-1">닫기 ❌</button>
            </div>
            <div className="py-1">
              {modalType === 'FEED' ? (
                <div className="grid grid-cols-4 gap-2">
                  {[60, 80, 100, 120, 140, 160, 180, 200].map((ml) => (
                    <button key={ml} onClick={() => { submitQuickEvent('FEED', '수유', `${ml}ml`, '🍼'); setModalType(null); }} className="bg-slate-900 border border-slate-700 hover:border-indigo-500 py-3 rounded-xl text-xs font-mono font-bold active:scale-95 transition-transform">
                      {ml}ml
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[36.2, 36.5, 36.8, 37.1, 37.3, 37.5, 37.8, 38.2].map((temp) => (
                    <button key={temp} onClick={() => { submitQuickEvent('TEMP', '체온', `${temp}도`, '🌡️'); setModalType(null); }} className={`bg-slate-900 border py-3 rounded-xl text-xs font-mono font-bold active:scale-95 transition-transform ${temp >= 37.5 ? 'border-amber-600 text-amber-400 hover:border-rose-500' : 'border-slate-700 hover:border-indigo-500'}`}>
                      {temp}℃
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; }
      `}</style>
    </div>
  );
}
