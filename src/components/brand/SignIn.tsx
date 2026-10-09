"use client";

import Link from "next/link";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useRef, useEffect, useState, type FormEvent } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { safeNext } from "@/lib/auth/next-path";
import { BRAND } from "@/lib/brand";
import { LiveMark, useReduce } from "./LiveMark";

/** What a failed sign-in comes back with (`/?error=<code>`), in plain words. */
const ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled. Try again.",
  state_mismatch:
    "That sign-in attempt expired or was started in another tab. Please try again.",
  exchange_failed: "Google couldn't confirm your sign-in. Please try again.",
  unverified_email: "Your Google account's email address isn't verified yet.",
  google_unavailable: "Google sign-in isn't set up on this server yet.",
  server_error: "Something went wrong while signing you in. Please try again.",
  demo_failed:
    "The demo workspace couldn't be opened. Please reload and try again.",
};

/**
 * The message for an `?error=` code. The code comes straight from the URL, so
 * only the table's own keys count: `__proto__`, `constructor` and the like
 * would otherwise reach Object.prototype and render as an object or nothing.
 */
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  return Object.hasOwn(ERRORS, code) ? ERRORS[code] : ERRORS.server_error;
}

/**
 * The entrance (brand spec §19–23): burgundy, the cream mark revealing itself,
 * then the way in on a sheet of frosted glass. The reveal is full on a first
 * visit (the boot script sets data-reveal) and short afterwards; a click or
 * key skips it. Content is server-rendered and timed with CSS, so it appears
 * without JavaScript too, and both ways in work without JavaScript.
 *
 * `next` arrives from the server already sanitised ("" when there is none),
 * so the hidden field carries it even when no script runs.
 */
export function SignIn({
  googleEnabled,
  next: requested,
  error: errorCode,
}: {
  googleEnabled: boolean;
  next: string;
  error: string | null;
}) {
  const reduce = useReduce();
  const next = safeNext(requested);
  const error = errorMessage(errorCode);
  const [skipped, setSkipped] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState<{ x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Remember the reveal; a click or key press skips it.
  useEffect(() => {
    try {
      localStorage.setItem("diablo.revealed", "1");
    } catch {}
    const root = document.documentElement;
    const skip = () => {
      root.removeAttribute("data-reveal");
      setSkipped(true);
    };
    const done = setTimeout(() => root.removeAttribute("data-reveal"), 2600);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  // A faint cream light follows the pointer, and the mark leans toward it.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const lx = useTransform(sx, (v) => `${v * 100}%`);
  const ly = useTransform(sy, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(900px circle at ${lx} ${ly}, rgb(252 248 239 / 0.055), transparent 55%)`;
  const rotateY = useTransform(sx, [0, 1], [-8, 8]);
  const rotateX = useTransform(sy, [0, 1], [6, -6]);

  // With JavaScript the demo form posts in the background, then the app grows
  // out of the button; without it, the form posts and the server redirects.
  const enterDemo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        body: new URLSearchParams({ next }),
        redirect: "manual",
        credentials: "same-origin",
      });
      if (res.type !== "opaqueredirect" && !res.ok)
        throw new Error(String(res.status));
    } catch {
      setPending(false);
      setFailed(true);
      return;
    }
    if (reduce) {
      window.location.assign(next);
      return;
    }
    const r = button.current?.getBoundingClientRect();
    setLeaving(
      r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: innerWidth / 2, y: innerHeight / 2 },
    );
    setTimeout(() => window.location.assign(next), 560);
  };

  const message = failed ? ERRORS.demo_failed : error;
  const googleHref = requested
    ? `/api/auth/google?next=${encodeURIComponent(requested)}`
    : "/api/auth/google";

  return (
    <main
      id="main"
      className="entrance relative grid min-h-dvh place-items-center overflow-hidden bg-burgundy px-4 py-12 text-cream"
      style={{ perspective: 1200 }}
      onPointerMove={(e) => {
        if (reduce) return;
        px.set(e.clientX / window.innerWidth);
        py.set(e.clientY / window.innerHeight);
      }}
    >
      {/* Dark theme: the burgundy sinks into the warm plum of the app. */}
      <div
        aria-hidden
        className="entrance-plum pointer-events-none absolute inset-0"
      />
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: light }}
        />
      )}
      {/* Without JavaScript the mark simply appears, finished. */}
      <noscript>
        <style>{`.entrance [data-part=lens],.entrance [data-part=eye]{transform:none!important}.entrance [data-part=crescent]{opacity:1!important}.entrance [data-part=seed],.entrance [data-part=outline]{display:none}`}</style>
      </noscript>
      <div
        aria-hidden
        className="entrance-grain pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(30_0_9/0.5)_100%)]"
      />

      <div className="relative flex w-full max-w-[400px] flex-col items-center text-center">
        <motion.div
          style={
            reduce
              ? undefined
              : { rotateX, rotateY, transformStyle: "preserve-3d" }
          }
        >
          <LiveMark
            key={skipped ? "skipped" : "intro"}
            size={96}
            intro={skipped ? "none" : "auto"}
            track
            blink
            title={BRAND.name}
          />
        </motion.div>

        <p className="entrance-name mt-5 text-[12px] font-medium uppercase tracking-[0.22em] text-cream/80">
          {BRAND.name}
        </p>

        <div className="entrance-auth mt-7 flex w-full flex-col items-center">
          <h1 className="text-[26px] font-semibold leading-[34px] tracking-[-0.02em]">
            {BRAND.tagline}
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-cream/80">
            Sign in to research, test, and understand the AI systems you build.
          </p>

          {message && (
            <p
              role="alert"
              className="mt-5 w-full rounded-[8px] border border-cream/20 bg-[rgb(30_0_9/0.45)] px-3 py-2 text-left text-[13px] leading-5 text-cream"
            >
              {message}
            </p>
          )}

          {googleEnabled ? (
            <a
              href={googleHref}
              className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-[8px] bg-white text-[15px] font-medium text-[#1f1f1f] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.55)] transition-[background-color,box-shadow] duration-150 hover:shadow-[0_14px_36px_-12px_rgb(0_0_0/0.65)] focus-visible:outline-cream"
            >
              <GoogleG />
              Continue with Google
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-describedby="google-unavailable"
                className="mt-6 flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[8px] bg-white/70 text-[15px] font-medium text-[#1f1f1f]/70"
              >
                <GoogleG />
                Continue with Google
              </button>
              <p
                id="google-unavailable"
                className="mt-2 text-[12px] text-cream/80"
              >
                Google sign-in is not configured on this server.
              </p>
            </>
          )}

          {DEMO_MODE && (
            <>
              <div
                aria-hidden
                className="my-4 flex w-full items-center gap-3 text-[12px] uppercase tracking-[0.18em] text-cream/80"
              >
                <span className="h-px flex-1 bg-cream/20" />
                or
                <span className="h-px flex-1 bg-cream/20" />
              </div>

              <form
                method="post"
                action="/api/auth/demo"
                onSubmit={enterDemo}
                className="w-full"
              >
                <input type="hidden" name="next" value={requested} />
                <motion.button
                  ref={button}
                  type="submit"
                  aria-busy={pending || undefined}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="group flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-cream/35 bg-cream/[0.06] text-[15px] font-medium text-cream transition-colors duration-150 hover:border-cream/60 hover:bg-cream/[0.12] focus-visible:outline-cream"
                >
                  Enter demo workspace
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </motion.button>
              </form>
              <p className="mt-3 text-[12px] leading-[18px] text-cream/80">
                The demo uses sample data and keeps nothing after you leave.
              </p>
            </>
          )}
        </div>

        <p className="entrance-auth mt-6 max-w-[340px] text-[12px] leading-[18px] text-cream/80">
          By continuing you agree to the{" "}
          <Link
            href="/legal/terms"
            className="text-cream underline underline-offset-2 hover:text-white"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            className="text-cream underline underline-offset-2 hover:text-white"
          >
            Privacy Policy
          </Link>
          .{" "}
          <Link
            href="/legal/usage"
            className="underline underline-offset-2 hover:text-white"
          >
            Usage Policy
          </Link>
        </p>
      </div>

      {/* Burgundy → warm off-white: the app grows out of the button you pressed. */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-50 bg-bg"
            initial={{
              clipPath: `circle(0px at ${leaving.x}px ${leaving.y}px)`,
            }}
            animate={{
              clipPath: `circle(150vmax at ${leaving.x}px ${leaving.y}px)`,
            }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/**
 * Google's standard multicolour "G". Google's sign-in branding rules ask for
 * it unaltered, on white, with #1F1F1F label text, whatever the app's theme.
 */
function GoogleG() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 48 48"
      className="shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
