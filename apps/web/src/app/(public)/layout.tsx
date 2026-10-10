import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <><SiteHeader />{children}<footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>© {new Date().getFullYear()} HireHeaven</span><span>Good work starts with the right opportunity.</span></div></footer></>;
}
