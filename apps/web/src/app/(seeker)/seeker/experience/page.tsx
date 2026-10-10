import { ResourceManager } from "@/components/resource-manager";

export const metadata = { title: "Experience" };
export default function ExperiencePage() {
  return <ResourceManager title="Experience" description="Highlight the work you have done and the impact you made." endpoint="/api/user/experience" collection="experience" idField="experience_id" fields={[
    { name: "company", label: "Company", required: true },
    { name: "title", label: "Job title", required: true },
    { name: "location", label: "Location" },
    { name: "startDate", label: "Start date", type: "date" },
    { name: "endDate", label: "End date", type: "date" },
    { name: "description", label: "Description", type: "textarea" },
  ]} itemLabel={(item) => `${String(item.title ?? "Role")} · ${String(item.company ?? "Company")}`} allowEdit />;
}
