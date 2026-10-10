import { Card, PageHeading } from "@/components/ui";

export const metadata = { title: "Admin dashboard" };
export default function AdminDashboard() {
  return <><PageHeading eyebrow="Administration" title="Platform overview" description="Manage the HireHeaven platform." /><Card><h2 className="font-bold">Admin services</h2><p className="mt-2 leading-7 text-muted-foreground">The current backend exposes authentication, profile, job, application, and notification APIs. Administrative user-management APIs are not configured yet.</p></Card></>;
}
