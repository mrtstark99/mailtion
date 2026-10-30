"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { MAX_FORWARD_ADDRESSES, isValidEmail, splitForwardAddresses } from "@/lib/utils";

interface ForwardAddressesInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function ForwardAddressesInput({ value, onChange, disabled = false }: ForwardAddressesInputProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isFull = value.length >= MAX_FORWARD_ADDRESSES;

  // Moves valid addresses from the draft into the list; invalid ones stay in the draft for fixing
  const commitDraft = (text: string) => {
    const incoming = splitForwardAddresses(text).filter((address) => !value.includes(address));
    if (incoming.length === 0) {
      setDraft("");
      setError(null);
      return;
    }

    const valid = incoming.filter(isValidEmail);
    const invalid = incoming.filter((address) => !isValidEmail(address));
    const room = MAX_FORWARD_ADDRESSES - value.length;
    const accepted = valid.slice(0, room);
    const overflow = valid.slice(room);

    if (accepted.length > 0) {
      onChange([...value, ...accepted]);
    }
    setDraft([...invalid, ...overflow].join(", "));

    if (invalid.length > 0) {
      setError(`Invalid email: ${invalid.join(", ")}`);
    } else if (overflow.length > 0) {
      setError(`You can add at most ${MAX_FORWARD_ADDRESSES} forwarding addresses.`);
    } else {
      setError(null);
    }
  };

  const removeAddress = (address: string) => {
    onChange(value.filter((a) => a !== address));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitDraft(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      removeAddress(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((address) => (
            <span
              key={address}
              className="inline-flex items-center gap-1 max-w-full rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-mono text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            >
              <span className="truncate">{address}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAddress(address)}
                  className="shrink-0 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100"
                  title={`Remove ${address}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        inputMode="email"
        disabled={disabled || isFull}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commitDraft(draft)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[\s,;]/.test(pasted.trim())) {
            e.preventDefault();
            commitDraft(`${draft} ${pasted}`);
          }
        }}
        placeholder={
          isFull
            ? `Limit of ${MAX_FORWARD_ADDRESSES} addresses reached`
            : value.length > 0
              ? "Add another email..."
              : "Backup destination email (e.g. backup@gmail.com)"
        }
        className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-blue-600 outline-none dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 transition-all disabled:opacity-60 ${
          error ? "border-red-400 dark:border-red-500" : "border-zinc-200 dark:border-zinc-700"
        }`}
      />

      <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
        <span className={error ? "text-red-500" : "text-zinc-400"}>
          {error || "Press Enter or comma to add each address."}
        </span>
        <span className="shrink-0 font-mono text-zinc-400">
          {value.length}/{MAX_FORWARD_ADDRESSES}
        </span>
      </div>
    </div>
  );
}
