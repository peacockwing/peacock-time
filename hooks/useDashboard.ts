"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { fetchBabyLogs, createBabyLog, deleteBabyLog, updateBabyLog, analyzeCry } from '../services/babyLogService';
import { fetchTabData, updateTabItem } from '../services/tabsService';
import { parseVoiceCommand } from '../services/voiceParser';
import { speak } from '../services/tts';
import type { BabyLog, ChecklistItem, InventoryItem } from '../types/baby';

// Track which familyCode channels we've already subscribed to in this page session
const activeFamilyChannels = new Set<string>();

export const useDashboard = () => {
  const router = useRouter();

  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('parent@example.com');
  const [userName, setUserName] = useState<string>('보호자');
  const [activeMenu, setActiveMenu] = useState<'baby-log' | 'prep-list' | 'after-delivery'>('baby-log');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<'FEED' | 'TEMP' | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatusText, setRecordingStatusText] = useState('대기 중');
  const [cryAnalysisResult, setCryAnalysisResult] = useState<{
    emoji: string;
    prediction: string;
    avg_frequency: number;
    max_decibel: number;
  } | null>(null);

  const [logs, setLogs] = useState<BabyLog[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [lastFeedText, setLastFeedText] = useState('수유 기록 없음');
  const [lastPoopText, setLastPoopText] = useState('배변 기록 없음');
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepTimerText, setSleepTimerText] = useState('00시간 00분째');
  const [sleepTimerTitle, setSleepTimerTitle] = useState('깨어난 지');
  const lastSleepLogRef = useRef<BabyLog | null>(null);
  const lastRefetchAt = useRef<number>(0);
  const supabaseChannelRef = useRef<any | null>(null);
  // Socket.IO client removed: using Supabase Realtime only
  const socketRef = useRef<any | null>(null);

// Track which familyCode channels we've already subscribed to in this page session

  useEffect(() => {
    let lastFeed = '수유 기록 없음';
    let lastPoop = '배변 기록 없음';
    let lastSleep: BabyLog | null = null;

    for (const log of logs) {
      if (log.category_code === 'FEED' && lastFeed === '수유 기록 없음') {
        lastFeed = `🍼 수유: ${log.event_value} (${log.event_time})`;
      }
      if (log.category_code === 'POOP_PEE' && lastPoop === '배변 기록 없음') {
        lastPoop = `💩 배변 (${log.event_time})`;
      }
      if (log.category_code === 'SLEEP' && !lastSleep) {
        lastSleep = log;
      }
    }

    setLastFeedText(lastFeed);
    setLastPoopText(lastPoop);
    lastSleepLogRef.current = lastSleep;

    calculateSleepDuration();
  }, [logs]);

  const calculateSleepDuration = () => {
    const lastSleepLog = lastSleepLogRef.current;
    if (!lastSleepLog) return;

    const dateStr = lastSleepLog.event_date;
    const timeStr = lastSleepLog.event_time;

    const y = parseInt(dateStr.substring(0, 4), 10);
    const m = parseInt(dateStr.substring(4, 6), 10);
    const d = parseInt(dateStr.substring(6, 8), 10);
    const [hStr, minStr] = (timeStr || '00:00').split(':');
    const hh = parseInt(hStr || '0', 10);
    const mm = parseInt(minStr || '0', 10);

    // Stored times are in KST (UTC+9). Convert KST datetime to UTC ms for correct diff.
    const logUtcMs = Date.UTC(y, m - 1, d, hh, mm) - 9 * 60 * 60 * 1000;
    const diffMinutes = Math.max(0, Math.floor((Date.now() - logUtcMs) / 60000));

    const hours = String(Math.floor(diffMinutes / 60)).padStart(2, '0');
    const mins = String(diffMinutes % 60).padStart(2, '0');

    if (lastSleepLog.event_value.includes('수면 시작')) {
      setIsSleeping(true);
      setSleepTimerTitle('잠든 지');
      setSleepTimerText(`${hours}시간 ${mins}분째`);
    } else {
      setIsSleeping(false);
      setSleepTimerTitle('깨어난 지');
      setSleepTimerText(`${hours}시간 ${mins}분째`);
    }
  };

  useEffect(() => {
    const interval = setInterval(calculateSleepDuration, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async (code: string) => {
    const data = await fetchBabyLogs(code);
    if (data.success) setLogs(data.logs);
  };

  const fetchOtherTabs = async (code: string, tabName: 'checklist' | 'inventory', setter: (value: any) => void) => {
    const data = await fetchTabData(code, tabName);
    if (data.success) setter(data.data);
  };

  useEffect(() => {
    const code = localStorage.getItem('familyCode');
    const email = localStorage.getItem('userEmail') || 'parent@example.com';
    const name = localStorage.getItem('peacock_name') || email.split('@')[0];

    if (!code || code === 'undefined' || code === 'null') {
      localStorage.removeItem('familyCode');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('peacock_name');
      router.push('/login');
      return;
    }

    setFamilyCode(code);
    setUserEmail(email);
    setUserName(name);

    fetchLogs(code);
    fetchOtherTabs(code, 'checklist', setChecklist);
    fetchOtherTabs(code, 'inventory', setInventory);
  }, [router]);

  useEffect(() => {
    if (!familyCode || familyCode === 'undefined' || familyCode === 'null') return;
    // Avoid creating duplicate subscriptions for the same familyCode in this page session
    if (activeFamilyChannels.has(familyCode)) {
      console.debug('[realtime] already subscribed for familyCode=', familyCode);
      return;
    }
    activeFamilyChannels.add(familyCode);

    // Socket.IO client removed; Supabase Realtime subscription handles updates.

    const channelName = `peacock-space-${familyCode}`;
    // Helper to extract id from various realtime payload shapes
    const extractIdFromPayload = (payload: any) => {
      // Supabase realtime payloads can expose the deleted row under different keys
      // depending on client / server versions: `old`, `record`, `new`, or sometimes `id`.
      if (!payload) return null;
      return payload.old?.id ?? payload.record?.id ?? payload.new?.id ?? payload.id ?? null;
    };
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: familyCode },
        },
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'baby_log',
        filter: `family_code=eq.${familyCode}`,
      }, (payload) => {
        console.debug('[realtime][baby_log][INSERT] payload:', payload);
        const newLog = payload.new as BabyLog;

        setLogs((prev) => {
          // match optimistic entries by negative temporary id and KST timestamps
          const isMyOptimisticLogExists = prev.some((item) =>
            (typeof item.id === 'number' && item.id < 0 && item.category_code === newLog.category_code && item.event_time === newLog.event_time) ||
            (item.category_code === newLog.category_code && item.event_time === newLog.event_time && item.actor_email === newLog.actor_email && typeof item.id === 'number' && item.id < 0)
          );

          if (isMyOptimisticLogExists) {
            return prev.map((item) =>
              ((typeof item.id === 'number' && item.id < 0 && item.category_code === newLog.category_code && item.event_time === newLog.event_time) ||
                (item.category_code === newLog.category_code && item.event_time === newLog.event_time && item.actor_email === newLog.actor_email && typeof item.id === 'number' && item.id < 0))
                ? (newLog as BabyLog)
                : item
            );
          }

          if (prev.some((item) => Number(item.id) === Number(newLog.id))) {
            return prev;
          }

          return [newLog, ...prev];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'baby_log',
        filter: `family_code=eq.${familyCode}`,
      }, (payload) => {
        console.debug('[realtime][baby_log][UPDATE] payload:', payload);
        setLogs((prev) => prev.map((item) => (Number(item.id) === Number(payload.new.id) ? (payload.new as BabyLog) : item)));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'baby_log',
        filter: `family_code=eq.${familyCode}`,
      }, (payload) => {
        console.debug('[realtime][baby_log][DELETE] payload:', payload);
        const deletedId = extractIdFromPayload(payload);
        console.debug('[realtime][baby_log][DELETE] resolved id:', deletedId, 'types:', typeof deletedId);
        if (deletedId == null) return;
        const sid = String(deletedId);
        setLogs((prev) => {
          const filtered = prev.filter((item) => String(item.id) !== sid);
          if (filtered.length === prev.length) {
            console.warn('[realtime][baby_log][DELETE] no local item removed for id=', sid, '; will refetch logs to resync');
            const now = Date.now();
            if (now - lastRefetchAt.current > 5000) {
              lastRefetchAt.current = now;
              setTimeout(() => {
                try {
                  fetchLogs(familyCode);
                } catch (e) {
                  console.warn('refetch logs failed', e);
                }
              }, 250);
            }
          }
          return filtered;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][INSERT] payload:', payload);
        setChecklist((prev) => [...prev, payload.new as ChecklistItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][UPDATE] payload:', payload);
        setChecklist((prev) => prev.map((item) => (Number(item.id) === Number(payload.new.id) ? (payload.new as ChecklistItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][DELETE] payload:', payload);
        const deletedId = extractIdFromPayload(payload);
        if (deletedId == null) return;
        const sid = String(deletedId);
        setChecklist((prev) => prev.filter((item) => String(item.id) !== sid));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][INSERT] payload:', payload);
        setInventory((prev) => [...prev, payload.new as InventoryItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][UPDATE] payload:', payload);
        setInventory((prev) => prev.map((item) => (Number(item.id) === Number(payload.new.id) ? (payload.new as InventoryItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][DELETE] payload:', payload);
        const deletedId = extractIdFromPayload(payload);
        if (deletedId == null) return;
        const sid = String(deletedId);
        setInventory((prev) => prev.filter((item) => String(item.id) !== sid));
      })
      .on('broadcast', { event: 'client_delete' }, (msg) => {
        try {
          console.debug('[realtime][broadcast][client_delete] msg:', msg);
          const payload = msg.payload ?? msg;
          const deletedId = payload?.id ?? payload?.deletedId ?? null;
          if (deletedId == null) return;
          const sid = String(deletedId);
          setLogs((prev) => prev.filter((item) => String(item.id) !== sid));
        } catch (e) {
          console.warn('failed handling client_delete broadcast', e);
        }
      })
      .subscribe();

    console.debug('[realtime] subscribed to', channelName, 'for familyCode=', familyCode);
    supabaseChannelRef.current = channel;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('failed to remove supabase channel', e);
      }
      activeFamilyChannels.delete(familyCode);
      supabaseChannelRef.current = null;
    };
  }, [familyCode]);

  const submitQuickEvent = async (
    categoryCode: string,
    categoryNameHan: string,
    eventValue: string,
    displayEmoji: string
  ) => {
    if (!familyCode) return;

    // Compute KST (Asia/Seoul) components reliably regardless of client timezone
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const lookup: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') lookup[p.type] = p.value;
    });

    const year = lookup.year;
    const month = (lookup.month || '01').padStart(2, '0');
    const day = (lookup.day || '01').padStart(2, '0');
    const hours = (lookup.hour || '00').padStart(2, '0');
    const minutes = (lookup.minute || '00').padStart(2, '0');

    // use a negative temporary id to reliably identify optimistic entries
    const optimisticLog: BabyLog = {
      id: -Date.now(),
      family_code: familyCode,
      category_code: categoryCode,
      category_name_han: categoryNameHan,
      event_value: eventValue,
      event_date: `${year}${month}${day}`,
      event_time: `${hours}:${minutes}`,
      display_emoji: displayEmoji,
      actor_email: userEmail,
    };

    setLogs((prev) => [optimisticLog, ...prev]);

    try {
      const response = await createBabyLog({
        familyCode,
        categoryCode,
        categoryNameHan,
        eventValue,
        displayEmoji,
        actorEmail: userEmail,
      });

      if (!response.success) {
        throw new Error(response.error || '기록 저장 실패');
      }
    } catch (error) {
      console.error('실시간 인프라 동기화 실패:', error);
      setLogs((prev) => prev.filter((log) => log.id !== optimisticLog.id));
      alert('서버 연결이 고르지 못해 기록 처리에 실패했습니다.');
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!confirm('기록을 안전하게 영구 삭제합니까?')) return;
    if (!familyCode) {
      console.error('familyCode가 없어서 삭제를 진행할 수 없습니다.');
      return;
    }

    setLogs((prev) => prev.filter((log) => log.id !== id));
    const response = await deleteBabyLog(id, familyCode);
    if (!response.success) {
      console.error('삭제 실패:', response.error);
    }
    // fast-path: broadcast a client-level delete so other clients remove immediately
    try {
      const ch = supabaseChannelRef.current;
      if (ch && typeof ch.send === 'function') {
        ch.send({ type: 'broadcast', event: 'client_delete', payload: { id, familyCode } });
      }
    } catch (e) {
      console.warn('client broadcast delete failed', e);
    }
  };

  const handleToggleSleep = () => {
    if (!isSleeping) {
      submitQuickEvent('SLEEP', '수면', '수면 시작 💤', '😴');
    } else {
      submitQuickEvent('SLEEP', '수면', '잠에서 깨어남 ☀️', '☀️');
    }
  };

  const handleUpdateLog = async (id: number, updates: { eventValue?: string; eventTime?: string; displayEmoji?: string }) => {
    if (!familyCode) return;
    const prevLogs = logs;
    setLogs((prev) => prev.map((item) => (item.id === id ? { ...item, ...{
      event_value: updates.eventValue ?? item.event_value,
      event_time: updates.eventTime ?? item.event_time,
      display_emoji: updates.displayEmoji ?? item.display_emoji,
    } } : item)));

    const response = await updateBabyLog(id, familyCode, updates);
    if (!response.success) {
      console.error('로그 수정 실패:', response.error);
      setLogs(prevLogs);
      alert('기록 수정에 실패했습니다. 다시 시도해주세요.');
      return;
    }
  };

  const handleChecklistToggle = async (id: number, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, is_completed: nextStatus } : item)));

    const response = await updateTabItem({ familyCode, targetTab: 'checklist', id, isCompleted: nextStatus });
    if (!response.success) {
      console.error('체크리스트 업데이트 실패:', response.error);
    }
  };

  const handleInventoryStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'READY' ? 'BOUGHT' : currentStatus === 'BOUGHT' ? 'GIFT' : 'READY';
    setInventory((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));

    const response = await updateTabItem({ familyCode, targetTab: 'inventory', id, status: nextStatus });
    if (!response.success) {
      console.error('인벤토리 상태 업데이트 실패:', response.error);
    }
  };

  const startCryAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      setIsRecording(true);
      setRecordingStatusText('🔴 수집 중');

      let frequencies: number[] = [];
      let maxVolume = 0;

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let localMax = 0;
        let targetIdx = 0;
        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > localMax) {
            localMax = dataArray[i];
            targetIdx = i;
          }
        }
        const hz = (targetIdx * audioContext.sampleRate) / analyser.fftSize;
        if (localMax > 30 && hz > 120) {
          frequencies.push(hz);
          if (localMax > maxVolume) maxVolume = localMax;
        }
      }, 100);

      setTimeout(async () => {
        clearInterval(interval);
        stream.getTracks().forEach((track) => track.stop());
        setRecordingStatusText('대기 중');
        setIsRecording(false);

        const avgHz = frequencies.length > 0 ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 0;
        if (avgHz === 0) {
          alert('소리가 너무 작거나 유효하지 않습니다.');
          return;
        }

        const resData = await analyzeCry({ avg_frequency: Math.round(avgHz), max_decibel: maxVolume, familyCode });
        if (resData.success) {
          setCryAnalysisResult({
            emoji: resData.emoji,
            prediction: resData.prediction,
            avg_frequency: resData.avg_frequency,
            max_decibel: resData.max_decibel,
          });
        }
      }, 5000);
    } catch (err) {
      alert('마이크 권한 획득에 실패했습니다.');
    }
  };

  // Voice command: listen for Korean commands like
  // "피콕타임! 분유 수유 60ml 입력해죠"
  const recognitionRef = useRef<any | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const startVoiceCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
      return;
    }

    if (recognitionRef.current) return;

    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onstart = () => {
      setIsVoiceListening(true);
    };

    rec.onerror = (ev: any) => {
      console.error('speech recognition error', ev);
      setIsVoiceListening(false);
      recognitionRef.current = null;
    };

    rec.onend = () => {
      setIsVoiceListening(false);
      recognitionRef.current = null;
    };

    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results).map((r: any) => r[0].transcript).join('');
      console.debug('[voice] transcript:', transcript);
      handleVoiceTranscript(transcript);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error('recognition start failed', e);
      setIsVoiceListening(false);
      recognitionRef.current = null;
    }
  };

  const stopVoiceCommand = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsVoiceListening(false);
  };

  const handleVoiceTranscript = async (text: string) => {
    if (!familyCode) {
      alert('가족 코드가 설정되어 있지 않습니다.');
      return;
    }

    const cmd = parseVoiceCommand(text || '');
    if (!cmd) {
      speak('음성 명령을 이해하지 못했습니다. 다시 말해주세요.');
      return;
    }

    try {
      if (cmd.type === 'FEED') {
        await submitQuickEvent('FEED', '수유', `${cmd.amountMl}ml`, '🍼');
        speak(`${cmd.amountMl} 밀리리터 분유 기록을 추가했습니다`);
        return;
      }
      if (cmd.type === 'TEMP') {
        await submitQuickEvent('TEMP', '체온', `${cmd.value}도`, '🌡️');
        speak(`${cmd.value} 도 체온 기록을 추가했습니다`);
        return;
      }
      if (cmd.type === 'POOP') {
        await submitQuickEvent('POOP_PEE', '배변', '정상 대변 💩', '💩');
        speak('배변 기록을 추가했습니다');
        return;
      }
      if (cmd.type === 'SLEEP_TOGGLE') {
        if (cmd.state === 'SLEEP') {
          await submitQuickEvent('SLEEP', '수면', '수면 시작 💤', '😴');
          speak('수면 시작 기록을 추가했습니다');
        } else {
          await submitQuickEvent('SLEEP', '수면', '잠에서 깨어남 ☀️', '☀️');
          speak('깨어남 기록을 추가했습니다');
        }
        return;
      }
    } catch (e) {
      console.error('voice command failed', e);
      speak('기록 중 오류가 발생했습니다');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('familyCode');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('peacock_name');
    router.push('/login');
  };

  const inventorySections = useMemo(() => {
    const sections: Record<string, InventoryItem[]> = {};
    inventory.forEach((item) => {
      if (!sections[item.section_name]) sections[item.section_name] = [];
      sections[item.section_name].push(item);
    });
    return sections;
  }, [inventory]);

  const checklistPeriods = useMemo(() => {
    const periods: Record<string, ChecklistItem[]> = {};
    checklist.forEach((item) => {
      const key = item.period_type ? item.period_type.trim() : '기타';
      if (!periods[key]) periods[key] = [];
      periods[key].push(item);
    });
    return periods;
  }, [checklist]);

  const totalInv = inventory.length;
  const completedInv = inventory.filter((item) => item.status !== 'READY').length;
  const invProgressPct = totalInv > 0 ? Math.round((completedInv / totalInv) * 100) : 0;

  const totalCheck = checklist.length;
  const completedCheck = checklist.filter((item) => item.is_completed === 1).length;
  const checkProgressPct = totalCheck > 0 ? Math.round((completedCheck / totalCheck) * 100) : 0;

  return {
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
    startVoiceCommand,
    stopVoiceCommand,
    isVoiceListening,
  };
};
