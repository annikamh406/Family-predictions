This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Scoring

The family game uses the binary Brier score: the mean of `(probability / 100 - outcome)²`,
where the outcome is 1 for happened and 0 for not happened. Lower scores win: 0 is perfect,
0.25 is the score from always betting 50%, and 1 is the worst possible score.

This replaces the original linear points rule (`bet - 50` for yes, `50 - bet` for no), which
incentivized reporting 100% whenever your belief exceeded 50%, and 0% whenever it was below
50%. Brier instead minimizes expected error at your honest probability. This concerns
expected score; a winner-takes-all prize can still create strategic tournament incentives.

- Every resolved prediction counts equally. Unresolved predictions are excluded entirely.
- Missing bets use the 50% already shown by untouched sliders. They count in the denominator;
  omitting difficult questions cannot remove them from a player's score.
- Players with no submitted valid bets are unranked under Brier. Submitting at least one bet
  enters the player, with all remaining questions defaulting to 50%.
- Equal scores share competition ranks (1, 1, 3). Ranking uses unrounded scores, allowing only
  a `1e-12` tolerance for floating-point noise. Display uses four decimals.
- The leaderboard, summary totals and sort order, and stats chart share `utils/scoring.ts`.
- Existing bets and outcomes are recalculated on read; no database migration is necessary.
- Brier is the default for every year. Years **before 2026** offer a comparison toggle for
  the old rule. The fixed rollout boundary is `BRIER_START_YEAR` in `utils/scoring.ts`;
  completion status and the current calendar year do not unlock legacy scoring for new seasons.
  Changing this constant changes which years allow the comparison.
- Legacy mode preserves the original linear totals (including zero points for missing bets).
  The scoring selector is a view preference and never changes stored bets or outcomes.

The help panel includes an interactive example and a link to
[ECMWF's probability-scoring guide](https://confluence.ecmwf.int/spaces/FUG/pages/673551875/Section%2B12.B%2BStatistical%2BConcepts%2B-%2BProbabilistic%2BData).

### Checks

Use Node.js 22.6+ for the test command's built-in TypeScript stripping:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
```

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to
use your family's database. The production build fetches the existing Geist fonts from Google.
