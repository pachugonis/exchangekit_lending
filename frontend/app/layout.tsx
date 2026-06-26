import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ExchangeKit — софт для криптообменника. Пожизненная лицензия",
  description:
    "ExchangeKit — готовый софт для криптообменника и обмена электронных денег. Одна пожизненная лицензия, бесплатные обновления, поддержка. 29 900 ₽.",
  openGraph: {
    title: "ExchangeKit — пожизненная лицензия на софт обменника",
    description:
      "Запустите свой криптообменник на ExchangeKit. Пожизненная лицензия, обновления включены.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
