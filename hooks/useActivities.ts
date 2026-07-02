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
  interpretVoiceCommand,
} from '../services/activityService';
import { getCategoryDef } from '../lib/activityCategories';
import { summarizeActivity } from '../lib/activitySummary';
import { speak } from '../services/tts';
import { isNativeApp, ensureVoicePermission, listenOnceNative, stopNativeListening } from '../services/nativeVoice';
import { primeNativePermissionsOnce } from '../services/nativePermissions';
import type { Activity, CategorySettingEntry, CustomFieldDefinition, Recommendation } from '../types/activity';

const activeActivityChannels = new Set<string>();
const NOTIFICATION_PREF_KEY = 'peacock_notifications_enabled';
const NOTIFIED_KEY = 'peacock_notified_predictions';
const WAKE_WORD_PREF_KEY = 'peacock_wake_word_enabled';
const WAKE_WORD_REGEX = /피\s*콕\s*타\s*임/;

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

  // Manual re-sync (pull-to-refresh) - realtime already keeps activities
  // current, but this covers gaps like a dropped websocket or a stale
  // recommendation window without asking the user to reload the page.
  const refreshAll = useCallback(async () => {
    if (!familyCode) return;
    await Promise.all([
      loadActivities(familyCode),
      loadCategorySettings(familyCode),
      loadCustomFields(familyCode),
      loadRecommendations(familyCode),
    ]);
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

  // ---- Voice command: all 16 categories, powered by the /api/voice-command
  // NLU engine (classify category -> extract that category's actual fields,
  // both via Claude) so any category the app knows about is voice-loggable
  // without hand-written per-category parsing rules. Triggered only via the
  // "피콕타임" wake word below - there's no manual tap-to-talk button.
  useEffect(() => {
    primeNativePermissionsOnce();
  }, []);

  const processVoiceCommand = async (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    let parsed;
    try {
      parsed = await interpretVoiceCommand(trimmed);
    } catch (e) {
      speak('음성 명령 처리 중 오류가 발생했어요');
      return;
    }
    if (!parsed.success || !parsed.category) {
      speak(parsed.error || '어떤 항목을 기록할지 이해하지 못했어요. 다시 말씀해주세요.');
      return;
    }

    try {
      // SLEEP is stateful elsewhere in the app (in-progress timer, dashboard
      // toggle) - route a plain "잤어/깼어"-style command through the same
      // toggle instead of creating a parallel entry, unless a duration was
      // spoken (then it's a retroactive nap log, handled generically below).
      if (parsed.category === 'SLEEP' && !parsed.durationMinutes) {
        const wasSleeping = isSleeping;
        await handleToggleSleep();
        speak(wasSleeping ? '깨어남 기록을 저장했어요' : '수면 시작 기록을 저장했어요');
        return;
      }

      const res = await createActivity({
        category: parsed.category,
        startTime: parsed.startTime as string,
        endTime: parsed.endTime ?? null,
        detail: parsed.detail,
      });

      if (!res.success || !('activity' in res) || !res.activity) {
        speak('저장 중 오류가 발생했어요');
        return;
      }

      const def = getCategoryDef(parsed.category);
      const summary = summarizeActivity(res.activity, customFields);
      speak(`${def?.label || ''} ${summary} 기록을 저장했어요`);
    } catch (e) {
      console.error('voice command failed', e);
      speak('기록 중 오류가 발생했어요');
    }
  };

  // ---- Wake word ("피콕타임"): continuous background listening so a
  // command can be spoken hands-free, Siri/OK Google-style. This only works
  // while the app is open and in the foreground - mobile OSes suspend mic
  // access once the screen locks or the app is backgrounded, so it's not a
  // true always-on background assistant.
  //
  // Two engines depending on where this runs: the native Capacitor app uses
  // the @capacitor-community/speech-recognition plugin (Android's WebView
  // never implemented the Web Speech API, so window.SpeechRecognition is
  // unusable there even when it's defined); a plain browser tab (e.g.
  // visiting the Vercel URL directly) uses the Web Speech API as before.
  const wakeWordRecognitionRef = useRef<any | null>(null);
  const wakeWordShouldRunRef = useRef(false);
  const nativeWakeLoopActiveRef = useRef(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsWakeWordActive(localStorage.getItem(WAKE_WORD_PREF_KEY) === 'true');
  }, []);

  // ---- native engine ----
  const runNativeWakeLoop = async () => {
    if (nativeWakeLoopActiveRef.current) return;
    nativeWakeLoopActiveRef.current = true;
    try {
      while (wakeWordShouldRunRef.current) {
        const transcript = await listenOnceNative();
        if (!wakeWordShouldRunRef.current) break;
        const match = transcript.match(WAKE_WORD_REGEX);
        if (!match) continue;

        const afterWake = transcript.slice((match.index || 0) + match[0].length).trim();
        if (afterWake) {
          await processVoiceCommand(afterWake);
        } else {
          speak('네, 말씀하세요');
          const command = await listenOnceNative();
          if (command.trim()) await processVoiceCommand(command);
        }
      }
    } finally {
      nativeWakeLoopActiveRef.current = false;
    }
  };

  // ---- web engine ----
  const stopWakeWordRecognizer = () => {
    const rec = wakeWordRecognitionRef.current;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch (e) {
        /* ignore */
      }
      wakeWordRecognitionRef.current = null;
    }
  };

  const captureFollowUpCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results).map((r: any) => r[0].transcript).join('');
      processVoiceCommand(transcript).finally(() => {
        if (wakeWordShouldRunRef.current) launchWakeWordRecognizer();
      });
    };
    rec.onerror = () => {
      if (wakeWordShouldRunRef.current) launchWakeWordRecognizer();
    };
    wakeWordRecognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      if (wakeWordShouldRunRef.current) launchWakeWordRecognizer();
    }
  };

  const launchWakeWordRecognizer = () => {
    if (!wakeWordShouldRunRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.continuous = true;

    rec.onresult = (ev: any) => {
      const result = ev.results[ev.resultIndex];
      if (!result || !result.isFinal) return;
      const transcript: string = result[0].transcript || '';
      const match = transcript.match(WAKE_WORD_REGEX);
      if (!match) return;

      const afterWake = transcript.slice((match.index || 0) + match[0].length).trim();
      stopWakeWordRecognizer();
      if (afterWake) {
        processVoiceCommand(afterWake).finally(() => {
          if (wakeWordShouldRunRef.current) launchWakeWordRecognizer();
        });
      } else {
        speak('네, 말씀하세요');
        captureFollowUpCommand();
      }
    };
    rec.onerror = () => {
      wakeWordRecognitionRef.current = null;
      if (wakeWordShouldRunRef.current) setTimeout(launchWakeWordRecognizer, 500);
    };
    rec.onend = () => {
      wakeWordRecognitionRef.current = null;
      if (wakeWordShouldRunRef.current) setTimeout(launchWakeWordRecognizer, 300);
    };

    wakeWordRecognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      wakeWordRecognitionRef.current = null;
    }
  };

  const startWakeWordListening = async () => {
    if (isNativeApp()) {
      const granted = await ensureVoicePermission();
      if (!granted) {
        alert('마이크 권한이 필요해요. 설정에서 피콕타임의 마이크 접근을 허용해주세요.');
        return;
      }
      wakeWordShouldRunRef.current = true;
      localStorage.setItem(WAKE_WORD_PREF_KEY, 'true');
      setIsWakeWordActive(true);
      runNativeWakeLoop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
      return;
    }
    wakeWordShouldRunRef.current = true;
    localStorage.setItem(WAKE_WORD_PREF_KEY, 'true');
    setIsWakeWordActive(true);
    launchWakeWordRecognizer();
  };

  const stopWakeWordListening = () => {
    wakeWordShouldRunRef.current = false;
    localStorage.setItem(WAKE_WORD_PREF_KEY, 'false');
    setIsWakeWordActive(false);
    if (isNativeApp()) stopNativeListening();
    else stopWakeWordRecognizer();
  };

  const toggleWakeWordListening = () => {
    if (isWakeWordActive) stopWakeWordListening();
    else startWakeWordListening();
  };

  useEffect(() => {
    return () => {
      wakeWordShouldRunRef.current = false;
      if (isNativeApp()) stopNativeListening();
      else stopWakeWordRecognizer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    refreshAll,
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
    isWakeWordActive,
    toggleWakeWordListening,
    recommendations,
    notificationsEnabled,
    requestNotifications,
    disableNotifications,
  };
};
