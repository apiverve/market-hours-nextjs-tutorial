import type { Metadata, Viewport } from 'next';
import { Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Market Hours | APIVerve Template',
  description: 'Which stock exchanges are open right now, and when the others open, in your own time zone. An APIVerve template.'
};

export const viewport: Viewport = { themeColor: '#f3f1ec' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
