'use client';

import React from 'react';
import type { CategorySettingEntry, Recommendation } from '../../types/activity';

interface RecommendationBarProps {
  recommendations: Recommendation[];
  categorySettings: CategorySettingEntry[];
  notificationsEnabled: boolean;
  onRequestNotifications: () => void;
  onDisableNotifications: () => void;
}

const formatEta = (predictedNextTime: string) => {
  const diffMinutes = Math.round((new Date(predictedNextTime).getTime() - Date.now()) / 60000);
  if (diffMinutes <= 0) return '지금';
  if (diffMinutes < 60) return `${diffMinutes}분 후`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분 후` : `${hours}시간 후`;
};

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function RecommendationBar({
  recommendations,
  categorySettings,
  notificationsEnabled,
  onRequestNotifications,
  onDisableNotifications,
}: RecommendationBarProps) {
  const enabledCodes = new Set(categorySettings.filter((c) => c.isEnabled).map((c) => c.category));
  const visible = recommendations.filter((r) => enabledCodes.has(r.category)).slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-slate-500 tracking-widest uppercase">다음 예상 시간</h3>
        <button
          onClick={notificationsEnabled ? onDisableNotifications : onRequestNotifications}
          className={`text-[10px] px-2 py-1 rounded-full font-bold ${notificationsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          {notificationsEnabled ? '🔔 알림 켜짐' : '🔕 알림 받기'}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((r) => (
          <div key={r.category} className="shrink-0 bg-slate-800/80 border border-slate-700/50 rounded-2xl px-3 py-2 min-w-[112px]">
            <p className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
              {r.emoji} {r.label}
            </p>
            <p className="text-xs font-black text-indigo-300 font-mono">{formatTime(r.predictedNextTime)}</p>
            <p className="text-[9px] text-slate-500 whitespace-nowrap">{formatEta(r.predictedNextTime)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
