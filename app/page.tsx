'use client';

import React, { Suspense } from 'react';
import DashboardView from '../components/dashboard/DashboardView';

// Wrap client component using useSearchParams in Suspense to avoid CSR bailout during prerender
export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <DashboardView />
    </Suspense>
  );
}
