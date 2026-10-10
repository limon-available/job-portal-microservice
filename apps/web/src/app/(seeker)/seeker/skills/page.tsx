import { ResourceManager } from "@/components/resource-manager";

export const metadata = { title: "Skills" };
export default function SkillsPage() {
  return <ResourceManager title="Skills" description="Add the strengths and tools you bring to your next role." endpoint="/api/user/skills" collection="skills" idField="name" fields={[{ name: "name", label: "Skill", required: true }]} itemLabel={(item) => String(item.name ?? "Skill")} deleteBody={(item) => ({ name: item.name })} />;
}
