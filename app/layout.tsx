// app/layout.tsx
import './globals.css'; // 💥 절대 경로(@/) 대신 상대 경로(./)로 직접 지정
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PEACOCK TIME V2',
  description: '부부 공동 육아 실시간 관제 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}