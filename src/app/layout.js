import { Geist } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context.js";
import { ThemeProvider } from "@/lib/theme/context.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Leeway",
  description: "Share safely with your closest person",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  themeColor: "#059669",
  appleWebApp: {
    capable: true,
    title: "Leeway",
    statusBarStyle: "default",
  },
};

// Set data-theme BEFORE React hydrates so the page doesn't flash the wrong
// palette on first paint. Reading the same storage key and system
// preference the ThemeProvider uses means the two never disagree.
const themeBootstrap = `(() => {
  try {
    const stored = localStorage.getItem('leeway.theme');
    if (stored === 'dark' || stored === 'light' || stored === 'sunrise' || stored === 'serene') {
      document.documentElement.dataset.theme = stored;
      return;
    }
  } catch (_) {}
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
      return;
    }
  } catch (_) {}
  document.documentElement.dataset.theme = 'light';
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
