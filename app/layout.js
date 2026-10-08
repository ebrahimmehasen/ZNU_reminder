import './globals.css';

export const metadata = {
  title: 'مواعيدنا | جامعة الزقازيق الأهلية',
  description: 'كالندر مواعيد مشترك لجامعة الزقازيق الأهلية مع تنبيهات على تليجرام',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#121712',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint (light is the default). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('mawaeed:theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded with <link>, not next/font, so the build never needs network access. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
