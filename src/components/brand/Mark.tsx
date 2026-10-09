import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/mark-paths";

const [, , VW, VH] = MARK_VIEWBOX.split(" ").map(Number);

/**
 * The mark, static. The eyes are cut out of the head with the even-odd rule,
 * so it works on any background. It is static everywhere except the one-time
 * reveal on sign-in (CSS in globals.css, started by the boot script).
 */
export function Mark({
  size = 20,
  className,
  title,
  reveal = false,
}: {
  size?: number;
  className?: string;
  title?: string;
  /** Sign-in only: the parts carry the classes the one-time CSS reveal animates. */
  reveal?: boolean;
}) {
  const w = (size * VW) / VH;
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={w}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="currentColor"
    >
      <path className={reveal ? "mark-head" : undefined} fillRule="evenodd" d={`${MARK_PATHS.head} ${MARK_PATHS.eyeL} ${MARK_PATHS.eyeR}`} />
      <path className={reveal ? "mark-crescent" : undefined} d={MARK_PATHS.crescent} />
    </svg>
  );
}

