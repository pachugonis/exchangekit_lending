"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const navLinks = [
  { href: "#features", label: "Возможности" },
  { href: "#screens", label: "Интерфейс" },
  { href: "#pricing", label: "Цена" },
  { href: "#faq", label: "FAQ" },
];

export default function Header() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-gradient text-white">
            E
          </span>
          ExchangeKit
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-text-muted transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:block"
          >
            Войти
          </Link>
          <Link href="/register" className="btn-cta !px-5 !py-2.5 text-sm">
            Купить лицензию
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
