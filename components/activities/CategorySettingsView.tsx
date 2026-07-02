'use client';

import React from 'react';
import { getCategoryDef } from '../../lib/activityCategories';
import type { CategorySettingEntry, CustomFieldDefinition } from '../../types/activity';

interface CategorySettingsViewProps {
  categorySettings: CategorySettingEntry[];
  customFields: CustomFieldDefinition[];
  onSaveCategorySettings: (next: CategorySettingEntry[]) => void;
  onCreateCustomField: (name: string, unit: string, valueType: 'TEXT' | 'NUMBER') => void;
  onUpdateCustomField: (id: number, payload: { isEnabled?: boolean; displayOrder?: number }) => void;
  onDeleteCustomField: (id: number) => void;
}

const move = <T,>(arr: T[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export default function CategorySettingsView({
  categorySettings,
  customFields,
  onSaveCategorySettings,
  onCreateCustomField,
  onUpdateCustomField,
  onDeleteCustomField,
}: CategorySettingsViewProps) {
  const ordered = categorySettings.slice().sort((a, b) => a.displayOrder - b.displayOrder);

  const applyReorder = (index: number, direction: -1 | 1) => {
    const next = move(ordered, index, index + direction).map((c, i) => ({ ...c, displayOrder: i }));
    onSaveCategorySettings(next);
  };

  const toggleEnabled = (category: string) => {
    const next = ordered.map((c) => (c.category === category ? { ...c, isEnabled: !c.isEnabled } : c));
    onSaveCategorySettings(next);
  };

  const [newName, setNewName] = React.useState('');
  const [newUnit, setNewUnit] = React.useState('');
  const [newValueType, setNewValueType] = React.useState<'TEXT' | 'NUMBER'>('TEXT');

  const submitCustomField = () => {
    if (!newName.trim()) return;
    onCreateCustomField(newName.trim(), newUnit.trim(), newValueType);
    setNewName('');
    setNewUnit('');
    setNewValueType('TEXT');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-500 tracking-widest uppercase px-1">기본 항목 사용/순서</h3>
        <div className="space-y-1.5">
          {ordered.map((c, index) => {
            const def = getCategoryDef(c.category);
            return (
              <div key={c.category} className="bg-slate-800/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">{def?.emoji}</span>
                  <span className={`text-xs font-bold truncate ${c.isEnabled ? 'text-slate-200' : 'text-slate-500'}`}>{c.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => applyReorder(index, -1)} disabled={index === 0} className="w-7 h-7 rounded-lg bg-slate-700 text-slate-200 text-xs disabled:opacity-30">
                    ↑
                  </button>
                  <button
                    onClick={() => applyReorder(index, 1)}
                    disabled={index === ordered.length - 1}
                    className="w-7 h-7 rounded-lg bg-slate-700 text-slate-200 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleEnabled(c.category)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold ml-1 ${c.isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                  >
                    {c.isEnabled ? '사용중' : '미사용'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-500 tracking-widest uppercase px-1">커스텀 항목</h3>
        <div className="space-y-1.5">
          {customFields.length === 0 && <p className="text-[11px] text-slate-500 px-1">아직 만든 커스텀 항목이 없습니다.</p>}
          {customFields.map((c) => (
            <div key={c.id} className="bg-slate-800/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">
                  {c.name} {c.unit ? <span className="text-slate-500 font-normal">({c.unit})</span> : null}
                </p>
                <p className="text-[10px] text-slate-500">{c.value_type === 'NUMBER' ? '숫자값' : '텍스트값'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onUpdateCustomField(c.id, { isEnabled: !c.is_enabled })}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold ${c.is_enabled ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  {c.is_enabled ? '사용중' : '미사용'}
                </button>
                <button onClick={() => onDeleteCustomField(c.id)} className="text-[10px] text-slate-600 hover:text-rose-400 font-bold px-2 py-1.5">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 mt-2">
          <p className="text-[11px] font-bold text-slate-400">새 커스텀 항목 추가</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="항목명 (예: 키재기)"
              className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="단위(선택)"
              className="w-20 shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {(['TEXT', 'NUMBER'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewValueType(t)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold ${newValueType === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {t === 'TEXT' ? '텍스트' : '숫자'}
                </button>
              ))}
            </div>
            <button onClick={submitCustomField} className="ml-auto text-[11px] px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-bold">
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
