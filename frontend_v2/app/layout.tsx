import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EngageX — AI Classroom Co-pilot',
  description:
    'Real-time agentic AI engagement tracking for online classrooms.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
