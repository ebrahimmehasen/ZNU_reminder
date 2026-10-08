import './globals.css';

export const metadata = {
  title: 'مواعيدنا | جامعة الزقازيق الأهلية',
  description: 'كالندر مواعيد مشترك لجامعة الزقازيق الأهلية مع تنبيهات على تليجرام',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0d100c' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded with <link>, not next/font, so the build never needs network access. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
