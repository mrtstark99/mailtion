"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, KeyRound, Check, Loader2, Forward } from "lucide-react";
import { useToast } from "./toast";
import { formatFullDate } from "@/lib/utils";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  recoveryEmail: string | null;
  autoForward?: boolean;
  role: string;
  createdAt: string;
  mailboxCount: number;
}

export function TabProfile() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Recovery email state
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);

  // Auto forward state
  const [autoForward, setAutoForward] = useState<boolean>(true);
  const [isSavingAutoForward, setIsSavingAutoForward] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setRecoveryEmail(data.user?.recoveryEmail || "");
        setAutoForward(data.user?.autoForward ?? true);
      }
    } catch {
      toast("Failed to load profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoForward = async (newValue: boolean) => {
    setAutoForward(newValue);
    try {
      setIsSavingAutoForward(true);
      const res = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoForward: newValue }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          newValue
            ? "Đã bật tự động chuyển tiếp về email gốc"
            : "Đã tắt tự động chuyển tiếp về email gốc",
          "success"
        );
        setProfile((prev) => (prev ? { ...prev, autoForward: newValue } : null));
      } else {
        toast(data.error || "Không thể cập nhật cấu hình", "error");
        setAutoForward(!newValue);
      }
    } catch {
      toast("Lỗi kết nối", "error");
      setAutoForward(!newValue);
    } finally {
      setIsSavingAutoForward(false);
    }
  };

  const handleUpdateRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingRecovery(true);
      const res = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Recovery email updated successfully", "success");
        setProfile((prev) => (prev ? { ...prev, recoveryEmail } : null));
      } else {
        toast(data.error || "Failed to update recovery email", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsSavingRecovery(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }

    try {
      setIsChangingPass(true);
      const res = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Password changed successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast(data.error || "Failed to change password", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsChangingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl font-sans">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Profile Settings
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account information, recovery email and security settings.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <User className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
            Account Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <span className="block text-zinc-400 text-xs font-medium">Username</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {profile?.username || "-"}
            </span>
          </div>

          <div>
            <span className="block text-zinc-400 text-xs font-medium">System Email</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {profile?.email || (profile?.username ? `${profile.username}@mailtion.com` : "-")}
            </span>
          </div>

          <div className="sm:col-span-2">
            <span className="block text-zinc-400 text-xs font-medium">Joined Date</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {profile?.createdAt ? formatFullDate(profile.createdAt) : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Recovery Email Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <Mail className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Recovery Email Address
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Used to receive OTP codes if you ever forget your password.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateRecovery} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="e.g. personal@gmail.com"
              required
              className="w-full sm:max-w-md rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingRecovery}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSavingRecovery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Save Recovery Email</span>
          </button>
        </form>
      </div>

      {/* Auto-Forward Settings Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 mt-0.5 shrink-0">
              <Forward className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Tự động chuyển tiếp thư về Email gốc
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Tự động chuyển tiếp bản sao tất cả email nhận được về địa chỉ email khôi phục ({recoveryEmail ? <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{recoveryEmail}</span> : <span className="italic text-zinc-400">Chưa thiết lập</span>}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {isSavingAutoForward && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoForward}
                disabled={isSavingAutoForward || !recoveryEmail}
                onChange={(e) => handleToggleAutoForward(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900 dark:peer-checked:bg-blue-600 dark:bg-zinc-700 disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        {!recoveryEmail && (
          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50">
            💡 Bạn cần lưu địa chỉ Email khôi phục ở trên để sử dụng tính năng chuyển tiếp thư tự động.
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <KeyRound className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Change Password
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Keep your account secure with a strong password.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPass}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isChangingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Update Password</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default TabProfile;
