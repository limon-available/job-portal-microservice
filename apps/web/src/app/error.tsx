"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The error boundary deliberately keeps server details out of the browser UI.
    void error;
  }, [error]);
  return <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4"><Card className="w-full text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">We couldn't complete that request. Try again, or return home.</p><div className="mt-6 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><a className="rounded-lg border border-border px-4 py-2 text-sm font-semibold" href="/">Go home</a></div></Card></main>;
}
