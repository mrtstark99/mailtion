"use client";

import React from "react";
import Image from "next/image";
import { Sun, Moon, RefreshCw, LogOut, User, Send, Globe, ShieldCheck, Plus } from "lucide-react";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onRefreshAll: () => void;
  onOpenCompose?: () => void;
  onOpenAddMailbox?: () => void;
  onOpenDashboard?: () => void;
  isDashboardActive?: boolean;
  onViewLanding?: () => void;
  onNavigateProfile?: () => void;
  currentUser?: { username: string; role: string } | null;
}

export function Navbar({
  darkMode,
  setDarkMode,
  onRefreshAll,
  onOpenCompose,
  onOpenAddMailbox,
  onOpenDashboard,
  isDashboardActive,
  onViewLanding,
  onNavigateProfile,
  currentUser,
}: NavbarProps) {
  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85 transition-colors font-sans">
      <div className="mx-auto flex h-14 sm:h-16 w-full max-w-screen-2xl items-center justify-between px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl overflow-hidden shadow-xs hover:scale-105 transition-transform bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
            onClick={onViewLanding}
            title="Mailtion Home"
          >
            <Image
              src="/logo.png"
              alt="Mailtion Logo"
              width={36}
              height={36}
              className="h-full w-full object-contain p-1"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Mailtion
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {onViewLanding && (
            <button
              onClick={onViewLanding}
              title="View Home Landing Page"
              className="flex h-8 sm:h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 sm:px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-[0.96] cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}

          {isAdmin && onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              title="User & System Management"
              className={`flex h-8 sm:h-9 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold shadow-xs active:scale-[0.96] transition-all cursor-pointer ${
                isDashboardActive
                  ? "bg-purple-600 text-white shadow-purple-500/25"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800/60"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Dashboard</span>
              <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-purple-200/80 dark:bg-purple-800 text-purple-800 dark:text-purple-200 font-bold uppercase">
                Admin
              </span>
            </button>
          )}

          {isAdmin && onOpenCompose && (
            <button
              onClick={onOpenCompose}
              title="Compose and send email"
              className="flex h-8 sm:h-9 items-center gap-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2.5 sm:px-3 text-xs font-semibold hover:opacity-90 shadow-xs active:scale-[0.96] transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compose</span>
            </button>
          )}

          {onOpenAddMailbox && (
            <button
              onClick={onOpenAddMailbox}
              title="Add New Email Address"
              className="flex h-8 sm:h-9 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 text-xs font-semibold shadow-xs active:scale-[0.96] transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add Mail</span>
            </button>
          )}

          <button
            onClick={onRefreshAll}
            title="Refresh data"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-[0.96] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle Light / Dark mode"
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-[0.96] cursor-pointer"
          >
            {darkMode ? <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-amber-400" /> : <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
          </button>

          {/* User Profile button & Logout */}
          <div className="flex items-center pl-1 border-l border-zinc-200 dark:border-zinc-800 gap-1.5">
            <button
              onClick={onNavigateProfile}
              title="Account Profile & Settings"
              className="flex h-8 sm:h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 sm:px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-[0.96] cursor-pointer"
            >
              <User className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="max-w-[120px] truncate">{currentUser?.username || "Profile"}</span>
            </button>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:hover:border-red-900/50 transition-all active:scale-[0.96] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
