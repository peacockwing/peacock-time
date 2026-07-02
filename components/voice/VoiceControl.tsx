'use client';

import React from 'react';

interface VoiceControlProps {
  isWakeWordActive: boolean;
  toggleWakeWordListening: () => void;
}

export default function VoiceControl({ isWakeWordActive, toggleWakeWordListening }: VoiceControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={toggleWakeWordListening}
        className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-bold w-fit ${isWakeWordActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}
        aria-pressed={isWakeWordActive}
      >
        <span className="text-lg">{isWakeWordActive ? '👂' : '💤'}</span>
        <span className="text-xs">{isWakeWordActive ? '"피콕타임" 대기 중' : '"피콕타임" 호출 켜기'}</span>
      </button>
      <div className="text-[10px] text-slate-400">
        예: "피콕타임, 모유수유 80밀리리터 입력해줘" / "터미타임 30분 입력해줘" · 앱이 켜져있는 동안에만 작동해요
      </div>
    </div>
  );
}
