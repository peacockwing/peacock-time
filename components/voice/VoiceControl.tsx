'use client';

import React from 'react';
import { useDashboard } from '../../hooks/useDashboard';

export default function VoiceControl() {
  const { startVoiceCommand, stopVoiceCommand, isVoiceListening } = useDashboard();

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => (isVoiceListening ? stopVoiceCommand() : startVoiceCommand())}
        className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-bold ${isVoiceListening ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'}`}
        aria-pressed={isVoiceListening}
      >
        <span className="text-lg">{isVoiceListening ? '🎤' : '🟢'}</span>
        <span className="text-xs">{isVoiceListening ? '음성 듣는 중… 중지' : '음성으로 입력'}</span>
      </button>
      <div className="text-[10px] text-slate-400">예: "분유 60ml 입력해죠"</div>
    </div>
  );
}
