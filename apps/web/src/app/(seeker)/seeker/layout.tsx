import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function SeekerLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="jobseeker">{children}</DashboardLayout>;
}
