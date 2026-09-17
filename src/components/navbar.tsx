"use client";

import React from "react";
import Image from "next/image";
import { Sun, Moon, Sparkles, RefreshCw } from "lucide-react";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onRefreshAll: () => void;
  onQuickSimulate: () => void;
  isSimulating?: boolean;
}

export function Navbar({
  darkMode,
  setDarkMode,
  onRefreshAll,
  onQuickSimulate,
  isSimulating = false
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/85 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85 sm:px-6 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden shadow-xs hover:scale-105 transition-transform bg-zinc-100 dark:bg-zinc-800">
          <Image
            src="/logo.png"
            alt="Mailtion Logo"
            width={40}
            height={40}
            className="h-full w-full object-contain p-1"
            priority
          />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Mailtion
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">

        <button
          onClick={onRefreshAll}
          title="Làm mới dữ liệu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-all active:scale-[0.96]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <button
          onClick={onQuickSimulate}
          disabled={isSimulating}
          className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-amber-500 animate-spin-slow" />
          <span className="hidden sm:inline">Thử nhận mail</span>
          <span className="sm:hidden">Test</span>
        </button>

        <button
          onClick={() => setDarkMode(!darkMode)}
          title="Chuyển chế độ Sáng / Tối"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-all active:scale-[0.96]"
        >
          {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
      </div>
    </header>
  );
}
