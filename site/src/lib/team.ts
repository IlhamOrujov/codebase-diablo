/**
 * The team page reads only this list. Edit names, roles and lines here.
 * `href` is optional (GitHub, LinkedIn, a personal site).
 */
export type Member = { name: string; role: string; line: string; href?: string };

export const TEAM: Member[] = [
  {
    name: "Ilham Orujov",
    role: "Founding team",
    line: "Product and the investigation engine.",
  },
  {
    name: "wcissor",
    role: "Founding team",
    line: "Engineering and the research workspace.",
    href: "https://github.com/wcissor",
  },
];
