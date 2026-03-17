import { NextResponse } from "next/server";
import { ethers } from "ethers";

const RPC_URL = "https://rpc.pulsechain.com";
const TOKEN_ADDRESS = "0xF6f8Db0aBa00007681F8fAF16A0FDa1c9B030b11";
const OA_EXCLUDED_SUPPLY = 320_000_000_000;

const EXCLUDED_WALLETS = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000369",
];

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

function safeToNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getPriceUsd(): Promise<number> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) return 0;

    const json = await res.json();
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    if (!pairs.length) return 0;

    const sorted = pairs
      .filter((p: any) => p?.priceUsd)
      .sort((a: any, b: any) => {
        const aPulse = String(a?.chainId || "").toLowerCase() === "pulsechain" ? 1 : 0;
        const bPulse = String(b?.chainId || "").toLowerCase() === "pulsechain" ? 1 : 0;
        if (aPulse !== bPulse) return bPulse - aPulse;

        const aLiq = Number(a?.liquidity?.usd || 0);
        const bLiq = Number(b?.liquidity?.usd || 0);
        return bLiq - aLiq;
      });

    const price = Number(sorted?.[0]?.priceUsd || 0);
    return Number.isFinite(price) ? price : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

    const decimals: number = Number(await token.decimals());
    const rawTotalSupply = await token.totalSupply();

    const [symbol, name, priceUsdRaw] = await Promise.all([
      token.symbol().catch(() => "PRVX"),
      token.name().catch(() => "ProveX"),
      getPriceUsd(),
    ]);

    const totalSupply = safeToNumber(ethers.formatUnits(rawTotalSupply, decimals));

    const excludedWallets = await Promise.all(
      EXCLUDED_WALLETS.map(async (address) => {
        try {
          const rawBalance = await token.balanceOf(address);
          const balance = safeToNumber(ethers.formatUnits(rawBalance, decimals));
          return {
            address,
            balance,
            rawBalance: rawBalance.toString(),
          };
        } catch {
          return {
            address,
            balance: 0,
            rawBalance: "0",
          };
        }
      })
    );

    const excludedDeadTotal = excludedWallets.reduce((sum, w) => sum + w.balance, 0);

    const adjustedCirculatingSupply = Math.max(
      0,
      totalSupply - excludedDeadTotal - OA_EXCLUDED_SUPPLY
    );

    const priceUsd = Number.isFinite(priceUsdRaw) ? priceUsdRaw : 0;
    const fdvUsd = totalSupply * priceUsd;
    const adjustedMarketCapUsd = adjustedCirculatingSupply * priceUsd;

    return NextResponse.json({
      tokenAddress: TOKEN_ADDRESS,
      symbol,
      name,
      decimals,
      totalSupply,
      rawTotalSupply: rawTotalSupply.toString(),
      priceUsd,
      excludedWallets,
      excludedDeadTotal,
      oaExcludedSupply: OA_EXCLUDED_SUPPLY,
      adjustedCirculatingSupply,
      fdvUsd,
      adjustedMarketCapUsd,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load PRVX data.",
        tokenAddress: TOKEN_ADDRESS,
        totalSupply: 0,
        priceUsd: 0,
        excludedWallets: EXCLUDED_WALLETS.map((address) => ({
          address,
          balance: 0,
          rawBalance: "0",
        })),
        excludedDeadTotal: 0,
        oaExcludedSupply: OA_EXCLUDED_SUPPLY,
        adjustedCirculatingSupply: 0,
        fdvUsd: 0,
        adjustedMarketCapUsd: 0,
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
