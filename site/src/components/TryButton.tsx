import { APP_URL } from "@/lib/site";

/** The one primary action on every page: open the product. Feedback arrives on press, not on release. */
export function TryButton({
  size = "md",
  tone = "accent",
  className = "",
  children = "Try yourself",
}: {
  size?: "sm" | "md" | "lg";
  /** "cream" sits on burgundy. */
  tone?: "accent" | "cream";
  className?: string;
  children?: React.ReactNode;
}) {
  const sizes = {
    sm: "h-9 px-4 text-[0.875rem]",
    md: "h-11 px-5 text-[0.9375rem]",
    lg: "h-[3.25rem] px-7 text-[1.0625rem]",
  }[size];
  const tones = {
    accent: "bg-accent text-accent-ink hover:bg-accent-hover",
    cream: "bg-cream text-burgundy hover:bg-white",
  }[tone];
  return (
    <a
      href={APP_URL}
      className={`press group inline-flex items-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-colors ${sizes} ${tones} ${className}`}
    >
      {children}
      <svg aria-hidden viewBox="0 0 16 16" className="size-[0.85em] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
        <path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
