'use client';

import React from 'react';
import { getCategoryDef } from '../../lib/activityCategories';
import { summarizeActivity } from '../../lib/activitySummary';
import type { Activity, CustomFieldDefinition } from '../../types/activity';

interface ActivityFeedProps {
  activities: Activity[];
  customFields: CustomFieldDefinition[];
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
  onStop: (activity: Activity) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

export default function ActivityFeed({ activities, customFields, onEdit, onDelete, onStop }: ActivityFeedProps) {
  const groups = React.useMemo(() => {
    const out: Record<string, Activity[]> = {};
    activities.forEach((a) => {
      const key = new Date(a.start_time).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!out[key]) out[key] = [];
      out[key].push(a);
    });
    return out;
  }, [activities]);

  if (activities.length === 0) {
    return <p className="text-center text-xs text-slate-500 py-10">아직 기록이 없습니다. 위 버튼을 눌러 기록을 시작해보세요.</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([dateKey, items]) => (
        <div key={dateKey} className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 bg-slate-950/20 px-3 py-1 rounded-full inline-block">{dateKey}</div>
          <div className="space-y-2 pt-1">
            {items.map((item) => {
              const def = item.category !== 'CUSTOM' ? getCategoryDef(item.category) : undefined;
              const emoji = def?.emoji || '📝';
              const label = def?.label || '커스텀';
              const inProgress = !item.end_time;
              return (
                <div key={item.id} className="bg-slate-800/60 border border-slate-800/80 p-3.5 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-xl bg-slate-950/60 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-800 shrink-0">
                        {emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {label} - <span className="text-indigo-400 font-mono">{summarizeActivity(item, customFields)}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatTime(item.start_time)}
                          {item.end_time ? ` ~ ${formatTime(item.end_time)}` : ' · 진행중'}
                          {item.actor_email ? <span className="text-slate-600"> · {item.actor_email.split('@')[0]}</span> : null}
                        </p>
                        {item.hashtags.length > 0 && (
                          <p className="text-[10px] text-indigo-400/80 mt-0.5">{item.hashtags.map((h) => `#${h}`).join(' ')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {inProgress && (
                        <button className="text-[10px] text-white bg-amber-600 hover:bg-amber-500 rounded-full px-2 py-1 font-bold" onClick={() => onStop(item)}>
                          종료
                        </button>
                      )}
                      <button className="text-[10px] text-slate-200 bg-slate-700/90 hover:bg-slate-700 rounded-full px-2 py-1 font-bold" onClick={() => onEdit(item)}>
                        수정 ✎
                      </button>
                      <button className="text-[10px] text-slate-600 hover:text-rose-400 font-bold px-2 py-1" onClick={() => onDelete(item.id)}>
                        삭제 ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
