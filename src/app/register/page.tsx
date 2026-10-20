"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, ArrowLeft, Eye, EyeOff, Check, X, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Username checking status
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Debounced check username
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/@mailtion\.com$/, "");
    if (!clean) {
      setUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameError("Minimum 3 characters");
      return;
    }

    if (!/^[a-z0-9._-]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameError("Letters, numbers, ., -, _ only");
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameError(data.available ? null : (data.error || "Username already taken"));
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/@mailtion\.com$/, "");

    if (!cleanUsername) {
      setError("Please enter a username");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is not available. Please pick another one.");
      return;
    }

    if (!recoveryEmail.trim() || !recoveryEmail.includes("@")) {
      setError("Please enter a valid recovery email address");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/register/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          recoveryEmail: recoveryEmail.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send verification code");
        setLoading(false);
        return;
      }

      setStep(2);
      setResendCountdown(60);
      setLoading(false);
    } catch {
      setError("Cannot connect to server. Please try again.");
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and create account
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/@mailtion\.com$/, "");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter a 6-digit verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          recoveryEmail: recoveryEmail.trim(),
          password,
          code: otp.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setLoading(false);
        return;
      }

      // Automatically sign in upon registration
      window.location.href = "/";
    } catch {
      setError("Cannot connect to server. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/@mailtion\.com$/, "");
      const res = await fetch("/api/v1/auth/register/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          recoveryEmail: recoveryEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resend code");
      } else {
        setResendCountdown(60);
      }
    } catch {
      setError("Network error. Could not resend code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 transition-colors font-sans">
      <div className="w-full max-w-md relative z-10">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-6 sm:p-10 shadow-xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/95 transition-all">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link href="/" className="group mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-2 shadow-xs group-hover:scale-105 transition-transform">
                <Image
                  src="/logo.png"
                  alt="Mailtion"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Create an Account
            </h1>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-2">
              <span className="font-semibold shrink-0">Error:</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Enter Registration Info */
            <form onSubmit={handleRequestOtp} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Choose your username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="myname"
                    required
                    autoFocus
                    className={`w-full rounded-xl border bg-zinc-50/60 pl-10 pr-28 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-all font-sans ${
                      usernameAvailable === true
                        ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                        : usernameAvailable === false
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-zinc-900/10"
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 pointer-events-none">
                    {checkingUsername ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                    ) : usernameAvailable === true ? (
                      <span className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5 mr-0.5" /> Available
                      </span>
                    ) : usernameAvailable === false ? (
                      <span className="flex items-center text-xs font-medium text-red-500">
                        <X className="h-3.5 w-3.5 mr-0.5" /> Taken
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-zinc-400 select-none">
                        @mailtion.com
                      </span>
                    )}
                  </div>
                </div>
                {usernameError && (
                  <p className="mt-1 text-[11px] text-red-500 font-medium">
                    {usernameError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Recovery Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    autoComplete="email" placeholder="your-personal-email@gmail.com"
                    required
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 pl-10 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 transition-all font-sans"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Used for OTP verification and password recovery. Each recovery email can only register one Mailtion account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password" placeholder="At least 6 characters"
                    required
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 pl-10 pr-10 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 transition-all font-sans"
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

              <button
                type="submit"
                disabled={loading || checkingUsername || usernameAvailable === false}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-white shadow-xs active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Verify OTP */
            <form onSubmit={handleVerify} noValidate className="space-y-4">
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-300">
                A verification code has been sent to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {recoveryEmail}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Verification Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  autoFocus
                  required
                  className="w-full text-center tracking-[0.5em] font-mono text-xl rounded-xl border border-zinc-200 bg-zinc-50/60 py-3 text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:focus:border-zinc-100 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || loading}
                  onClick={handleResend}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend Code"}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-white shadow-xs active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify &amp; Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Sign In
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
