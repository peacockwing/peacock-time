'use client';

import React from 'react';
import { askAssistant, fetchAssistantHistory, clearAssistantHistory, type AssistantTurn } from '../../services/assistantService';
import { speak } from '../../services/tts';

interface AssistantChatProps {
  familyCode: string;
  userEmail?: string | null;
}

const EXAMPLE_QUESTIONS = [
  '어제 점심에 먹은 이유식 알려줘',
  '요즘 알러지 의심되는 재료 있어?',
  '이번 주 이유식 식단 짜줘',
  '어제 분유 몇 번 먹었어?',
];

export default function AssistantChat({ familyCode, userEmail }: AssistantChatProps) {
  const [history, setHistory] = React.useState<AssistantTurn[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [voiceOutputOn, setVoiceOutputOn] = React.useState(true);
  const [isListening, setIsListening] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const recognitionRef = React.useRef<any | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAssistantHistory(familyCode);
        if (!cancelled && res.success) setHistory(res.messages);
      } catch (e) {
        // 히스토리 로드 실패는 무시하고 빈 대화로 시작
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyCode]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, loading]);

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextHistory: AssistantTurn[] = [...history, { role: 'user', text: trimmed }];
    setHistory(nextHistory);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await askAssistant(familyCode, trimmed, userEmail);
      if (!res.success) throw new Error(res.error || '답변을 가져오지 못했습니다.');
      setHistory([...nextHistory, { role: 'assistant', text: res.answer }]);
      if (voiceOutputOn) speak(res.answer);
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = () => {
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
    rec.onstart = () => setIsListening(true);
    rec.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0].transcript)
        .join('');
      if (transcript.trim()) send(transcript);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const stopVoiceInput = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startNewConversation = async () => {
    setHistory([]);
    window.speechSynthesis?.cancel();
    try {
      await clearAssistantHistory(familyCode);
    } catch (e) {
      // 서버 삭제 실패해도 화면은 이미 비워진 상태로 둔다
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mx-4 -mb-4">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3 py-2">
        {historyLoaded && history.length === 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-xs text-slate-500 text-center">기록을 바탕으로 질문에 답해드려요.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[11px] px-3 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                turn.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-700/60 text-slate-200'
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl px-3.5 py-2.5 text-xs text-slate-400">답변 생성 중…</div>
          </div>
        )}

        {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
      </div>

      <div className="border-t border-slate-800 bg-slate-950 p-3 flex items-center gap-2">
        {history.length > 0 && (
          <button
            onClick={startNewConversation}
            className="shrink-0 text-[10px] px-2 py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold"
          >
            새 대화
          </button>
        )}
        <button
          onClick={() => setVoiceOutputOn((v) => !v)}
          title={voiceOutputOn ? '음성 답변 끄기' : '음성 답변 켜기'}
          className={`shrink-0 rounded-xl px-2.5 py-2.5 text-sm ${voiceOutputOn ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}
        >
          {voiceOutputOn ? '🔊' : '🔇'}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(input);
          }}
          placeholder="예: 어제 이유식 뭐 먹었어?"
          className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
        />
        <button
          onClick={isListening ? stopVoiceInput : startVoiceInput}
          disabled={loading}
          title={isListening ? '음성 인식 중지' : '음성으로 질문하기'}
          className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-bold disabled:opacity-40 ${
            isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
          }`}
        >
          🎤
        </button>
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </div>
  );
}
