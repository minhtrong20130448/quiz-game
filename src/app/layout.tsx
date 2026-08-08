import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Quiz trắc nghiệm",
  description: "Web app chơi quiz trắc nghiệm nhiều môn học/chủ đề, chấm điểm và xếp hạng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} min-h-screen antialiased`}>
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
