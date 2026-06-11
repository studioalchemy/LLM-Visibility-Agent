import type { Metadata } from 'next';
import '../styles/tokens.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'AGENT_04 // LLM Share of Voice',
  description: 'LLM Share of Voice & Ad Visibility Agent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="vignette">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
