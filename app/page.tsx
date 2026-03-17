"use client";

import { useEffect, useMemo, useState } from "react";
import { CONFIG, type PrvxMetrics } from "@/lib/prvx";

type ApiState = {
  loading: boolean;
  error: string | null;
  data: PrvxMetrics | null;
};

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {subtext ? <div className="metric-subtext">{subtext}</div> : null}
    </div>
  );
}

export default function HomePage() {
  const [state, setState] = useState<ApiState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/prvx", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load data.");
        if (!cancelled) setState({ loading: false, error: null, data: json });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load data.";
        if (!cancelled) setState({ loading: false, error: message, data: null });
      }
    };

    load();
    const timer = setInterval(load, CONFIG.refreshSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const updatedLabel = useMemo(() => {
    if (!state.data?.updatedAt) return "Waiting for data...";
    return new Date(state.data.updatedAt).toLocaleString();
  }, [state.data?.updatedAt]);

  const data = state.data;

  return (
    <main className="page-shell">
      <section className="hero card">
        <div>
          <div className="eyebrow">PulseChain Dashboard</div>
          <h1>{CONFIG.siteName}</h1>
          <p className="hero-copy">
            Live PRVX valuation using on-chain total supply, dead-wallet exclusions, and a static OA deduction.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">Token: PRVX</span>
          <span className="badge">Refresh target: {CONFIG.refreshSeconds}s</span>
        </div>
      </section>

      {state.loading && !data ? (
        <section className="card">
          <h2>Loading live data...</h2>
          <p className="hero-copy">Pulling total supply from PulseChain and price from DexScreener.</p>
        </section>
      ) : null}

      {state.error ? (
        <section className="card">
          <h2>Data error</h2>
          <p className="hero-copy">{state.error}</p>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="metrics-grid">
            <MetricCard
              label="Adjusted Market Cap"
              value={formatUsd(data.adjustedMarketCapUsd)}
              subtext="Price × adjusted circulating supply"
            />
            <MetricCard
              label="Adjusted Circulating Supply"
              value={`${formatNumber(data.adjustedCirculatingSupply, 3)} ${data.tokenSymbol}`}
              subtext="Total supply minus dead wallets minus OA"
            />
            <MetricCard
              label="FDV"
              value={formatUsd(data.fdvUsd)}
              subtext="Price × total supply"
            />
            <MetricCard
              label="Price"
              value={formatUsd(data.priceUsd)}
              subtext={`Best pair by liquidity: ${data.selectedPair?.dexId ?? "n/a"}`}
            />
          </section>

          <section className="details-grid">
            <div className="card">
              <h2>Supply Breakdown</h2>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <tr>
                      <td>Total supply (on-chain)</td>
                      <td>{formatNumber(data.totalSupply.formatted, 3)} {data.tokenSymbol}</td>
                    </tr>
                    <tr>
                      <td>Dead / excluded wallets</td>
                      <td>-{formatNumber(data.excludedWalletTotal.formatted, 3)} {data.tokenSymbol}</td>
                    </tr>
                    <tr>
                      <td>OA static exclusion</td>
                      <td>-{formatNumber(data.oaExcludedSupply, 3)} {data.tokenSymbol}</td>
                    </tr>
                    <tr className="table-total">
                      <td>Adjusted circulating supply</td>
                      <td>{formatNumber(data.adjustedCirculatingSupply, 3)} {data.tokenSymbol}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2>Price Source</h2>
              <div className="stack">
                <div><strong>Pair:</strong> {data.selectedPair?.pairAddress || "n/a"}</div>
                <div><strong>DEX:</strong> {data.selectedPair?.dexId || "n/a"}</div>
                <div><strong>Quote:</strong> {data.selectedPair?.quoteSymbol || "n/a"}</div>
                <div><strong>Liquidity:</strong> {formatUsd(data.selectedPair?.liquidityUsd || 0)}</div>
                {data.selectedPair?.url ? (
                  <a className="link-button" href={data.selectedPair.url} target="_blank" rel="noreferrer">
                    Open DexScreener Pair
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="details-grid">
            <div className="card">
              <h2>Excluded Wallets</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.excludedWallets.map((wallet) => (
                      <tr key={wallet.address}>
                        <td className="mono">{wallet.address}</td>
                        <td>{formatNumber(wallet.formattedBalance, 3)} {data.tokenSymbol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2>Hardcoded Settings</h2>
              <ul className="assumptions">
                {data.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="meta-block">
                <div><strong>Token address:</strong> <span className="mono">{data.tokenAddress}</span></div>
                <div><strong>RPC:</strong> <span className="mono">{CONFIG.rpcUrl}</span></div>
                <div><strong>Updated:</strong> {updatedLabel}</div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
