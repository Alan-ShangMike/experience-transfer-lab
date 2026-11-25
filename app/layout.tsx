import type { Metadata } from "next";
import "./globals.css";
import "./controls.css";
import "./scenes.css";
import "./report.css";
import { Effects } from "./effects";

export const metadata: Metadata = {
  title: "经验迁移 Lab · 经验适用性分析",
  description: "找出他人经验的适用条件，规划自己的下一步。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Effects />
      </body>
    </html>
  );
}
