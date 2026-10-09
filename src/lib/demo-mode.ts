/**
 * The demo workspace (sample data, no account) exists only when
 * NEXT_PUBLIC_DEMO_MODE=1 at build time: the end-to-end tests turn it on,
 * production leaves it off, so production is Google sign-in only and never
 * shows sample data.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
