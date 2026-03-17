# PRVX Adjusted Market Cap Dashboard

Vercel-ready Next.js site for tracking PRVX adjusted market cap.

## What it does

- Reads `totalSupply()` from the PRVX token on PulseChain at runtime
- Reads `balanceOf()` for these excluded wallets:
  - `0x0000000000000000000000000000000000000000`
  - `0x000000000000000000000000000000000000dEaD`
  - `0x0000000000000000000000000000000000000369`
- Subtracts a hardcoded OA amount of `320,000,000,000 PRVX`
- Pulls the best PRVX USD price from DexScreener using the highest-liquidity pair with a non-zero USD price
- Calculates:
  - Adjusted circulating supply
  - Adjusted market cap
  - FDV

## Hardcoded values

Everything is inside `lib/prvx.ts`.

- RPC URL
- Token address
- Excluded wallets
- OA exclusion amount
- Refresh interval

## Deploy

1. Upload this folder to GitHub.
2. Import the repo into Vercel.
3. Deploy.

No environment variables are required.
