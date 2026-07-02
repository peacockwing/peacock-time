'use client';

import React from 'react';
import type { CryNeed } from '../../services/activityService';

interface CryAnalysisResultProps {
  emoji: string;
  summary: string;
  urgent: boolean;
  needs: CryNeed[];
}

const CRY_NEED_LABELS: Record<string, { label: string; emoji: string }> = {
  HUNGER: { label: '배고픔', emoji: '🍼' },
  SLEEPY: { label: '졸림/피곤함', emoji: '😴' },
  DISCOMFORT: { label: '불편함', emoji: '😣' },
  PAIN: { label: '통증/이상 신호', emoji: '🚨' },
  GAS: { label: '가스/트림 필요', emoji: '💨' },
  DIAPER: { label: '기저귀', emoji: '🧷' },
  OVERSTIMULATION: { label: '과자극', emoji: '🌀' },
  BOREDOM: { label: '지루함', emoji: '🧸' },
  UNKNOWN: { label: '판단 어려움', emoji: '❓' },
};

const LIKELIHOOD_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' };
const LIKELIHOOD_CLASS: Record<string, string> = {
  high: 'bg-indigo-600 text-white',
  medium: 'bg-slate-700 text-slate-200',
  low: 'bg-slate-800 text-slate-400',
};

export default function CryAnalysisResult({ emoji, summary, urgent, needs }: CryAnalysisResultProps) {
  return (
    <div className={`p-3 rounded-xl space-y-2.5 ${urgent ? 'bg-rose-950/40 border border-rose-500/40' : 'bg-indigo-950/40 border border-indigo-500/30'}`}>
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{emoji}</span>
        <p className={`text-xs font-black flex-1 ${urgent ? 'text-rose-300' : 'text-indigo-300'}`}>{summary}</p>
      </div>

      {urgent && (
        <p className="text-[10px] font-bold text-rose-300 bg-rose-900/40 rounded-lg px-2.5 py-1.5">
          🚨 통증에 가까운 울음 특징이 감지됐어요. 아기 상태를 바로 확인해보시고, 계속되면 소아과 상담을 권해요.
        </p>
      )}

      <div className="space-y-1.5">
        {needs.map((need, i) => {
          const meta = CRY_NEED_LABELS[need.type] || CRY_NEED_LABELS.UNKNOWN;
          return (
            <div key={i} className="flex items-start gap-2 bg-slate-900/60 rounded-lg px-2.5 py-2">
              <span className="text-sm shrink-0">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-200">{meta.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${LIKELIHOOD_CLASS[need.likelihood]}`}>
                    {LIKELIHOOD_LABEL[need.likelihood]}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{need.reasoning}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-slate-500 leading-relaxed">ⓘ 의학적 진단이 아니며 참고용이에요. 평소와 다른 울음이 계속되면 소아과 상담을 권해요.</p>
    </div>
  );
}
