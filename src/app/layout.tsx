import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${SITE.name} | 분양 상담`,
  description: `${SITE.name}(${SITE.nameNote}) 단지 안내와 분양 상담 문의`,
};

export const viewport: Viewport = {
  themeColor: "#1f3a33",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
