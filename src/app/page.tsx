"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Sparkles,
  Inbox,
  Send,
  KeyRound,
  Cloud,
  Settings as SettingsIcon,
  UserCircle,
  Users,
  Loader2,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ToastProvider, useToast } from "@/components/toast";
import { TabGenerator } from "@/components/tab-generator";
import { TabMailboxes } from "@/components/tab-mailboxes";
import { TabInbox } from "@/components/tab-inbox";
import { TabWebhooks } from "@/components/tab-webhooks";
import { TabApiKeys } from "@/components/tab-api-keys";
import { TabCloudflare } from "@/components/tab-cloudflare";
import { TabSettings } from "@/components/tab-settings";
import { TabProfile } from "@/components/tab-profile";
import { TabAdminDashboard } from "@/components/tab-admin-dashboard";
import { ComposeModal } from "@/components/compose-modal";
import { LandingPage } from "@/components/landing-page";

interface CurrentUser {
  id: string;
  username: string;
  role: string;
  email?: string;
  maxMailboxes?: number;
}

interface StatsData {
  totalMailboxes: number;
  activeMailboxes: number;
  totalMessages: number;
  unreadMessages: number;
  todayMessages: number;
  otpCount: number;
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLanding, setShowLanding] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mailtion_theme");
      if (saved) return saved === "dark";
    }
    return false; // Default: Light mode
  });
  const [activeTab, setActiveTab] = useState<string>("mailboxes");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessageItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [inboxFilterAddress, setInboxFilterAddress] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);

  // Apply dark class and persist theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("mailtion_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("mailtion_theme", "light");
    }
  }, [darkMode]);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user);
            if (data.user.role === "admin") {
              setActiveTab("admin_users");
            } else {
              setActiveTab("mailboxes");
            }
          } else {
            setCurrentUser(null);
            setShowLanding(true);
          }
        } else {
          setCurrentUser(null);
          setShowLanding(true);
        }
      } catch {
        setCurrentUser(null);
        setShowLanding(true);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Strict guard: Admin accounts cannot display or stay on mailboxes/inbox/overview
  useEffect(() => {
    if (currentUser?.role === "admin" && (activeTab === "mailboxes" || activeTab === "inbox" || activeTab === "overview")) {
      setActiveTab("admin_users");
    }
  }, [currentUser, activeTab]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, messagesRes] = await Promise.all([
        fetch("/api/v1/stats"),
        fetch("/api/v1/messages?limit=5"),
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
    if (!authLoading && currentUser && !showLanding) {
      fetchData();
    }
  }, [fetchData, refreshTrigger, authLoading, currentUser, showLanding]);

  const handleRefreshAll = () => {
    setRefreshTrigger((prev) => prev + 1);
    toast("Data refreshed");
  };

  const handleOpenInboxForMailbox = (address: string) => {
    if (currentUser?.role === "admin") {
      setActiveTab("admin_users");
    } else {
      setInboxFilterAddress(address);
      setActiveTab("inbox");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-900 dark:text-zinc-100" />
      </div>
    );
  }

  // If visitor or explicitly viewing landing page
  if (!currentUser || showLanding) {
    return (
      <LandingPage
        isLoggedIn={Boolean(currentUser)}
        onGoToDashboard={() => setShowLanding(false)}
      />
    );
  }

  const isAdmin = currentUser?.role === "admin";

  // Tab definitions in English
  const userTabs = [
    { id: "mailboxes", label: "Mailboxes", icon: Mail, badge: stats?.activeMailboxes },
    {
      id: "inbox",
      label: "Inbox",
      icon: Inbox,
      badge: stats && stats.unreadMessages > 0 ? `${stats.unreadMessages} new` : undefined,
      badgeColor: "bg-blue-500 text-white",
    },
    { id: "profile", label: "Profile Settings", icon: UserCircle },
  ];

  const adminTabs = [
    {
      id: "admin_users",
      label: "User Management",
      icon: Users,
      badge: "Admin",
      badgeColor: "bg-purple-600 text-white",
    },
    { id: "generator", label: "Bulk Generator", icon: Sparkles },
    { id: "webhooks", label: "Webhooks & Bots", icon: Send },
    { id: "apikeys", label: "API Keys", icon: KeyRound },
    { id: "cloudflare", label: "Cloudflare", icon: Cloud },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "profile", label: "Profile Settings", icon: UserCircle },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onRefreshAll={handleRefreshAll}
        onOpenCompose={isAdmin ? () => setIsComposeOpen(true) : undefined}
        onOpenDashboard={
          isAdmin
            ? () => {
                setActiveTab("admin_users");
                setShowLanding(false);
              }
            : undefined
        }
        isDashboardActive={activeTab === "admin_users" && !showLanding}
        onViewLanding={() => setShowLanding(true)}
        onNavigateProfile={() => {
          setActiveTab("profile");
          setShowLanding(false);
        }}
        currentUser={currentUser}
      />

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row gap-4 lg:gap-8 items-start">
          {/* Sidebar Nav */}
          <aside className="w-full md:w-60 lg:w-64 shrink-0">
            <nav className="flex md:flex-col gap-1.5 text-sm font-medium overflow-x-auto no-scrollbar pb-1 md:pb-0 flex-nowrap scroll-smooth touch-pan-x -mx-3 px-3 md:mx-0 md:px-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-between gap-2.5 sm:gap-3 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-left transition-colors shrink-0 whitespace-nowrap md:w-full active:scale-[0.98] cursor-pointer ${
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                        : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Icon
                        className={`h-4 w-4 sm:h-4.5 sm:w-4.5 transition-colors ${
                          isActive
                            ? "text-white dark:text-zinc-900"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      />
                      <span>{tab.label}</span>
                    </div>

                    {tab.badge !== undefined && (
                      <span
                        className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold ${
                          tab.badgeColor ||
                          (isActive
                            ? "bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200")
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Tab Content */}
          <div className="flex-1 w-full min-w-0">
            {activeTab === "admin_users" && isAdmin && (
              <TabAdminDashboard
                currentUserId={currentUser.id}
                onRefreshAll={handleRefreshAll}
              />
            )}
            {activeTab === "generator" && isAdmin && (
              <TabGenerator
                onGenerated={() => {
                  setRefreshTrigger((prev) => prev + 1);
                }}
              />
            )}
            {activeTab === "mailboxes" && !isAdmin && (
              <TabMailboxes
                onOpenInboxForMailbox={handleOpenInboxForMailbox}
                refreshTrigger={refreshTrigger}
                isAdmin={false}
                maxMailboxes={currentUser?.maxMailboxes ?? 1}
              />
            )}
            {activeTab === "inbox" && !isAdmin && (
              <TabInbox
                refreshTrigger={refreshTrigger}
                initialMailboxFilter={inboxFilterAddress || undefined}
              />
            )}
            {activeTab === "webhooks" && isAdmin && <TabWebhooks />}
            {activeTab === "apikeys" && isAdmin && <TabApiKeys />}
            {activeTab === "cloudflare" && isAdmin && <TabCloudflare />}
            {activeTab === "settings" && isAdmin && <TabSettings />}
            {activeTab === "profile" && <TabProfile />}
          </div>
        </div>
      </main>

      {isAdmin && isComposeOpen && (
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          onSuccess={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
