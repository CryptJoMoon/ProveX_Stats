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

function formatFullTokenAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatCompactTokenAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
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
    <div className="card">
      <div className="cardLabel">{label}</div>
      <div className="cardValue">{value}</div>
      {subvalue ? <div className="cardSubvalue">{subvalue}</div> : null}
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
    <main className="pageShell">
      <div className="pageContainer">
        <div className="hero">
          <img
            src="https://provex.com/static/logo/logo-160.webp"
            alt="ProveX logo"
            className="heroLogo"
          />
          <div>
            <h1 className="heroTitle">ProveX Market Cap</h1>
            <p className="heroSubtitle">
              Adjusted PRVX analytics with dead wallets and OA holdings removed
            </p>
          </div>
        </div>

        <div className="topBar">
          <div className="topBarText">
            <span className="topBarLabel">Token:</span> ProveX (PRVX)
          </div>

          <div className="topBarRight">
            <div className="updatedText">
              Last updated:{" "}
              <span className="updatedValue">
                {data ? formatUpdatedAt(data.updatedAt) : "-"}
              </span>
            </div>

            <button
              onClick={() => loadData(true)}
              className="refreshButton"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="messageBox">Loading PRVX stats...</div>
        ) : error ? (
          <div className="errorBox">{error}</div>
        ) : data ? (
          <>
            <div className="statsGrid">
              <StatCard
                label="ProveX Market Cap"
                value={formatCompactUsd(data.adjustedMarketCapUsd)}
              />

              <StatCard
                label="Adj Circulating Supply"
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

            <div className="lowerGrid">
              <div className="panel panelWide">
                <div className="panelTitle">Supply Adjustments</div>

                <div className="miniGrid">
                  <div className="miniCard">
                    <div className="miniLabel">Total Supply</div>
                    <div className="miniValue">
                      {formatFullTokenAmount(data.totalSupply)} PRVX
                    </div>
                  </div>

                  <div className="miniCard">
                    <div className="miniLabel">Dead / Excluded Wallets Total</div>
                    <div className="miniValue">
                      {formatFullTokenAmount(data.excludedDeadTotal)} PRVX
                    </div>
                  </div>

                  <div className="miniCard">
                    <div className="miniLabel">OA Excluded Supply</div>
                    <div className="miniValue">
                      {formatFullTokenAmount(data.oaExcludedSupply)} PRVX
                    </div>
                  </div>

                  <div className="miniCard">
                    <div className="miniLabel">Adjusted Circulating Supply</div>
                    <div className="miniValue">
                      {formatFullTokenAmount(data.adjustedCirculatingSupply)} PRVX
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panelTitle">Excluded Wallets</div>

                <div className="walletList">
                  {data.excludedWallets.map((wallet) => (
                    <div key={wallet.address} className="walletCard">
                      <div className="walletAddress">{wallet.address}</div>
                      <div className="walletBalance">
                        {formatFullTokenAmount(wallet.balance)} PRVX
                      </div>
                    </div>
                  ))}
                </div>

                <div className="oaBox">
                  Static OA exclusion:{" "}
                  <span className="oaBoxStrong">
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
