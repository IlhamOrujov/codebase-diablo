import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/mark-paths";

const [, , VW, VH] = MARK_VIEWBOX.split(" ").map(Number);

/** The mark, static. The eyes are cut out of the head with the even-odd rule, so it works on any background. */
export function Mark({
  size = 20,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
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
      <path fillRule="evenodd" d={`${MARK_PATHS.head} ${MARK_PATHS.eyeL} ${MARK_PATHS.eyeR}`} />
      <path d={MARK_PATHS.crescent} />
    </svg>
  );
}

