'use client';

import React from 'react';
import { getCategoryDef, type ActivityCategoryCode } from '../../lib/activityCategories';
import type { Activity, CustomFieldDefinition } from '../../types/activity';

// Formats a Date for an <input type="datetime-local"> value in local time.
const toLocalInputValue = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ActivityFormProps {
  category: ActivityCategoryCode | 'CUSTOM';
  customFields: CustomFieldDefinition[];
  existingActivity?: Activity;
  onSubmit: (payload: {
    startTime: string;
    endTime: string | null;
    memo?: string;
    hashtags: string[];
    detail: Record<string, any>;
  }) => Promise<void>;
  onClose: () => void;
}

export default function ActivityForm({ category, customFields, existingActivity, onSubmit, onClose }: ActivityFormProps) {
  const def = category !== 'CUSTOM' ? getCategoryDef(category) : undefined;
  const isEditing = Boolean(existingActivity);

  const [startTime, setStartTime] = React.useState(toLocalInputValue(existingActivity?.start_time));
  const [inProgress, setInProgress] = React.useState(!existingActivity || !existingActivity.end_time);
  const [endTime, setEndTime] = React.useState(toLocalInputValue(existingActivity?.end_time || existingActivity?.start_time));
  const [hashtagInput, setHashtagInput] = React.useState((existingActivity?.hashtags || []).join(' '));
  const [fields, setFields] = React.useState<Record<string, any>>(existingActivity?.detail || {});
  const [customDefinitionId, setCustomDefinitionId] = React.useState<number | ''>(
    existingActivity?.detail?.definition_id || (customFields[0]?.id ?? '')
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setField = (key: string, value: any) => setFields((prev) => ({ ...prev, [key]: value }));

  const selectedCustomDef = customFields.find((c) => c.id === customDefinitionId);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const hashtags = hashtagInput
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean);

      let detail: Record<string, any> = fields;
      if (category === 'CUSTOM') {
        if (!customDefinitionId) throw new Error('커스텀 항목을 선택해주세요.');
        detail =
          selectedCustomDef?.value_type === 'NUMBER'
            ? { definitionId: customDefinitionId, valueNumber: Number(fields.valueNumber) }
            : { definitionId: customDefinitionId, valueText: fields.valueText || '' };
      }

      await onSubmit({
        startTime: new Date(startTime).toISOString(),
        endTime: inProgress ? null : new Date(endTime).toISOString(),
        hashtags,
        detail,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = category === 'CUSTOM' ? selectedCustomDef?.name || '커스텀 기록' : `${def?.emoji ?? ''} ${def?.label ?? category}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center max-w-md mx-auto" onClick={onClose}>
      <div
        className="bg-slate-800 w-full max-h-[85vh] overflow-y-auto p-5 rounded-t-3xl border-t border-slate-700 space-y-4 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-white">{isEditing ? `${title} 수정` : `${title} 기록`}</h3>
          <button onClick={onClose} className="text-slate-400 text-xs p-1">
            닫기 ✕
          </button>
        </div>

        {category === 'CUSTOM' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">항목</label>
            <select
              value={customDefinitionId}
              onChange={(e) => setCustomDefinitionId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              {customFields.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.unit ? ` (${c.unit})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">시작</label>
            <div className="flex gap-1.5">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setStartTime(toLocalInputValue())}
                className="shrink-0 px-2 rounded-xl bg-slate-700 text-[11px] text-slate-200 font-bold"
              >
                지금
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em] flex items-center justify-between">
              <span>종료</span>
              <button
                type="button"
                onClick={() => setInProgress((v) => !v)}
                className={`text-[10px] px-2 py-0.5 rounded-full ${inProgress ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                {inProgress ? '진행중' : '종료됨'}
              </button>
            </label>
            {!inProgress && (
              <div className="flex gap-1.5">
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setEndTime(toLocalInputValue())}
                  className="shrink-0 px-2 rounded-xl bg-slate-700 text-[11px] text-slate-200 font-bold"
                >
                  지금
                </button>
              </div>
            )}
          </div>
        </div>

        {category === 'CUSTOM' ? (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">
              값{selectedCustomDef?.unit ? ` (${selectedCustomDef.unit})` : ''}
            </label>
            {selectedCustomDef?.value_type === 'NUMBER' ? (
              <input
                type="number"
                value={fields.valueNumber ?? ''}
                onChange={(e) => setField('valueNumber', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
            ) : (
              <input
                value={fields.valueText ?? ''}
                onChange={(e) => setField('valueText', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
            )}
          </div>
        ) : (
          def?.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">
                {f.label}
                {f.unit ? ` (${f.unit})` : ''}
                {f.required ? <span className="text-rose-400"> *</span> : null}
              </label>

              {f.type === 'select' && (
                <div className="flex flex-wrap gap-1.5">
                  {f.options?.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField(f.key, opt.value)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                        fields[f.key] === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {f.type === 'number' && (
                <input
                  type="number"
                  disabled={f.computed}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.computed ? '자동 계산' : f.placeholder}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              )}

              {f.type === 'text' && (
                <input
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              )}

              {f.type === 'textarea' && (
                <textarea
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              )}
            </div>
          ))
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">해시태그</label>
          <input
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            placeholder="예: 컨디션좋음 새로운시도"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
          />
          <p className="text-[10px] text-slate-500">공백으로 구분해서 여러 개 입력할 수 있어요.</p>
        </div>

        {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
