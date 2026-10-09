import { Suspense } from "react";
import type { Metadata } from "next";
import { Workspace, WorkspaceSkeleton } from "@/components/research/Workspace";
import { SEED_IDS, SEED_TITLES } from "@/lib/data/seeds";

// Unknown ids are rejected with a real 404 by src/proxy.ts before rendering starts.
export function generateStaticParams() {
  return SEED_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/investigations/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: SEED_TITLES[id] ?? "Investigation" };
}

export default function Page({ params }: PageProps<"/investigations/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: { params: PageProps<"/investigations/[id]">["params"] }) {
  const { id } = await params;
  return <Workspace id={id} />;
}
