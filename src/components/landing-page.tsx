"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LayoutDashboard } from "lucide-react";

interface LandingPageProps {
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
}

export function LandingPage({ isLoggedIn = false, onGoToDashboard }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between selection:bg-zinc-900 selection:text-white font-sans">
      {/* Header: Official Logo & Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Mailtion Logo"
              width={36}
              height={36}
              className="h-full w-full object-contain group-hover:scale-105 transition-transform"
              priority
            />
          </div>
          <span className="font-bold text-xl tracking-normal text-zinc-900">
            Mailtion
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <button
              onClick={onGoToDashboard}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full transition shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 px-4 py-2 rounded-full hover:bg-zinc-100 transition cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full transition shadow-xs cursor-pointer"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Hero Section: Single-screen, clean layout with large illustration */}
      <main className="w-full max-w-7xl mx-auto px-6 py-4 my-auto flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full">
          {/* Left Column: Minimal description */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-normal text-zinc-900 leading-[1.18]">
              Modern, fast, and secure email for everyone
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 max-w-xl leading-relaxed font-normal">
              Experience seamless communication with Mailtion. Send, receive, and organize your emails effortlessly with modern security, privacy, and an intuitive interface.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {isLoggedIn ? (
                <button
                  onClick={onGoToDashboard}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm transition shadow-sm hover:shadow active:scale-[0.98] cursor-pointer"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm transition shadow-sm hover:shadow cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-medium text-sm transition shadow-xs cursor-pointer"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Large Image without frame */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg lg:max-w-xl flex items-center justify-center">
              <img
                src="/hero-illustration.jpg"
                alt="Mailtion Illustration"
                className="w-full h-auto max-h-[480px] lg:max-h-[540px] object-contain"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer: power by mailtion */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-center text-xs text-zinc-400 font-normal">
        <p>power by mailtion</p>
      </footer>
    </div>
  );
}

export default LandingPage;
