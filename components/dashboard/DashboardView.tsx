'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboard } from '../../hooks/useDashboard';
import type { BabyLog } from '../../types/baby';
import VoiceControl from '../voice/VoiceControl';

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
    handleUpdateLog,
    handleToggleSleep,
    handleChecklistToggle,
    handleInventoryStatus,
    startCryAnalysis,
    handleLogout,
  } = useDashboard();

  // UI state for filtering
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState<string | null>(null); // YYYY-MM-DD
  const [dateTo, setDateTo] = React.useState<string | null>(null); // YYYY-MM-DD

  const CATEGORY_OPTIONS: { code: string; label: string }[] = [
    { code: 'FEED', label: '수유/분유' },
    { code: 'POOP_PEE', label: '배변' },
    { code: 'TEMP', label: '체온' },
    { code: 'SLEEP', label: '수면' },
  ];

  const toggleCategory = (code: string) => {
    setSelectedCategories((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setDateFrom(null);
    setDateTo(null);
  };

  const [editingLog, setEditingLog] = React.useState<BabyLog | null>(null);
  const [editEventValue, setEditEventValue] = React.useState('');
  const [editEventTime, setEditEventTime] = React.useState('');
  const [editDisplayEmoji, setEditDisplayEmoji] = React.useState('');

  const getDefaultEmojiForCategory = (categoryCode: string) => {
    switch (categoryCode) {
      case 'FEED':
        return '🍼';
      case 'TEMP':
        return '🌡️';
      case 'POOP_PEE':
        return '💩';
      case 'SLEEP':
        return '😴';
      default:
        return '💙';
    }
  };

  const normalizeEditEventValue = (value: string, categoryCode: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;

    if (categoryCode === 'FEED') {
      const digits = trimmed.match(/\d+/);
      return digits ? `${Number(digits[0])}ml` : trimmed;
    }
    if (categoryCode === 'TEMP') {
      const match = trimmed.match(/(\d+(?:\.\d+)?)/);
      return match ? `${parseFloat(match[1]).toFixed(1)}도` : trimmed;
    }
    if (categoryCode === 'SLEEP') {
      if (/깨어|깨/.test(trimmed)) return '잠에서 깨어남 ☀️';
      if (/수면|시작/.test(trimmed)) return '수면 시작 💤';
      return trimmed;
    }
    return trimmed;
  };

  const normalizeEditEventTime = (value: string) => {
    const trimmed = value.trim();
    const match = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = String(Number(match[1])).padStart(2, '0');
      const minute = String(Number(match[2])).padStart(2, '0');
      return `${hour}:${minute}`;
    }
    return trimmed;
  };

  const openEditLog = (item: BabyLog) => {
    setEditingLog(item);
    setEditEventValue(item.event_value);
    setEditEventTime(item.event_time);
    setEditDisplayEmoji(item.display_emoji || getDefaultEmojiForCategory(item.category_code));
  };

  const closeEditLog = () => {
    setEditingLog(null);
    setEditEventValue('');
    setEditEventTime('');
    setEditDisplayEmoji('');
  };

  const applyEditLog = async () => {
    if (!editingLog) return;
    const normalizedValue = normalizeEditEventValue(editEventValue, editingLog.category_code);
    const normalizedTime = normalizeEditEventTime(editEventTime);
    const normalizedEmoji = editDisplayEmoji.trim() || getDefaultEmojiForCategory(editingLog.category_code);

    await handleUpdateLog(editingLog.id, {
      eventValue: normalizedValue,
      eventTime: normalizedTime,
      displayEmoji: normalizedEmoji,
    });
    closeEditLog();
  };

  // Preset helpers
  const setPresetToday = () => {
    const d = new Date();
    const iso = d.toISOString().slice(0, 10);
    setDateFrom(iso);
    setDateTo(iso);
  };

  const setPresetThisWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6
    const diffToMon = (day + 6) % 7; // days since Monday
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    const end = new Date(now);
    const isoStart = start.toISOString().slice(0, 10);
    const isoEnd = end.toISOString().slice(0, 10);
    setDateFrom(isoStart);
    setDateTo(isoEnd);
  };

  const setPresetThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(end.toISOString().slice(0, 10));
  };

  const setPresetLast24h = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setDateFrom(past.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  };

  const setPresetLast7Days = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setDateFrom(past.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  };

  // Mobile filter toggle
  const [showFiltersMobile, setShowFiltersMobile] = React.useState(false);
  // Desktop filter panel visibility
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);
  const categoryPillsRef = React.useRef<HTMLDivElement | null>(null);
  const activeFilterCount = selectedCategories.length + (dateFrom || dateTo ? 1 : 0);
  const filterActive = showFilterPanel || activeFilterCount > 0;
  const selectedCategoryLabels = CATEGORY_OPTIONS.filter((opt) => selectedCategories.includes(opt.code)).map((opt) => opt.label).join(' · ');
  const activeFilterSummary = selectedCategoryLabels || (dateFrom || dateTo ? '날짜 필터' : '전체');

  const todayIso = new Date().toISOString().slice(0, 10);
  const getThisWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    return { from: start.toISOString().slice(0, 10), to: todayIso };
  };
  const getThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  };
  const getLast24hRange = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { from: past.toISOString().slice(0, 10), to: todayIso };
  };
  const getLast7DaysRange = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: past.toISOString().slice(0, 10), to: todayIso };
  };
  const isPresetActive = (range: { from: string; to: string }) => dateFrom === range.from && dateTo === range.to;

  React.useEffect(() => {
    if (showFilterPanel && categoryPillsRef.current) {
      const btn = categoryPillsRef.current.querySelector('button');
      if (btn) (btn as HTMLButtonElement).focus();
    }
  }, [showFilterPanel]);

  const toggleFilters = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowFiltersMobile((s) => !s);
    } else {
      setShowFilterPanel((s) => !s);
    }
  };

  // URL sync
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUpdateTimer = React.useRef<number | null>(null);

  // Initialize filters from URL on mount
  React.useEffect(() => {
    try {
      const sp = searchParams;
      if (!sp) return;
      const cats = sp.get('cats');
      const from = sp.get('from');
      const to = sp.get('to');
      if (cats) setSelectedCategories(cats.split(',').filter(Boolean));
      if (from) setDateFrom(from);
      if (to) setDateTo(to);
    } catch (e) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push filter state to URL when changed (debounced)
  React.useEffect(() => {
    try {
      if (urlUpdateTimer.current) {
        window.clearTimeout(urlUpdateTimer.current);
      }
      urlUpdateTimer.current = window.setTimeout(() => {
        const params = new URLSearchParams();
        if (selectedCategories.length > 0) params.set('cats', selectedCategories.join(','));
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        const q = params.toString();
        const path = window.location.pathname + (q ? `?${q}` : '');
        router.replace(path);
      }, 500);
    } catch (e) {
      /* ignore */
    }
    return () => {
      if (urlUpdateTimer.current) {
        window.clearTimeout(urlUpdateTimer.current);
        urlUpdateTimer.current = null;
      }
    };
  }, [selectedCategories, dateFrom, dateTo, router]);

  // Helper: convert event_date 'YYYYMMDD' and event_time 'HH:MM' to a Date for comparisons
  const toIsoDate = (yyyymmdd: string) => {
    if (!yyyymmdd || yyyymmdd.length < 8) return null;
    const y = yyyymmdd.substring(0, 4);
    const m = yyyymmdd.substring(4, 6);
    const d = yyyymmdd.substring(6, 8);
    return `${y}-${m}-${d}`; // YYYY-MM-DD
  };

  // Compute filtered and grouped logs
  const filteredLogs = React.useMemo(() => {
    let out = logs.slice();
    if (selectedCategories.length > 0) {
      out = out.filter((l) => selectedCategories.includes(l.category_code));
    }
    if (dateFrom) {
      out = out.filter((l) => toIsoDate(l.event_date) >= dateFrom);
    }
    if (dateTo) {
      out = out.filter((l) => toIsoDate(l.event_date) <= dateTo);
    }
    // sort by date desc then time desc
    out.sort((a, b) => {
      if (a.event_date !== b.event_date) return b.event_date.localeCompare(a.event_date);
      return (b.event_time || '').localeCompare(a.event_time || '');
    });
    // group by date
    const groups: Record<string, typeof out> = {};
    out.forEach((item) => {
      const key = toIsoDate(item.event_date) || 'unknown';
      if (!groups[key]) groups[key] = [] as any;
      groups[key].push(item);
    });
    return groups;
  }, [logs, selectedCategories, dateFrom, dateTo]);

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

            <div className="pt-3">
              <VoiceControl />
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
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <button aria-label="toggle filters" onClick={toggleFilters} className={`text-[11px] px-3 py-1 rounded-full border transition-all ${filterActive ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}>
                      <span className="mr-1">🔍</span>
                      {activeFilterCount > 0 ? `${activeFilterCount}개` : '필터'}
                    </button>

                    <div className={`${showFilterPanel ? 'flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200' : 'hidden'}`} ref={categoryPillsRef}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <button key={opt.code} onClick={() => toggleCategory(opt.code)} className={`flex items-center text-[11px] px-2 py-1 rounded-full border transition ${selectedCategories.includes(opt.code) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700/50 hover:bg-slate-700'}`}>
                          <span className="mr-2">{opt.label}</span>
                          <span className="text-[11px] opacity-80">📅</span>
                        </button>
                      ))}
                      <button onClick={resetFilters} className="text-[11px] px-2 py-1 rounded-full border bg-slate-700 text-slate-200 hover:bg-slate-600">초기화</button>
                      <button onClick={() => setShowFilterPanel(false)} className="text-[11px] px-2 py-1 rounded-full border bg-indigo-600 text-white ml-2 hover:bg-indigo-500">적용</button>
                    </div>

                    <div className="hidden md:flex items-center gap-2 ml-2 bg-slate-900/40 p-1 rounded-full">
                      <button onClick={setPresetToday} className={`text-[11px] px-3 py-1 rounded-full transition ${isPresetActive({ from: todayIso, to: todayIso }) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'}`}>📅 오늘</button>
                      <button onClick={setPresetThisWeek} className={`text-[11px] px-3 py-1 rounded-full transition ${isPresetActive(getThisWeekRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'}`}>🗓️ 이번주</button>
                      <button onClick={setPresetThisMonth} className={`text-[11px] px-3 py-1 rounded-full transition ${isPresetActive(getThisMonthRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'}`}>📆 이번달</button>
                      <button onClick={setPresetLast24h} className={`text-[11px] px-3 py-1 rounded-full transition ${isPresetActive(getLast24hRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'}`}>⏱️ 24h</button>
                      <button onClick={setPresetLast7Days} className={`text-[11px] px-3 py-1 rounded-full transition ${isPresetActive(getLast7DaysRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'}`}>🕒 7일</button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2 md:gap-4">
                    <div className="w-full md:w-auto">
                      {dateFrom && dateTo ? (
                        <div className="text-[12px] text-slate-300 break-words whitespace-normal">기간: {dateFrom} ~ {dateTo}</div>
                      ) : (
                        <div className="text-[12px] text-slate-300">전체</div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <button onClick={() => {
                        try {
                          const url = window.location.href;
                          navigator.clipboard.writeText(url);
                          alert('필터 링크가 복사되었습니다.');
                        } catch (e) {
                          alert('복사에 실패했습니다. 주소창에서 수동 복사해주세요.');
                        }
                      }} className="text-[11px] px-2 py-1 rounded-md bg-slate-800 text-slate-200">🔗 링크복사</button>
                    </div>
                  </div>
                </div>
                {showFiltersMobile && (
                  <div className="md:hidden fixed inset-0 z-50 bg-black/70 flex items-end">
                    <div className="bg-slate-900 w-full p-4 rounded-t-3xl border-t border-slate-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-black text-white">필터</div>
                        <button onClick={() => setShowFiltersMobile(false)} className="text-sm text-slate-400">닫기 ✕</button>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[12px] text-slate-400 uppercase tracking-widest">기간 프리셋</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setPresetToday(); setShowFiltersMobile(false); }} className={`text-[13px] px-3 py-2 rounded-full transition ${isPresetActive({ from: todayIso, to: todayIso }) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-700'}`}>📅 오늘</button>
                            <button onClick={() => { setPresetThisWeek(); setShowFiltersMobile(false); }} className={`text-[13px] px-3 py-2 rounded-full transition ${isPresetActive(getThisWeekRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-700'}`}>🗓️ 이번주</button>
                            <button onClick={() => { setPresetThisMonth(); setShowFiltersMobile(false); }} className={`text-[13px] px-3 py-2 rounded-full transition ${isPresetActive(getThisMonthRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-700'}`}>📆 이번달</button>
                            <button onClick={() => { setPresetLast24h(); setShowFiltersMobile(false); }} className={`text-[13px] px-3 py-2 rounded-full transition ${isPresetActive(getLast24hRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-700'}`}>⏱️ 24h</button>
                            <button onClick={() => { setPresetLast7Days(); setShowFiltersMobile(false); }} className={`text-[13px] px-3 py-2 rounded-full transition ${isPresetActive(getLast7DaysRange()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-indigo-700'}`}>🕒 7일</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[12px] text-slate-400 uppercase tracking-widest">카테고리</p>
                          <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTIONS.map((opt) => (
                              <button key={opt.code} onClick={() => toggleCategory(opt.code)} className={`flex items-center text-[13px] px-3 py-2 rounded-full border transition ${selectedCategories.includes(opt.code) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}>
                                <span className="mr-2">{opt.label}</span>
                                <span className="text-[12px] opacity-80">📅</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={resetFilters} className="flex-1 px-3 py-2 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700">초기화</button>
                          <button onClick={() => setShowFiltersMobile(false)} className="flex-1 px-3 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500">적용</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {Object.keys(filteredLogs).length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-10">필터조건에 해당하는 기록이 없습니다.</p>
                ) : (
                  Object.entries(filteredLogs).map(([dateKey, items]) => (
                    <div key={dateKey} className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 bg-slate-950/20 px-3 py-1 rounded-full inline-block">{dateKey}</div>
                      <div className="space-y-2 pt-1">
                        {items.map((item) => {
                          const logKey = `${item.id ?? 'noid'}-${item.event_date}-${item.event_time}-${item.actor_email ?? 'anon'}`;
                          return (
                            <div key={logKey} className="bg-slate-800/60 border border-slate-800/80 p-3.5 rounded-2xl flex justify-between items-center shadow-sm">
                              <div className="flex items-center space-x-3">
                                <span className="text-xl bg-slate-950/60 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-800">{item.display_emoji}</span>
                                <div>
                                  <p className="text-xs font-bold text-slate-200">
                                    {item.category_name_han} - <span className="text-indigo-400 font-mono">{item.event_value}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {item.event_time} · <span className="text-slate-600">{item.actor_email?.split('@')[0]}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="text-[10px] text-slate-200 bg-slate-700/90 hover:bg-slate-700 rounded-full px-2 py-1 font-bold" onClick={() => openEditLog(item)}>수정 ✎</button>
                                <button className="text-[10px] text-slate-600 hover:text-rose-400 font-bold px-2 py-1" onClick={() => handleDeleteLog(item.id)}>삭제 ✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

      {editingLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md p-5 rounded-3xl border border-slate-700 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">기록 수정</p>
                <h3 className="text-lg font-black text-white">{editingLog.category_name_han} 수정</h3>
              </div>
              <button onClick={closeEditLog} className="text-slate-400 text-xs font-bold">닫기</button>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.15em]">값</label>
              <input
                value={editEventValue}
                onChange={(e) => setEditEventValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                placeholder="예: 120ml, 37.4도, 배변 기록"
              />
              <p className="text-[10px] text-slate-500">자동 포맷: 수유는 ml, 체온은 도, 수면/배변은 간단한 한글로 입력해 주세요.</p>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.15em]">시간</label>
              <input
                type="time"
                value={editEventTime}
                onChange={(e) => setEditEventTime(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500">시간을 24시간 형식으로 선택하세요. 잘못 입력하면 그대로 저장됩니다.</p>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.15em]">이모지</label>
              <input
                value={editDisplayEmoji}
                onChange={(e) => setEditDisplayEmoji(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                placeholder="예: 🍼, 🌡️, 💩"
              />
              <p className="text-[10px] text-slate-500">빈칸이면 기본 아이콘으로 채워집니다.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={closeEditLog} className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-700">취소</button>
              <button onClick={applyEditLog} className="flex-1 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-400">저장</button>
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
