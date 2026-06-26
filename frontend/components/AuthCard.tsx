"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center px-5 py-16">
      <div className="hero-aurora opacity-60" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass glass-glow relative w-full max-w-md p-8"
      >
        <Link href="/" className="mb-8 flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-gradient text-white">
            E
          </span>
          ExchangeKit
        </Link>

        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-text-muted">{subtitle}</p>}

        <div className="mt-7">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
      </motion.div>
    </main>
  );
}
