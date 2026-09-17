"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Sparkles,
  Mail,
  Inbox,
  Send,
  KeyRound,
  Cloud,
  Settings as SettingsIcon,
  X
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ToastProvider, useToast } from "@/components/toast";
import { TabOverview } from "@/components/tab-overview";
import { TabGenerator } from "@/components/tab-generator";
import { TabMailboxes } from "@/components/tab-mailboxes";
import { TabInbox } from "@/components/tab-inbox";
import { TabWebhooks } from "@/components/tab-webhooks";
import { TabApiKeys } from "@/components/tab-api-keys";
import { TabCloudflare } from "@/components/tab-cloudflare";
import { TabSettings } from "@/components/tab-settings";

interface StatsData {
  totalMailboxes: number;
  activeMailboxes: number;
  totalMessages: number;
  unreadMessages: number;
  todayMessages: number;
  tags: { tag: string; count: number }[];
}

interface MessageItem {
  id: string;
  from_addr: string;
  from_name: string | null;
  to_addr: string;
  subject: string;
  is_read: number;
  otp_code: string | null;
  created_at: string;
}

function DashboardContent() {
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessageItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [inboxFilterAddress, setInboxFilterAddress] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [simService, setSimService] = useState<string>("Google");
  const [simTargetMailbox, setSimTargetMailbox] = useState<string>("");

  // Dark mode initialization & toggle
  useEffect(() => {
    const saved = localStorage.getItem("mailtion_theme");
    if (saved) {
      setDarkMode(saved === "dark");
    } else if (typeof window !== "undefined") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("mailtion_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("mailtion_theme", "light");
    }
  }, [darkMode]);

  // Fetch stats and recent messages
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, messagesRes] = await Promise.all([
        fetch("/api/v1/stats"),
        fetch("/api/v1/messages?limit=6"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setRecentMessages(messagesData.items || []);
      }
    } catch {
      // Background fetch error silenced
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const handleRefreshAll = () => {
    setRefreshTrigger((prev) => prev + 1);
    toast("Đã làm mới dữ liệu");
  };

  const handleOpenInboxForMailbox = (address: string) => {
    setInboxFilterAddress(address);
    setActiveTab("inbox");
  };

  const handleQuickSimulate = () => {
    setShowSimModal(true);
  };

  const executeSimulate = async () => {
    setIsSimulating(true);
    try {
      const target = simTargetMailbox.trim() || "demo@mailtion.com";
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: target,
          service: simService,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Đã gửi email thử nghiệm (${simService}) tới ${target}!`, "success");
        setShowSimModal(false);
        setRefreshTrigger((prev) => prev + 1);
        setActiveTab("inbox");
      } else {
        toast(data.error || "Lỗi mô phỏng", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleQuickGenerateFromOverview = async (count: number) => {
    try {
      const res = await fetch("/api/v1/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          mode: "random",
          count,
          prefix: "quick",
        }),
      });
      if (res.ok) {
        toast(`Đã tạo nhanh ${count} địa chỉ mail ngẫu nhiên!`, "success");
        setRefreshTrigger((prev) => prev + 1);
        setActiveTab("mailboxes");
      }
    } catch {
      toast("Lỗi tạo nhanh", "error");
    }
  };

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "generator", label: "Tạo hàng loạt", icon: Sparkles },
    { id: "mailboxes", label: "Hộp thư", icon: Mail, badge: stats?.activeMailboxes },
    {
      id: "inbox",
      label: "Hộp thư đến",
      icon: Inbox,
      badge: stats && stats.unreadMessages > 0 ? `${stats.unreadMessages} mới` : undefined,
      badgeColor: "bg-blue-500 text-white",
    },
    { id: "webhooks", label: "Thông báo & Bot", icon: Send },
    { id: "apikeys", label: "Khóa API", icon: KeyRound },
    { id: "cloudflare", label: "Cloudflare", icon: Cloud },
    { id: "settings", label: "Cài đặt", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onRefreshAll={handleRefreshAll}
        onQuickSimulate={handleQuickSimulate}
        isSimulating={isSimulating}
      />

      {/* Main Container with Left Sidebar & Content */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 2-Column Layout: Left Sidebar Menu + Right Content Panel */}
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
          {/* Left Column Navigation */}
          <aside className="w-full md:w-60 lg:w-64 shrink-0 overflow-x-hidden">
            <nav className="flex flex-wrap md:flex-col gap-1.5 text-sm font-medium overflow-x-hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors shrink-0 md:w-full active:scale-[0.98] ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900 font-bold dark:bg-zinc-800 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4.5 w-4.5 transition-colors ${
                          isActive
                            ? "text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      />
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          tab.badgeColor ||
                          "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Status Pill in Sidebar for Desktop */}
            <div className="hidden md:block mt-6 p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 text-xs text-zinc-500 space-y-2.5 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between">
                <span>Miền tiếp nhận:</span>
                <strong className="font-mono text-zinc-800 dark:text-zinc-200 text-xs">mailtion.com</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Cơ sở dữ liệu:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 text-xs">SQLite (WAL)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Worker Inbound:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">Sẵn sàng</span>
              </div>
            </div>
          </aside>

          {/* Right Column: Tab Content Panels */}
          <div className="flex-1 w-full min-w-0">
            {activeTab === "overview" && (
              <TabOverview
                stats={stats}
                recentMessages={recentMessages}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenMessage={() => setActiveTab("inbox")}
                onQuickGenerate={handleQuickGenerateFromOverview}
              />
            )}

            {activeTab === "generator" && (
              <TabGenerator
                onSuccessCreated={() => {
                  setRefreshTrigger((prev) => prev + 1);
                }}
                onNavigateToMailboxes={() => setActiveTab("mailboxes")}
              />
            )}

            {activeTab === "mailboxes" && (
              <TabMailboxes
                onOpenInboxForMailbox={handleOpenInboxForMailbox}
                refreshTrigger={refreshTrigger}
              />
            )}

            {activeTab === "inbox" && (
              <TabInbox
                initialFilterAddress={inboxFilterAddress}
                onClearAddressFilter={() => setInboxFilterAddress("")}
                refreshTrigger={refreshTrigger}
              />
            )}

            {activeTab === "webhooks" && <TabWebhooks />}

            {activeTab === "apikeys" && <TabApiKeys />}

            {activeTab === "cloudflare" && <TabCloudflare />}

            {activeTab === "settings" && <TabSettings />}
          </div>
        </div>
      </main>

      {/* Quick Simulate Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Thử nghiệm Nhận Email Ngay
                </h3>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Địa chỉ email nhận
                </label>
                <input
                  type="text"
                  value={simTargetMailbox}
                  onChange={(e) => setSimTargetMailbox(e.target.value)}
                  placeholder="demo@mailtion.com"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Mẫu dịch vụ gửi mã OTP
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {["Google", "TikTok"].map((srv) => (
                    <button
                      key={srv}
                      type="button"
                      onClick={() => setSimService(srv)}
                      className={`rounded-lg border p-2.5 text-xs font-medium text-center transition-colors ${
                        simService === srv
                          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      {srv}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={executeSimulate}
                  disabled={isSimulating}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  <span>{isSimulating ? "Đang gửi..." : "Gửi email ngay"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
