# Diablo AI: the public site

The marketing site at https://diablo.pnoia.dev. Its own Next.js project, separate from the app in the
repository root (https://app.diablo.pnoia.dev).

```bash
npm install
npm run dev -- -p 3214        # http://localhost:3214
npm run check                 # typecheck + lint + production build
PORT=3214 npm run test:e2e    # Playwright + axe against the production build (run the build first)
```

First time on a machine: `npx playwright install chromium`. The e2e server reuses whatever already listens on
`PORT`, so pass the port you mean.

## Rules

- Colours are Diablo's own tokens (`src/app/globals.css`). Everything else follows Apple's interface
  principles: system type with size-specific tracking, materials, springs that start from the current value,
  1:1 gestures with velocity handoff, momentum projection and rubber-banding (`src/lib/motion.ts`).
- The markup never depends on the reduced-motion setting, which the server cannot know. Content is visible in
  the server HTML; effects only hide what is below the fold, and CSS handles reduced motion, reduced
  transparency and increased contrast.
- Say only what the product does today. Anything planned is labelled as next.

## What the e2e suite covers

Routes and metadata (canonical URLs, share card, sitemap, robots, a real 404); axe in light and dark at 375 and
1440 px, and with increased contrast; keyboard use of the dial, the grounding wipe, the scrubber, the billing
switch and the menu sheet (focus trap, Escape, focus return); pointer gestures; reduced motion; no JavaScript;
layout shift, fonts and first paint.
