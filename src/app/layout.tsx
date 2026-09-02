import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "文脉 | 技术文档精读助手",
  description: "基于真实来源的技术文档精读工作区",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
