'use client';

import React from 'react';
import { getCategoryDef, type ActivityCategoryCode } from '../../lib/activityCategories';
import type { CategorySettingEntry, CustomFieldDefinition } from '../../types/activity';

interface QuickGridProps {
  categorySettings: CategorySettingEntry[];
  customFields: CustomFieldDefinition[];
  onPick: (category: ActivityCategoryCode | 'CUSTOM', customFieldId?: number) => void;
}

export default function QuickGrid({ categorySettings, customFields, onPick }: QuickGridProps) {
  const enabledCategories = categorySettings.filter((c) => c.isEnabled).sort((a, b) => a.displayOrder - b.displayOrder);
  const enabledCustomFields = customFields.filter((c) => c.is_enabled).sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="grid grid-cols-4 gap-2">
      {enabledCategories.map((c) => {
        const def = getCategoryDef(c.category);
        return (
          <button
            key={c.category}
            onClick={() => onPick(c.category)}
            className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform"
          >
            <span className="text-lg">{def?.emoji}</span>
            <span className="text-[10px] font-bold text-slate-300">{c.label}</span>
          </button>
        );
      })}
      {enabledCustomFields.map((c) => (
        <button
          key={`custom-${c.id}`}
          onClick={() => onPick('CUSTOM', c.id)}
          className="bg-slate-800/90 border border-slate-700/50 py-3 rounded-xl flex flex-col items-center space-y-1 active:scale-95 transition-transform"
        >
          <span className="text-lg">✏️</span>
          <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center px-1">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
