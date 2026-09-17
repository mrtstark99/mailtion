"use client";

import React, { useState } from "react";
import { Copy, Download, Check, Sparkles, Plus, Dices, ArrowRight } from "lucide-react";
import { useToast } from "./toast";

interface MailboxItem {
  id: string;
  name?: string | null;
  address: string;
  local_part: string;
  domain: string;
  tag: string | null;
  created_at: string;
}

interface TabGeneratorProps {
  onSuccessCreated: () => void;
  onNavigateToMailboxes: () => void;
}

export function TabGenerator({ onSuccessCreated, onNavigateToMailboxes }: TabGeneratorProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "random" | "pattern" | "custom">("single");
  
  // Single creation state
  const [singleName, setSingleName] = useState<string>("");
  const [singleLocal, setSingleLocal] = useState<string>("");

  // Bulk creation state
  const [count, setCount] = useState<number>(20);
  const [prefix, setPrefix] = useState<string>("user");
  const [pattern, setPattern] = useState<string>("acc_{i}");
  const [customList, setCustomList] = useState<string>("");
  
  // Common metadata
  const [tag, setTag] = useState<string>("");
  const [expiryHours, setExpiryHours] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedList, setGeneratedList] = useState<MailboxItem[]>([]);
  const [singleCreated, setSingleCreated] = useState<MailboxItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const generateRandomSingle = () => {
    const hex = Math.random().toString(36).substring(2, 8);
    setSingleLocal(`user_${hex}`);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "single") {
        let local = singleLocal.trim();
        if (!local) {
          local = `user_${Math.random().toString(36).substring(2, 8)}`;
        }

        const res = await fetch("/api/v1/mailboxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: singleName.trim() || undefined,
            localPart: local,
            tag: tag.trim() || undefined,
            note: note.trim() || undefined,
            expiryHours: parseInt(expiryHours, 10) || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Không thể tạo mail");
        }

        setSingleCreated(data.item);
        setGeneratedList([data.item]);
        toast(`Đã tạo thành công mail: ${data.item.address}`, "success");
        onSuccessCreated();
      } else {
        // Bulk generation
        const res = await fetch("/api/v1/mailboxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bulk: true,
            mode,
            count: mode === "custom" ? undefined : count,
            prefix: mode === "random" ? prefix : undefined,
            pattern: mode === "pattern" ? pattern : undefined,
            customList: mode === "custom" ? customList : undefined,
            tag: tag.trim() || undefined,
            note: note.trim() || undefined,
            expiryHours: parseInt(expiryHours, 10) || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Không thể tạo mail hàng loạt");
        }

        setSingleCreated(null);
        setGeneratedList(data.items || []);
        toast(`Đã tạo thành công ${data.count} địa chỉ mail mới!`, "success");
        onSuccessCreated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      toast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const copyAllToClipboard = () => {
    if (generatedList.length === 0) return;
    const text = generatedList.map((m) => m.address).join("\n");
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast(`Đã chép ${generatedList.length} địa chỉ mail vào Clipboard`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (generatedList.length === 0) return;
    const text = generatedList.map((m) => m.address).join("\r\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mailtion_emails_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Đã tải tệp .txt");
  };

  const downloadCsv = () => {
    if (generatedList.length === 0) return;
    const rows = [
      ["Name", "Address", "Local Part", "Domain", "Tag", "Created At"],
      ...generatedList.map((m) => [m.name || "", m.address, m.local_part, m.domain, m.tag || "", m.created_at]),
    ];
    const csvContent = rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mailtion_emails_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Đã tải tệp .csv");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-5 dark:border-zinc-800 gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Tạo Hộp Thư Email (mailtion.com)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-zinc-100 p-1.5 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                mode === "single"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Tạo 1 mail (Có tên)
            </button>
            <button
              type="button"
              onClick={() => setMode("random")}
              className={`rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                mode === "random"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Ngẫu nhiên loạt
            </button>
            <button
              type="button"
              onClick={() => setMode("pattern")}
              className={`rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                mode === "pattern"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Theo mẫu
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                mode === "custom"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Dán danh sách
            </button>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="mt-6 space-y-5">
          {/* Mode 1: Single Mail Creation with Name */}
          {mode === "single" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Tên gợi nhớ / Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="Ví dụ: Facebook Chính, TikTok Shop 1, Telegram..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Địa chỉ email nhận
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomSingle}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    <span>Tạo tên ngẫu nhiên</span>
                  </button>
                </div>
                <div className="mt-1.5 flex rounded-lg border border-zinc-200 dark:border-zinc-700 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 overflow-hidden transition-colors">
                  <input
                    type="text"
                    value={singleLocal}
                    onChange={(e) => setSingleLocal(e.target.value)}
                    placeholder="myname, user123..."
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <span className="flex items-center px-3.5 text-sm font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700">
                    @mailtion.com
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Random Bulk */}
          {mode === "random" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Tiền tố (Prefix)
                </label>
                <div className="mt-1.5 flex rounded-lg border border-zinc-200 dark:border-zinc-700 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 overflow-hidden transition-colors">
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="user, fb, reg..."
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <span className="flex items-center px-3.5 text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 font-mono">
                    _hex@mailtion.com
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Số lượng cần tạo
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-28 rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  />
                  <div className="flex gap-1.5">
                    {[10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCount(preset)}
                        className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium border transition-all ${
                          count === preset
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Pattern Sequence */}
          {mode === "pattern" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Mẫu tên ({`{i}`} là số thứ tự)
                </label>
                <div className="mt-1.5 flex rounded-lg border border-zinc-200 dark:border-zinc-700 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 overflow-hidden transition-colors">
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="vd: tiktok_{i}"
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <span className="flex items-center px-3.5 text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700">
                    @mailtion.com
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Số lượng (từ 1 đến N)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-28 rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  />
                  <div className="flex gap-1.5">
                    {[10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCount(preset)}
                        className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium border transition-all ${
                          count === preset
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 4: Custom Input List */}
          {mode === "custom" && (
            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Danh sách tên hoặc email (mỗi dòng một địa chỉ)
              </label>
              <textarea
                rows={5}
                value={customList}
                onChange={(e) => setCustomList(e.target.value)}
                placeholder={"john.doe\nalice.smith\nbob_99\nkaren@mailtion.com"}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent p-3.5 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
              />
            </div>
          )}

          {/* Common Metadata Fields */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 pt-2">
            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Gắn nhãn (Tag)
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="vd: shopee, fb-reg, camp1"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Thời gian hiệu lực
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
              >
                <option value="0" className="dark:bg-zinc-900">Vĩnh viễn (Không hết hạn)</option>
                <option value="1" className="dark:bg-zinc-900">1 Giờ</option>
                <option value="24" className="dark:bg-zinc-900">24 Giờ (1 Ngày)</option>
                <option value="168" className="dark:bg-zinc-900">7 Ngày</option>
                <option value="720" className="dark:bg-zinc-900">30 Ngày</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Ghi chú
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mục đích sử dụng..."
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs hover:shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {mode === "single" ? (
                <>
                  <Plus className="h-4 w-4" />
                  <span>{isLoading ? "Đang tạo..." : "Tạo hộp thư này ngay"}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>{isLoading ? "Đang tạo..." : "Tạo danh sách email ngay"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Single Result Card */}
      {singleCreated && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-xs dark:bg-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Hộp thư vừa được tạo thành công
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {singleCreated.name || singleCreated.local_part}
                </span>
                <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  {singleCreated.address}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(singleCreated.address);
                  toast(`Đã chép: ${singleCreated.address}`);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-emerald-500 transition-all shadow-xs active:scale-[0.98]"
              >
                <Copy className="h-4 w-4" />
                <span>Sao chép địa chỉ</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToMailboxes}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                <span>Xem danh sách</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generated Results Area */}
      {generatedList.length > 1 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Danh sách vừa tạo ({generatedList.length} email)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyAllToClipboard}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-zinc-500" />
                )}
                <span>Sao chép tất cả</span>
              </button>

              <button
                type="button"
                onClick={downloadTxt}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4 text-zinc-500" />
                <span>Xuất TXT</span>
              </button>

              <button
                type="button"
                onClick={downloadCsv}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4 text-zinc-500" />
                <span>Xuất CSV</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToMailboxes}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all active:scale-[0.98]"
              >
                Xem trong Quản lý &rarr;
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 font-mono text-xs sm:text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {generatedList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    navigator.clipboard.writeText(m.address);
                    toast(`Đã chép: ${m.address}`);
                  }}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 cursor-pointer text-zinc-800 dark:text-zinc-200 transition-colors"
                  title="Bấm để sao chép"
                >
                  <span className="truncate">{m.address}</span>
                  <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0 ml-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
