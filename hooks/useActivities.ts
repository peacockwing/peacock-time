"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  createActivity as apiCreateActivity,
  updateActivity as apiUpdateActivity,
  deleteActivity as apiDeleteActivity,
  fetchActivities,
  fetchCategorySettings,
  saveCategorySettings as apiSaveCategorySettings,
  fetchCustomFields,
  createCustomField as apiCreateCustomField,
  updateCustomField as apiUpdateCustomField,
  deleteCustomField as apiDeleteCustomField,
  analyzeCry as apiAnalyzeCry,
  fetchRecommendations,
} from '../services/activityService';
import { parseVoiceCommand } from '../services/voiceParser';
import { speak } from '../services/tts';
import type { Activity, CategorySettingEntry, CustomFieldDefinition, Recommendation } from '../types/activity';

const activeActivityChannels = new Set<string>();
const NOTIFICATION_PREF_KEY = 'peacock_notifications_enabled';
const NOTIFIED_KEY = 'peacock_notified_predictions';

export const useActivities = (familyCode: string | null, userEmail: string) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySettingEntry[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const loadActivities = useCallback(async (code: string) => {
    setLoading(true);
    const data = await fetchActivities(code);
    if (data.success) setActivities(data.activities);
    setLoading(false);
  }, []);

  const loadCategorySettings = useCallback(async (code: string) => {
    const data = await fetchCategorySettings(code);
    if (data.success) setCategorySettings(data.categories);
  }, []);

  const loadCustomFields = useCallback(async (code: string) => {
    const data = await fetchCustomFields(code);
    if (data.success) setCustomFields(data.customFields);
  }, []);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const loadRecommendations = useCallback(async (code: string) => {
    const data = await fetchRecommendations(code);
    if (data.success) setRecommendations(data.recommendations);
  }, []);

  useEffect(() => {
    if (!familyCode) return;
    loadActivities(familyCode);
    loadCategorySettings(familyCode);
    loadCustomFields(familyCode);
    loadRecommendations(familyCode);
  }, [familyCode, loadActivities, loadCategorySettings, loadCustomFields, loadRecommendations]);

  // Predictions shift every time a new log lands, so recompute whenever the
  // activity list changes (debounced - creates/updates/deletes can arrive in
  // quick bursts, e.g. from realtime + the local optimistic update both firing).
  const recommendationsDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!familyCode) return;
    if (recommendationsDebounceRef.current) window.clearTimeout(recommendationsDebounceRef.current);
    recommendationsDebounceRef.current = window.setTimeout(() => loadRecommendations(familyCode), 500);
    return () => {
      if (recommendationsDebounceRef.current) window.clearTimeout(recommendationsDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities.length, familyCode]);

  // Realtime: activity_log rows join several detail tables, so rather than
  // reassembling partial payloads client-side, any change just triggers a
  // debounced refetch of the full (small, per-family) activity list.
  useEffect(() => {
    if (!familyCode) return;
    if (activeActivityChannels.has(familyCode)) return;
    activeActivityChannels.add(familyCode);

    let debounceTimer: number | null = null;
    const refetch = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => loadActivities(familyCode), 250);
    };

    const channel = supabase
      .channel(`peacock-activities-${familyCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log', filter: `family_code=eq.${familyCode}` }, refetch)
      .subscribe();

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('failed to remove activity channel', e);
      }
      activeActivityChannels.delete(familyCode);
    };
  }, [familyCode, loadActivities]);

  const createActivity = async (payload: {
    category: string;
    startTime: string;
    endTime?: string | null;
    memo?: string;
    hashtags?: string[];
    detail?: Record<string, any>;
  }) => {
    if (!familyCode) return { success: false, error: '가족 코드가 없습니다.' };
    const res = await apiCreateActivity({ familyCode, actorEmail: userEmail, ...payload });
    if (res.success) setActivities((prev) => [res.activity, ...prev]);
    return res;
  };

  const updateActivity = async (id: number, payload: { endTime?: string | null; memo?: string; hashtags?: string[]; detail?: Record<string, any> }) => {
    if (!familyCode) return { success: false, error: '가족 코드가 없습니다.' };
    const res = await apiUpdateActivity(id, familyCode, payload);
    if (res.success) setActivities((prev) => prev.map((a) => (a.id === id ? res.activity : a)));
    return res;
  };

  const deleteActivity = async (id: number) => {
    if (!familyCode) return { success: false, error: '가족 코드가 없습니다.' };
    setActivities((prev) => prev.filter((a) => a.id !== id));
    const res = await apiDeleteActivity(id, familyCode);
    if (!res.success) await loadActivities(familyCode);
    return res;
  };

  const saveCategorySettings = async (next: CategorySettingEntry[]) => {
    if (!familyCode) return;
    setCategorySettings(next);
    await apiSaveCategorySettings(familyCode, next.map((c) => ({ category: c.category, isEnabled: c.isEnabled, displayOrder: c.displayOrder })));
  };

  const createCustomField = async (name: string, unit: string, valueType: 'TEXT' | 'NUMBER') => {
    if (!familyCode) return;
    const res = await apiCreateCustomField({ familyCode, name, unit, valueType });
    if (res.success) await loadCustomFields(familyCode);
    return res;
  };

  const updateCustomField = async (id: number, payload: { name?: string; unit?: string; isEnabled?: boolean; displayOrder?: number }) => {
    if (!familyCode) return;
    const res = await apiUpdateCustomField(id, familyCode, payload);
    if (res.success) await loadCustomFields(familyCode);
    return res;
  };

  const deleteCustomField = async (id: number) => {
    if (!familyCode) return;
    const res = await apiDeleteCustomField(id, familyCode);
    if (res.success) await loadCustomFields(familyCode);
    return res;
  };

  // ---- Sleep quick-toggle (SLEEP category, in-progress = end_time null) ----
  const inProgressSleep = useMemo(
    () => activities.find((a) => a.category === 'SLEEP' && !a.end_time),
    [activities]
  );
  const isSleeping = Boolean(inProgressSleep);
  const [sleepTimerText, setSleepTimerText] = useState('00시간 00분째');
  const sleepTimerTitle = isSleeping ? '잠든 지' : '깨어난 지';

  const lastFinishedSleep = useMemo(
    () => activities.find((a) => a.category === 'SLEEP' && a.end_time),
    [activities]
  );

  const computeSleepTimer = useCallback(() => {
    const reference = inProgressSleep?.start_time || lastFinishedSleep?.end_time;
    if (!reference) {
      setSleepTimerText('00시간 00분째');
      return;
    }
    const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(reference).getTime()) / 60000));
    const hours = String(Math.floor(diffMinutes / 60)).padStart(2, '0');
    const mins = String(diffMinutes % 60).padStart(2, '0');
    setSleepTimerText(`${hours}시간 ${mins}분째`);
  }, [inProgressSleep, lastFinishedSleep]);

  useEffect(() => {
    computeSleepTimer();
    const interval = setInterval(computeSleepTimer, 60000);
    return () => clearInterval(interval);
  }, [computeSleepTimer]);

  const handleToggleSleep = async () => {
    if (inProgressSleep) {
      await updateActivity(inProgressSleep.id, { endTime: new Date().toISOString() });
      return;
    }
    const hour = new Date().getHours();
    const sleepType = hour >= 20 || hour < 7 ? 'NIGHT' : 'NAP';
    await createActivity({
      category: 'SLEEP',
      startTime: new Date().toISOString(),
      endTime: null,
      detail: { sleep_type: sleepType },
    });
  };

  // ---- Cry analysis (stateless, unchanged behavior) ----
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatusText, setRecordingStatusText] = useState('대기 중');
  const [cryAnalysisResult, setCryAnalysisResult] = useState<{
    emoji: string;
    prediction: string;
    avg_frequency: number;
    max_decibel: number;
  } | null>(null);

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

        const resData = await apiAnalyzeCry({ avg_frequency: Math.round(avgHz), max_decibel: maxVolume, familyCode: familyCode || undefined });
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

  // ---- Voice command: quick one-shot entries for a few common categories ----
  const recognitionRef = useRef<any | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const handleVoiceTranscript = async (text: string) => {
    const cmd = parseVoiceCommand(text || '');
    if (!cmd) {
      speak('음성 명령을 이해하지 못했습니다. 다시 말해주세요.');
      return;
    }

    const now = new Date().toISOString();
    try {
      if (cmd.type === 'FEED') {
        await createActivity({ category: 'FORMULA', startTime: now, endTime: now, detail: { final_amount_ml: cmd.amountMl } });
        speak(`${cmd.amountMl} 밀리리터 분유 기록을 추가했습니다`);
        return;
      }
      if (cmd.type === 'TEMP') {
        await createActivity({ category: 'TEMPERATURE', startTime: now, endTime: now, detail: { temperature_celsius: cmd.value } });
        speak(`${cmd.value} 도 체온 기록을 추가했습니다`);
        return;
      }
      if (cmd.type === 'POOP') {
        await createActivity({ category: 'DIAPER', startTime: now, endTime: now, detail: { type: 'POOP' } });
        speak('배변 기록을 추가했습니다');
        return;
      }
      if (cmd.type === 'SLEEP_TOGGLE') {
        await handleToggleSleep();
        speak(cmd.state === 'SLEEP' ? '수면 시작 기록을 추가했습니다' : '깨어남 기록을 추가했습니다');
        return;
      }
    } catch (e) {
      console.error('voice command failed', e);
      speak('기록 중 오류가 발생했습니다');
    }
  };

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

    rec.onstart = () => setIsVoiceListening(true);
    rec.onerror = () => {
      setIsVoiceListening(false);
      recognitionRef.current = null;
    };
    rec.onend = () => {
      setIsVoiceListening(false);
      recognitionRef.current = null;
    };
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results).map((r: any) => r[0].transcript).join('');
      handleVoiceTranscript(transcript);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      setIsVoiceListening(false);
      recognitionRef.current = null;
    }
  };

  const stopVoiceCommand = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsVoiceListening(false);
  };

  // ---- Notifications: fire a local browser notification once a prediction's
  // ETA arrives. Only works while this tab is open (no service worker / push
  // subscription) - that's a known limitation, not a bug.
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNotificationsEnabled(localStorage.getItem(NOTIFICATION_PREF_KEY) === 'true' && Notification.permission === 'granted');
  }, []);

  const requestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setNotificationsEnabled(granted);
    localStorage.setItem(NOTIFICATION_PREF_KEY, String(granted));
    if (!granted) alert('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
  };

  const disableNotifications = () => {
    setNotificationsEnabled(false);
    localStorage.setItem(NOTIFICATION_PREF_KEY, 'false');
  };

  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined') return;

    const checkAndNotify = () => {
      if (Notification.permission !== 'granted') return;
      const enabledCodes = new Set(categorySettings.filter((c) => c.isEnabled).map((c) => c.category));
      const notified: string[] = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]');
      const notifiedSet = new Set(notified);
      const now = Date.now();
      let changed = false;

      for (const rec of recommendations) {
        if (!enabledCodes.has(rec.category)) continue;
        if (new Date(rec.predictedNextTime).getTime() > now) continue;
        const key = `${rec.category}:${rec.predictedNextTime}`;
        if (notifiedSet.has(key)) continue;

        new Notification(`${rec.emoji} ${rec.label} 시간이 됐어요`, {
          body: `평균 주기 기준 예상 시간이 지났습니다.`,
          tag: rec.category,
        });
        notifiedSet.add(key);
        changed = true;
      }

      if (changed) {
        // Cap stored keys so this doesn't grow unbounded over weeks of use.
        const trimmed = Array.from(notifiedSet).slice(-200);
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify(trimmed));
      }
    };

    checkAndNotify();
    const interval = setInterval(checkAndNotify, 60000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, recommendations, categorySettings]);

  return {
    activities,
    loading,
    categorySettings,
    customFields,
    createActivity,
    updateActivity,
    deleteActivity,
    saveCategorySettings,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    isSleeping,
    sleepTimerText,
    sleepTimerTitle,
    handleToggleSleep,
    isRecording,
    recordingStatusText,
    cryAnalysisResult,
    startCryAnalysis,
    isVoiceListening,
    startVoiceCommand,
    stopVoiceCommand,
    recommendations,
    notificationsEnabled,
    requestNotifications,
    disableNotifications,
  };
};
