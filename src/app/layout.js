import { Geist } from "next/font/google";
import "./globals.css";

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
  themeColor: "#4f46e5",
  appleWebApp: {
    capable: true,
    title: "Leeway",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
