import Link from "next/link";
import { BriefcaseBusiness, Building2, Plus } from "lucide-react";
import { Card, LinkButton, PageHeading } from "@/components/ui";

export const metadata = { title: "Recruiter dashboard" };
export default function RecruiterDashboard() {
  return <><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><PageHeading eyebrow="Recruiting" title="Build your team" description="Manage your company profile, publish roles, and meet your next teammate." /><LinkButton href="/recruiter/jobs/new" className="gap-2"><Plus size={17} />Post a job</LinkButton></div><div className="grid gap-4 sm:grid-cols-2"><Link href="/recruiter/company"><Card className="h-full hover:border-primary/50"><Building2 className="text-primary" /><h2 className="mt-4 font-bold">Company profile</h2><p className="mt-1 text-sm text-muted-foreground">Tell candidates about your organization.</p></Card></Link><Link href="/recruiter/jobs"><Card className="h-full hover:border-primary/50"><BriefcaseBusiness className="text-primary" /><h2 className="mt-4 font-bold">Manage jobs</h2><p className="mt-1 text-sm text-muted-foreground">Keep your openings and applicants in view.</p></Card></Link></div></>;
}
