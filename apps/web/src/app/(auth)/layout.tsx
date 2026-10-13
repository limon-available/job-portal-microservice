import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_0.9fr] lg:px-6">
        <section className="hidden rounded-3xl bg-primary p-12 text-primary-foreground lg:block">
          <p className="text-sm font-bold uppercase tracking-[0.22em]">A brighter next step</p>
          <h1 className="mt-6 max-w-lg text-5xl font-extrabold leading-tight">
            Find a place where your work matters.
          </h1>
          <p className="mt-5 max-w-md leading-7 opacity-80">
            Meet teams that value your craft, and opportunities that help you grow.
          </p>
          <div className="mt-16 grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="block text-2xl">Curated</strong>
              <span className="opacity-75">opportunities</span>
            </div>
            <div>
              <strong className="block text-2xl">Your</strong>
              <span className="opacity-75">career, your way</span>
            </div>
            <div>
              <strong className="block text-2xl">Better</strong>
              <span className="opacity-75">connections</span>
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-md">
          <Card className="p-7 sm:p-9">
            {children}

          </Card>
        </div>
      </main>
    </>
  );
}
