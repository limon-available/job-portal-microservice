"use client";

import Link from "next/link";
import { BriefcaseBusiness, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, apiMessage } from "@/lib/api";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { Button, LinkButton, Notice } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const [logoutError, setLogoutError] = useState("");
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const router = useRouter();
  const logout = async () => {
    setLogoutError("");
    try {
      await api.post("/api/auth/logout");
      clearSession();
      router.push("/");
      router.refresh();
    } catch (error) {
      setLogoutError(apiMessage(error));
    }
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      {logoutError && <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6"><Notice tone="error">{logoutError}</Notice></div>}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BriefcaseBusiness size={19} /></span>HireHeaven</Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link className="text-muted-foreground hover:text-foreground" href="/jobs">Find jobs</Link>
          <a className="text-muted-foreground hover:text-foreground" href="/#how-it-works">How it works</a>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user ? <>
            <Link className="hidden px-3 text-sm font-medium sm:block" href={user.role === "recruiter" ? "/recruiter" : user.role === "admin" ? "/admin" : "/seeker"}>{user.name}</Link>
            <Button variant="ghost" aria-label="Log out" onClick={() => void logout()}><LogOut size={17} /><span className="hidden sm:inline">Log out</span></Button>
          </> : <><Link className="hidden px-3 text-sm font-semibold sm:block" href="/login">Log in</Link><LinkButton href="/register" className="min-h-9 px-3">Get started</LinkButton></>}
          <Button className="md:hidden" variant="ghost" aria-label="Browse jobs" onClick={() => router.push("/jobs")}><Menu size={20} /></Button>
        </div>
      </div>
    </header>
  );
}
