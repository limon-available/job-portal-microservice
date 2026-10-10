"use client";

import Link from "next/link";
import { BriefcaseBusiness, FileText, Heart, UserRound } from "lucide-react";
import { useApiQuery } from "@/lib/hooks";
import { Card, PageHeading } from "@/components/ui";

export default function SeekerDashboard() {
  const completion = useApiQuery<{ percentage: number }>(["profile-completion"], "/api/user/profile/completion");
  const cards = [
    { href: "/seeker/profile", label: "Complete your profile", icon: UserRound, detail: "Help employers get to know you." },
    { href: "/seeker/applications", label: "Applications", icon: BriefcaseBusiness, detail: "Keep up with your job search." },
    { href: "/seeker/saved-jobs", label: "Saved jobs", icon: Heart, detail: "Return to roles you liked." },
    { href: "/seeker/resume", label: "Your resume", icon: FileText, detail: "Keep your experience up to date." },
  ];
  const percentage = completion.data?.percentage;
  return <><PageHeading eyebrow="Your career space" title="Welcome back" description="Everything you need to keep your next move going." /><Card className="mb-6"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Profile strength</p><p className="mt-1 text-sm text-muted-foreground">{completion.isError ? "Profile completion could not be loaded." : percentage === undefined ? "Complete your profile to help employers find you." : `${percentage}% complete — a few details can make a difference.`}</p></div>{percentage !== undefined && <span className="text-2xl font-extrabold text-primary">{percentage}%</span>}</div>{percentage !== undefined && <div className="mt-4 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div>}</Card><div className="grid gap-4 sm:grid-cols-2">{cards.map(({ href, label, icon: Icon, detail }) => <Link key={href} href={href}><Card className="h-full transition hover:border-primary/50"><Icon className="text-primary" size={22} /><h2 className="mt-4 font-bold">{label}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></Card></Link>)}</div></>;
}
