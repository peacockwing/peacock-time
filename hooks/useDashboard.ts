"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { fetchBabyLogs, createBabyLog, deleteBabyLog, analyzeCry } from '../services/babyLogService';
import { fetchTabData, updateTabItem } from '../services/tabsService';
import type { BabyLog, ChecklistItem, InventoryItem } from '../types/baby';

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
  // Socket.IO client removed: using Supabase Realtime only
  const socketRef = useRef<any | null>(null);

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

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    const logDateTime = new Date(`${year}-${month}-${day}T${timeStr}:00`);
    const diffMinutes = Math.max(0, Math.floor((Date.now() - logDateTime.getTime()) / 60000));

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

    // Socket.IO client removed; Supabase Realtime subscription handles updates.

    const channel = supabase
      .channel('peacock-space-channel', {
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

          if (prev.some((item) => item.id === newLog.id)) {
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
        setLogs((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as BabyLog) : item)));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'baby_log',
        filter: `family_code=eq.${familyCode}`,
      }, (payload) => {
        console.debug('[realtime][baby_log][DELETE] payload:', payload);
        setLogs((prev) => prev.filter((item) => item.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][INSERT] payload:', payload);
        setChecklist((prev) => [...prev, payload.new as ChecklistItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][UPDATE] payload:', payload);
        setChecklist((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as ChecklistItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][checklist][DELETE] payload:', payload);
        setChecklist((prev) => prev.filter((item) => item.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][INSERT] payload:', payload);
        setInventory((prev) => [...prev, payload.new as InventoryItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][UPDATE] payload:', payload);
        setInventory((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as InventoryItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        console.debug('[realtime][inventory][DELETE] payload:', payload);
        setInventory((prev) => prev.filter((item) => item.id !== payload.old.id));
      })
      .subscribe();

    console.debug('[realtime] subscribed to peacock-space-channel for familyCode=', familyCode);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyCode]);

  const submitQuickEvent = async (
    categoryCode: string,
    categoryNameHan: string,
    eventValue: string,
    displayEmoji: string
  ) => {
    if (!familyCode) return;

    // use KST so optimistic timestamp matches server-side KST timestamp
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    const hours = String(kstDate.getHours()).padStart(2, '0');
    const minutes = String(kstDate.getMinutes()).padStart(2, '0');

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
  };

  const handleToggleSleep = () => {
    if (!isSleeping) {
      submitQuickEvent('SLEEP', '수면', '수면 시작 💤', '😴');
    } else {
      submitQuickEvent('SLEEP', '수면', '잠에서 깨어남 ☀️', '☀️');
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
    handleToggleSleep,
    handleChecklistToggle,
    handleInventoryStatus,
    startCryAnalysis,
    handleLogout,
  };
};
