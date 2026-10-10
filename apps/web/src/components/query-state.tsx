import { Card } from "@/components/ui";

export function LoadingCards({ count = 4 }: { count?: number }) {
  return <div className="grid gap-4">{Array.from({ length: count }, (_, index) => <Card key={index} className="animate-pulse"><div className="h-4 w-2/5 rounded bg-muted" /><div className="mt-4 h-3 w-3/5 rounded bg-muted" /><div className="mt-6 h-3 w-1/4 rounded bg-muted" /></Card>)}</div>;
}

export function ErrorState({ message = "We couldn't load this right now." }: { message?: string }) {
  return <Card role="alert"><p className="font-semibold">Something went wrong</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></Card>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <Card className="border-dashed py-12 text-center"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{detail}</p></Card>;
}
