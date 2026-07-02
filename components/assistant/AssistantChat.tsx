'use client';

import React from 'react';
import {
  askAssistant,
  fetchConversations,
  fetchConversationMessages,
  deleteConversation,
  type AssistantTurn,
  type AssistantConversationSummary,
} from '../../services/assistantService';
import { speak } from '../../services/tts';

interface AssistantChatProps {
  familyCode: string;
  userEmail?: string | null;
  onClose?: () => void;
}

const EXAMPLE_QUESTIONS = [
  '어제 점심에 먹은 이유식 알려줘',
  '요즘 알러지 의심되는 재료 있어?',
  '이번 주 이유식 식단 짜줘',
  '어제 분유 몇 번 먹었어?',
];

export default function AssistantChat({ familyCode, userEmail, onClose }: AssistantChatProps) {
  const [conversations, setConversations] = React.useState<AssistantConversationSummary[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeTitle, setActiveTitle] = React.useState<string>('새 대화');
  const [history, setHistory] = React.useState<AssistantTurn[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [switchingConv, setSwitchingConv] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [voiceOutputOn, setVoiceOutputOn] = React.useState(true);
  const [isListening, setIsListening] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const recognitionRef = React.useRef<any | null>(null);

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetchConversations(familyCode);
      if (res.success) setConversations(res.conversations);
    } catch (e) {
      // 목록 로드 실패는 조용히 무시 (새 대화는 계속 가능)
    }
  }, [familyCode]);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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

  const selectConversation = async (id: string) => {
    if (id === activeId) {
      setSidebarOpen(false);
      return;
    }
    window.speechSynthesis?.cancel();
    setSwitchingConv(true);
    setSidebarOpen(false);
    try {
      const res = await fetchConversationMessages(familyCode, id);
      if (!res.success) throw new Error(res.error);
      setActiveId(id);
      setActiveTitle(res.title);
      setHistory(res.messages);
    } catch (e) {
      setError('대화를 불러오지 못했습니다.');
    } finally {
      setSwitchingConv(false);
    }
  };

  const startNewConversation = () => {
    window.speechSynthesis?.cancel();
    setActiveId(null);
    setActiveTitle('새 대화');
    setHistory([]);
    setError(null);
    setSidebarOpen(false);
  };

  const removeConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 대화를 삭제할까요?')) return;
    try {
      await deleteConversation(familyCode, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewConversation();
    } catch (e) {
      setError('대화 삭제에 실패했습니다.');
    }
  };

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextHistory: AssistantTurn[] = [...history, { role: 'user', text: trimmed }];
    setHistory(nextHistory);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await askAssistant(familyCode, trimmed, activeId, userEmail);
      if (!res.success) throw new Error(res.error || '답변을 가져오지 못했습니다.');
      setHistory([...nextHistory, { role: 'assistant', text: res.answer }]);
      setActiveId(res.conversationId);
      if (res.title) setActiveTitle(res.title);
      if (voiceOutputOn) speak(res.answer);
      loadConversations();
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

  const formatRelativeDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative flex h-full overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[80vw] bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center gap-2 justify-center rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-bold text-white"
          >
            <span>＋</span> 새 대화
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center pt-6">대화 기록이 없어요.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`group flex items-center gap-2 mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer ${
                c.id === activeId ? 'bg-slate-800' : 'hover:bg-slate-900'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{c.title}</p>
                <p className="text-[10px] text-slate-500">{formatRelativeDate(c.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => removeConversation(c.id, e)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs px-1.5 py-1"
                title="삭제"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-950">
          <button onClick={() => setSidebarOpen(true)} className="shrink-0 text-slate-300 text-lg px-1">
            ☰
          </button>
          <p className="flex-1 min-w-0 truncate text-xs font-bold text-slate-300">{activeTitle}</p>
          <button
            onClick={() => setVoiceOutputOn((v) => !v)}
            title={voiceOutputOn ? '음성 답변 끄기' : '음성 답변 켜기'}
            className={`shrink-0 rounded-xl px-2.5 py-1.5 text-sm ${voiceOutputOn ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}
          >
            {voiceOutputOn ? '🔊' : '🔇'}
          </button>
          {onClose && (
            <button onClick={onClose} className="shrink-0 rounded-xl px-2.5 py-1.5 text-sm text-slate-400 hover:text-white">
              ✕
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3 py-3">
          {switchingConv && <p className="text-xs text-slate-500 text-center pt-4">불러오는 중…</p>}

          {!switchingConv && history.length === 0 && (
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

          {!switchingConv &&
            history.map((turn, i) => (
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
    </div>
  );
}
