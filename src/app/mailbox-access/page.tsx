"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock, Eye, EyeOff, ArrowRight, Mail, Loader2 } from "lucide-react";

interface InviteInfo {
  address: string;
  username: string;
  hasAccount: boolean;
}

export default function MailboxAccessPage() {
  const tokenRef = useRef<string | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The token travels in the URL fragment so it never reaches server logs; drop it from the address bar once read
  // (kept in a ref so a second effect run, e.g. under StrictMode, still sees it)
  useEffect(() => {
    if (tokenRef.current === null) {
      tokenRef.current = window.location.hash.replace(/^#/, "");
      window.history.replaceState(null, "", window.location.pathname);
    }
    const linkToken = tokenRef.current;

    async function loadInvite() {
      try {
        const res = await fetch("/api/v1/auth/mailbox-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: linkToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || "This access link is invalid.");
          return;
        }
        setInvite(data);
      } catch {
        setLoadError("Cannot connect to server. Please try again later.");
      }
    }
    loadInvite();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/mailbox-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not set up access.");
        setSubmitting(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Cannot connect to server. Please try again later.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-zinc-50/60 pl-10 pr-10 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 transition-all font-sans";

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 transition-colors font-sans">
      <div className="w-full max-w-md relative z-10">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-6 sm:p-10 shadow-xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/95 transition-all">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link href="/" className="group mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-2 shadow-xs group-hover:scale-105 transition-transform">
                <Image src="/logo.png" alt="Mailtion" width={40} height={40} className="object-contain" priority />
              </div>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {invite?.hasAccount ? "Reset Mailbox Password" : "Set Up Mailbox Access"}
            </h1>
          </div>

          {!invite && !loadError && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          )}

          {loadError && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                {loadError}
              </div>
              <Link
                href="/login"
                className="block text-center text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Go to Sign In
              </Link>
            </div>
          )}

          {invite && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-mono truncate">{invite.address}</span>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  You have been given read access to this mailbox. Sign in later with{" "}
                  <span className="font-mono font-semibold">{invite.username}</span> and the password you set here.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-2">
                  <span className="font-semibold shrink-0">Error:</span>
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {invite.hasAccount ? "New Password" : "Password"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    autoFocus
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-white shadow-xs active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{invite.hasAccount ? "Reset Password & Sign In" : "Create Access & Sign In"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
