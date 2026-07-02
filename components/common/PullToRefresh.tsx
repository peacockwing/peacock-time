'use client';

import React from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const MIN_VISIBLE_MS = 400;

// Touch-only (this is a mobile app) drag-down-to-refresh, active only when
// the container is scrolled to the very top so it never fights normal
// scrolling. Pure touch-event JS - no native plugin needed, works the same
// in a browser tab and inside the Capacitor WebView shell.
export default function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const startYRef = React.useRef<number | null>(null);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Resistance curve so it gets progressively harder to pull further.
    setPullDistance(Math.min(MAX_PULL, delta * 0.45));
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;
    setIsDragging(false);
    startYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      const startedAt = Date.now();
      try {
        await onRefresh();
      } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_VISIBLE_MS) await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`flex items-center justify-center overflow-hidden ${isDragging ? '' : 'transition-[height] duration-200'}`}
        style={{ height: pullDistance }}
      >
        <div
          className={`w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { opacity: progress, transform: `rotate(${progress * 360}deg)` } : undefined}
        />
      </div>
      {children}
    </div>
  );
}
