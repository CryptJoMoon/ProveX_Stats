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
  const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`DexScreener price request failed: ${res.status}`);
  }

  const json = await res.json();
  const pairs = Array.isArray(json?.pairs) ? json.pairs : [];

  if (!pairs.length) {
    throw new Error("No DexScreener pairs found for PRVX.");
  }

  // Prefer PulseChain pair with highest liquidityUsd, otherwise best available pair
  const sorted = pairs
    .filter((p: any) => p?.priceUsd)
    .sort((a: any, b: any) => {
      const aPulse = (a.chainId || "").toLowerCase() === "pulsechain" ? 1 : 0;
      const bPulse = (b.chainId || "").toLowerCase() === "pulsechain" ? 1 : 0;
      if (aPulse !== bPulse) return bPulse - aPulse;

      const aLiq = Number(a?.liquidity?.usd || 0);
      const bLiq = Number(b?.liquidity?.usd || 0);
      return bLiq - aLiq;
    });

  const best = sorted[0];
  const price = Number(best?.priceUsd || 0);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid PRVX price from DexScreener.");
  }

  return price;
}

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

    const [decimals, rawTotalSupply, symbol, name, priceUsd] = await Promise.all([
      token.decimals(),
      token.totalSupply(),
      token.symbol().catch(() => "PRVX"),
      token.name().catch(() => "ProveX"),
      getPriceUsd(),
    ]);

    const balanceResults = await Promise.all(
      EXCLUDED_WALLETS.map(async (address) => {
        const rawBalance = await token.balanceOf(address);
        const balanceFormatted = ethers.formatUnits(rawBalance, decimals);
        return {
          address,
          balance: safeToNumber(balanceFormatted),
          rawBalance: rawBalance.toString(),
        };
      })
    );

    const totalSupplyFormatted = ethers.formatUnits(rawTotalSupply, decimals);
    const totalSupply = safeToNumber(totalSupplyFormatted);

    const excludedDeadTotal = balanceResults.reduce((sum, w) => sum + w.balance, 0);

    const adjustedCirculatingSupply = Math.max(
      0,
      totalSupply - excludedDeadTotal - OA_EXCLUDED_SUPPLY
    );

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
      excludedWallets: balanceResults.map(({ address, balance, rawBalance }) => ({
        address,
        balance,
        rawBalance,
      })),
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
      },
      { status: 500 }
    );
  }
}
