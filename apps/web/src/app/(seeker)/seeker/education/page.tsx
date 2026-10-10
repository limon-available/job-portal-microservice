import { ResourceManager } from "@/components/resource-manager";

export const metadata = { title: "Education" };
export default function EducationPage() {
  return <ResourceManager title="Education" description="Show the learning experiences that shaped your expertise." endpoint="/api/user/education" collection="education" idField="education_id" fields={[
    { name: "institution", label: "Institution", required: true },
    { name: "degree", label: "Degree", required: true },
    { name: "fieldOfStudy", label: "Field of study" },
    { name: "startDate", label: "Start date", type: "date" },
    { name: "endDate", label: "End date", type: "date" },
    { name: "description", label: "Description", type: "textarea" },
  ]} itemLabel={(item) => `${String(item.degree ?? "Degree")} · ${String(item.institution ?? "Institution")}`} allowEdit />;
}
