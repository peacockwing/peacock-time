'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ActivityFeed from './ActivityFeed';
import type { Activity, CustomFieldDefinition } from '../../types/activity';

interface GrowthChartViewProps {
  activities: Activity[];
  customFields: CustomFieldDefinition[];
  onAddMeasurement: () => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
  onStop: (activity: Activity) => void;
}

const formatAxisDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
const formatTooltipDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

export default function GrowthChartView({ activities, customFields, onAddMeasurement, onEdit, onDelete, onStop }: GrowthChartViewProps) {
  const growthActivities = React.useMemo(
    () => activities.filter((a) => a.category === 'GROWTH').sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [activities]
  );

  const chartData = React.useMemo(
    () =>
      growthActivities.map((a) => ({
        date: a.start_time,
        height: typeof a.detail?.height_cm === 'number' ? a.detail.height_cm : null,
        weight: typeof a.detail?.weight_kg === 'number' ? a.detail.weight_kg : null,
      })),
    [growthActivities]
  );

  const hasHeight = chartData.some((d) => d.height !== null);
  const hasWeight = chartData.some((d) => d.weight !== null);

  return (
    <div className="space-y-5">
      <button
        onClick={onAddMeasurement}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3 text-sm font-bold text-white active:scale-98 transition-transform"
      >
        <span>📏</span> 새 측정 기록
      </button>

      {chartData.length === 0 && <p className="text-center text-xs text-slate-500 py-10">아직 키/몸무게 기록이 없습니다. 위 버튼을 눌러 첫 측정을 기록해보세요.</p>}

      {hasHeight && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-300 mb-3">📏 키 (cm)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                labelFormatter={(v) => formatTooltipDate(v as string)}
                formatter={(value: any) => [`${value}cm`, '키']}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              />
              <Line type="monotone" dataKey="height" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasWeight && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-300 mb-3">⚖️ 몸무게 (kg)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                labelFormatter={(v) => formatTooltipDate(v as string)}
                formatter={(value: any) => [`${value}kg`, '몸무게']}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              />
              <Line type="monotone" dataKey="weight" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {growthActivities.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-300 mb-2">측정 기록</p>
          <ActivityFeed activities={growthActivities} customFields={customFields} onEdit={onEdit} onDelete={onDelete} onStop={onStop} />
        </div>
      )}
    </div>
  );
}
