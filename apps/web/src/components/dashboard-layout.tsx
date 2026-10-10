import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Bell, BriefcaseBusiness, Building2, FileText, GraduationCap, Heart, LayoutDashboard, UserRound, Users, Wrench, type LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";

type Role = "jobseeker" | "recruiter" | "admin";
const navigation: Record<Role, Array<{ href: string; label: string; icon: LucideIcon }>> = {
  jobseeker: [
    { href: "/seeker", label: "Overview", icon: LayoutDashboard },
    { href: "/seeker/profile", label: "Profile", icon: UserRound },
    { href: "/seeker/skills", label: "Skills", icon: Wrench },
    { href: "/seeker/education", label: "Education", icon: GraduationCap },
    { href: "/seeker/experience", label: "Experience", icon: BriefcaseBusiness },
    { href: "/seeker/resume", label: "Resume", icon: FileText },
    { href: "/seeker/applications", label: "Applications", icon: BriefcaseBusiness },
    { href: "/seeker/saved-jobs", label: "Saved jobs", icon: Heart },
    { href: "/seeker/notifications", label: "Notifications", icon: Bell },
  ],
  recruiter: [
    { href: "/recruiter", label: "Overview", icon: LayoutDashboard },
    { href: "/recruiter/company", label: "Company profile", icon: Building2 },
    { href: "/recruiter/jobs", label: "Manage jobs", icon: BriefcaseBusiness },
    { href: "/recruiter/jobs/new", label: "Post a job", icon: FileText },
  ],
  admin: [{ href: "/admin", label: "Overview", icon: BarChart3 }, { href: "/admin/users", label: "Users", icon: Users }],
};

export function DashboardLayout({ role, children }: { role: Role; children: ReactNode }) {
  return <><SiteHeader /><div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_1fr]"><aside className="lg:sticky lg:top-24 lg:self-start"><Card className="p-3"><p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">{role} workspace</p><nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">{navigation[role].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"><Icon size={17} />{label}</Link>)}</nav></Card></aside><main className="min-w-0 py-2">{children}</main></div></>;
}
