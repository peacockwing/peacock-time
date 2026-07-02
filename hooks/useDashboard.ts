"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { fetchTabData, updateTabItem } from '../services/tabsService';
import type { ChecklistItem, InventoryItem } from '../types/baby';

const activeFamilyChannels = new Set<string>();

export const useDashboard = () => {
  const router = useRouter();

  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('parent@example.com');
  const [userName, setUserName] = useState<string>('보호자');
  const [activeMenu, setActiveMenu] = useState<'baby-log' | 'prep-list' | 'after-delivery' | 'record-settings' | 'assistant' | 'growth-chart'>('baby-log');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const fetchOtherTabs = async (code: string, tabName: 'checklist' | 'inventory', setter: (value: any) => void) => {
    const data = await fetchTabData(code, tabName);
    if (data.success) setter(data.data);
  };

  useEffect(() => {
    const code = localStorage.getItem('familyCode');
    const email = localStorage.getItem('userEmail') || 'parent@example.com';
    const name = localStorage.getItem('peacock_name') || email.split('@')[0];

    if (!code || code === 'undefined' || code === 'null') {
      localStorage.removeItem('familyCode');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('peacock_name');
      router.push('/login');
      return;
    }

    setFamilyCode(code);
    setUserEmail(email);
    setUserName(name);

    fetchOtherTabs(code, 'checklist', setChecklist);
    fetchOtherTabs(code, 'inventory', setInventory);
  }, [router]);

  useEffect(() => {
    if (!familyCode || familyCode === 'undefined' || familyCode === 'null') return;
    if (activeFamilyChannels.has(familyCode)) return;
    activeFamilyChannels.add(familyCode);

    const channelName = `peacock-tabs-${familyCode}`;
    const extractIdFromPayload = (payload: any) => payload?.old?.id ?? payload?.record?.id ?? payload?.new?.id ?? payload?.id ?? null;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        setChecklist((prev) => [...prev, payload.new as ChecklistItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        setChecklist((prev) => prev.map((item) => (Number(item.id) === Number(payload.new.id) ? (payload.new as ChecklistItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checklist', filter: `family_code=eq.${familyCode}` }, (payload) => {
        const deletedId = extractIdFromPayload(payload);
        if (deletedId == null) return;
        setChecklist((prev) => prev.filter((item) => String(item.id) !== String(deletedId)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        setInventory((prev) => [...prev, payload.new as InventoryItem]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        setInventory((prev) => prev.map((item) => (Number(item.id) === Number(payload.new.id) ? (payload.new as InventoryItem) : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventory', filter: `family_code=eq.${familyCode}` }, (payload) => {
        const deletedId = extractIdFromPayload(payload);
        if (deletedId == null) return;
        setInventory((prev) => prev.filter((item) => String(item.id) !== String(deletedId)));
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('failed to remove supabase channel', e);
      }
      activeFamilyChannels.delete(familyCode);
    };
  }, [familyCode]);

  const handleChecklistToggle = async (id: number, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, is_completed: nextStatus } : item)));

    const response = await updateTabItem({ familyCode: familyCode!, targetTab: 'checklist', id, isCompleted: nextStatus });
    if (!response.success) {
      console.error('체크리스트 업데이트 실패:', response.error);
    }
  };

  const handleInventoryStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'READY' ? 'BOUGHT' : currentStatus === 'BOUGHT' ? 'GIFT' : 'READY';
    setInventory((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));

    const response = await updateTabItem({ familyCode: familyCode!, targetTab: 'inventory', id, status: nextStatus });
    if (!response.success) {
      console.error('인벤토리 상태 업데이트 실패:', response.error);
    }
  };

  const inventorySections = useMemo(() => {
    const sections: Record<string, InventoryItem[]> = {};
    inventory.forEach((item) => {
      if (!sections[item.section_name]) sections[item.section_name] = [];
      sections[item.section_name].push(item);
    });
    return sections;
  }, [inventory]);

  const checklistPeriods = useMemo(() => {
    const periods: Record<string, ChecklistItem[]> = {};
    checklist.forEach((item) => {
      const key = item.period_type ? item.period_type.trim() : '기타';
      if (!periods[key]) periods[key] = [];
      periods[key].push(item);
    });
    return periods;
  }, [checklist]);

  const totalInv = inventory.length;
  const completedInv = inventory.filter((item) => item.status !== 'READY').length;
  const invProgressPct = totalInv > 0 ? Math.round((completedInv / totalInv) * 100) : 0;

  const totalCheck = checklist.length;
  const completedCheck = checklist.filter((item) => item.is_completed === 1).length;
  const checkProgressPct = totalCheck > 0 ? Math.round((completedCheck / totalCheck) * 100) : 0;

  const handleLogout = () => {
    localStorage.removeItem('familyCode');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('peacock_name');
    router.push('/login');
  };

  return {
    familyCode,
    userEmail,
    userName,
    activeMenu,
    isMenuOpen,
    checklist,
    inventory,
    inventorySections,
    invProgressPct,
    totalInv,
    completedInv,
    checklistPeriods,
    checkProgressPct,
    completedCheck,
    totalCheck,
    setActiveMenu,
    setIsMenuOpen,
    handleChecklistToggle,
    handleInventoryStatus,
    handleLogout,
  };
};
