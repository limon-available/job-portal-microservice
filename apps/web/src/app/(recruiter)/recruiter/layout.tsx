import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="recruiter">{children}</DashboardLayout>;
}
