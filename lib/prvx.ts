export const CONFIG = {
  siteName: "PRVX Adjusted Market Cap",
  refreshSeconds: 60,
  rpcUrl: "https://rpc.pulsechain.com",
  tokenAddress: "0xF6f8Db0aBa00007681F8fAF16A0FDa1c9B030b11",
  oaExcludedSupply: 320_000_000_000,
  excludedWallets: [
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dEaD",
    "0x0000000000000000000000000000000000000369"
  ],
  dexscreenerChainId: "pulsechain"
} as const;

const SELECTORS = {
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
  name: "0x06fdde03"
} as const;

export type WalletBalanceRow = {
  address: string;
  rawBalance: string;
  formattedBalance: number;
};

export type PrvxMetrics = {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  totalSupply: {
    raw: string;
    formatted: number;
  };
  excludedWallets: WalletBalanceRow[];
  excludedWalletTotal: {
    raw: string;
    formatted: number;
  };
  oaExcludedSupply: number;
  adjustedCirculatingSupply: number;
  priceUsd: number;
  fdvUsd: number;
  adjustedMarketCapUsd: number;
  selectedPair: {
    pairAddress: string;
    dexId: string;
    quoteSymbol: string;
    liquidityUsd: number;
    priceUsd: number;
    url: string;
  } | null;
  assumptions: string[];
  updatedAt: string;
};

function safeNumber(value: string | number | null | undefined): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function pad32Hex(value: string) {
  return strip0x(value).toLowerCase().padStart(64, "0");
}

async function rpcCall(to: string, data: string): Promise<string> {
  const res = await fetch(CONFIG.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"]
    }),
    next: { revalidate: CONFIG.refreshSeconds }
  });

  if (!res.ok) {
    throw new Error(`RPC request failed with status ${res.status}`);
  }

  const json = await res.json() as { result?: string; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message || "RPC error");
  }
  if (!json.result) {
    throw new Error("RPC call returned no result");
  }
  return json.result;
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

function decodeUint8(hex: string): number {
  return Number(BigInt(hex));
}

function decodeAbiString(hex: string): string {
  const clean = strip0x(hex);
  if (clean.length < 128) {
    const bytes = Buffer.from(clean.replace(/00+$/, ""), "hex");
    return bytes.toString("utf8").replace(/\0+$/, "");
  }

  const offset = Number(BigInt("0x" + clean.slice(0, 64)));
  const lengthPos = offset * 2;
  const length = Number(BigInt("0x" + clean.slice(lengthPos, lengthPos + 64)));
  const dataStart = lengthPos + 64;
  const dataHex = clean.slice(dataStart, dataStart + length * 2);
  return Buffer.from(dataHex, "hex").toString("utf8");
}

function formatUnits(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const base = 10n ** BigInt(decimals);
  const value = negative ? -raw : raw;
  const whole = value / base;
  const fraction = value % base;

  if (fraction === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${fractionText}`;
}

async function fetchDexScreenerPrice(tokenAddress: string) {
  const url = `https://api.dexscreener.com/token-pairs/v1/${CONFIG.dexscreenerChainId}/${tokenAddress}`;
  const res = await fetch(url, {
    next: { revalidate: CONFIG.refreshSeconds },
    headers: { accept: "application/json" }
  });

  if (!res.ok) {
    throw new Error(`DexScreener request failed with status ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    pairAddress?: string;
    dexId?: string;
    url?: string;
    priceUsd?: string | null;
    liquidity?: { usd?: number | string | null };
    quoteToken?: { symbol?: string };
  }>;

  const ranked = [...data]
    .filter((pair) => safeNumber(pair.priceUsd) > 0)
    .sort((a, b) => safeNumber(b.liquidity?.usd) - safeNumber(a.liquidity?.usd));

  const best = ranked[0];
  if (!best) {
    throw new Error("No usable DexScreener pair with a USD price was found.");
  }

  return {
    pairAddress: best.pairAddress || "",
    dexId: best.dexId || "unknown",
    quoteSymbol: best.quoteToken?.symbol || "unknown",
    liquidityUsd: safeNumber(best.liquidity?.usd),
    priceUsd: safeNumber(best.priceUsd),
    url: best.url || ""
  };
}

async function readTotalSupply() {
  return decodeUint256(await rpcCall(CONFIG.tokenAddress, SELECTORS.totalSupply));
}

async function readDecimals() {
  return decodeUint8(await rpcCall(CONFIG.tokenAddress, SELECTORS.decimals));
}

async function readSymbol() {
  return decodeAbiString(await rpcCall(CONFIG.tokenAddress, SELECTORS.symbol));
}

async function readName() {
  return decodeAbiString(await rpcCall(CONFIG.tokenAddress, SELECTORS.name));
}

async function readBalanceOf(account: string) {
  return decodeUint256(await rpcCall(CONFIG.tokenAddress, SELECTORS.balanceOf + pad32Hex(account)));
}

export async function getPrvxMetrics(): Promise<PrvxMetrics> {
  const [totalSupplyRaw, decimals, name, symbol] = await Promise.all([
    readTotalSupply(),
    readDecimals(),
    readName(),
    readSymbol()
  ]);

  const walletBalancesRaw = await Promise.all(CONFIG.excludedWallets.map(readBalanceOf));

  const excludedWalletRows: WalletBalanceRow[] = CONFIG.excludedWallets.map((address, index) => ({
    address,
    rawBalance: walletBalancesRaw[index].toString(),
    formattedBalance: safeNumber(formatUnits(walletBalancesRaw[index], decimals))
  }));

  const excludedWalletTotalRaw = walletBalancesRaw.reduce((sum, value) => sum + value, 0n);
  const excludedWalletTotalFormatted = safeNumber(formatUnits(excludedWalletTotalRaw, decimals));
  const totalSupplyFormatted = safeNumber(formatUnits(totalSupplyRaw, decimals));

  const selectedPair = await fetchDexScreenerPrice(CONFIG.tokenAddress);
  const adjustedCirculatingSupply = Math.max(
    totalSupplyFormatted - excludedWalletTotalFormatted - CONFIG.oaExcludedSupply,
    0
  );

  return {
    tokenAddress: CONFIG.tokenAddress,
    tokenName: name,
    tokenSymbol: symbol,
    decimals,
    totalSupply: {
      raw: totalSupplyRaw.toString(),
      formatted: round(totalSupplyFormatted, 6)
    },
    excludedWallets: excludedWalletRows.map((row) => ({
      ...row,
      formattedBalance: round(row.formattedBalance, 6)
    })),
    excludedWalletTotal: {
      raw: excludedWalletTotalRaw.toString(),
      formatted: round(excludedWalletTotalFormatted, 6)
    },
    oaExcludedSupply: round(CONFIG.oaExcludedSupply, 6),
    adjustedCirculatingSupply: round(adjustedCirculatingSupply, 6),
    priceUsd: round(selectedPair.priceUsd, 12),
    fdvUsd: round(totalSupplyFormatted * selectedPair.priceUsd, 2),
    adjustedMarketCapUsd: round(adjustedCirculatingSupply * selectedPair.priceUsd, 2),
    selectedPair,
    assumptions: [
      "Adjusted circulating supply subtracts the configured dead/excluded wallets.",
      `Adjusted circulating supply also subtracts a static OA amount of ${CONFIG.oaExcludedSupply.toLocaleString()} ${symbol}.`,
      "Price source uses the highest-liquidity DexScreener PRVX pair with a non-zero USD price.",
      "Total supply and excluded wallet balances are read directly from PulseChain RPC at runtime.",
      "Current expected on-chain total supply is about 1,272,716,813,971.882 PRVX."
    ],
    updatedAt: new Date().toISOString()
  };
}
