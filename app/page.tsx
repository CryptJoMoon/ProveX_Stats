"use client";

import { useEffect, useState } from "react";

type WalletStat = {
  address: string;
  balance: number;
};

type ApiResponse = {
  tokenAddress: string;
  totalSupply: number;
  priceUsd: number;
  excludedWallets: WalletStat[];
  excludedDeadTotal: number;
  oaExcludedSupply: number;
  adjustedCirculatingSupply: number;
  fdvUsd: number;
  adjustedMarketCapUsd: number;
  updatedAt: string;
  error?: string;
};

function formatCompactUsd(value: number) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsdPrice(value: number) {
  if (!Number.isFinite(value)) return "$0.00";

  if (value >= 1) {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 0.01) {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });
}

function formatCompactTokenAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFullTokenAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatUpdatedAt(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function StatCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-zinc-950/80 p-5 shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
        {label}
      </div>

      <div className="overflow-hidden text-ellipsis whitespace-nowrap leading-none tracking-tight tabular-nums text-[clamp(1.1rem,2.4vw,2.2rem)] font-bold text-white">
        {value}
      </div>

      {subvalue ? (
        <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-zinc-400">
          {subvalue}
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const res = await fetch("/api/prvx", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || `Request failed: ${res.status}`);
      }

      setData(json);
    } catch (err) {
      console.error(err);
      setError("Failed to load PRVX stats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_28%),linear-gradient(135deg,#020617_0%,#09090b_45%,#082f49_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
          <img
            src="https://provex.com/static/logo/logo-160.webp"
            alt="ProveX logo"
            className="h-16 w-16 rounded-2xl border border-cyan-400/20 bg-white/5 p-2 shadow-[0_0_25px_rgba(34,211,238,0.15)]"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              ProveX Market Cap
            </h1>
            <p className="mt-1 text-sm text-zinc-300 sm:text-base">
              Adjusted PRVX analytics with dead wallets and OA holdings removed
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-black/30 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-300">
            <span className="font-medium text-white">Token:</span> ProveX (PRVX)
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-zinc-400">
              Last updated:{" "}
              <span className="font-medium text-zinc-200">
                {data ? formatUpdatedAt(data.updatedAt) : "-"}
              </span>
            </div>

            <button
              onClick={() => loadData(true)}
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-black/30 p-8 text-center text-zinc-300 backdrop-blur">
            Loading PRVX stats...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">
            {error}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="ProveX Market Cap"
                value={formatCompactUsd(data.adjustedMarketCapUsd)}
                subvalue={`${formatFullTokenAmount(data.adjustedCirculatingSupply)} PRVX adjusted supply`}
              />

              <StatCard
                label="Adjusted Circulating Supply"
                value={`${formatCompactTokenAmount(data.adjustedCirculatingSupply)} PRVX`}
                subvalue={formatFullTokenAmount(data.adjustedCirculatingSupply)}
              />

              <StatCard
                label="FDV"
                value={formatCompactUsd(data.fdvUsd)}
                subvalue={`${formatFullTokenAmount(data.totalSupply)} PRVX total supply`}
              />

              <StatCard
                label="PRVX Price"
                value={formatUsdPrice(data.priceUsd)}
                subvalue="Live market price"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5 backdrop-blur lg:col-span-2">
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  Supply Adjustments
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                      Total Supply
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatFullTokenAmount(data.totalSupply)} PRVX
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                      Dead / Excluded Wallets Total
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatFullTokenAmount(data.excludedDeadTotal)} PRVX
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                      OA Excluded Supply
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatFullTokenAmount(data.oaExcludedSupply)} PRVX
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                      Adjusted Circulating Supply
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatFullTokenAmount(data.adjustedCirculatingSupply)} PRVX
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5 backdrop-blur">
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  Excluded Wallets
                </div>

                <div className="space-y-3">
                  {data.excludedWallets.map((wallet) => (
                    <div
                      key={wallet.address}
                      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300"
                    >
                      <div className="truncate font-mono">{wallet.address}</div>
                      <div className="mt-1 text-zinc-400">
                        {formatFullTokenAmount(wallet.balance)} PRVX
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                  Static OA exclusion:{" "}
                  <span className="font-semibold">
                    {formatFullTokenAmount(data.oaExcludedSupply)} PRVX
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
