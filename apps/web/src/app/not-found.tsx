import Link from "next/link";
import { Card } from "@/components/ui";

export default function NotFound() {
  return <main className="grid min-h-[70vh] place-items-center px-4"><Card className="max-w-lg text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-primary">404</p><h1 className="mt-3 text-3xl font-bold">This page took a different path.</h1><p className="mt-3 text-muted-foreground">The link may be old, or the page may have moved.</p><Link href="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Back to HireHeaven</Link></Card></main>;
}
