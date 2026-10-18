import { notFound } from "next/navigation";
import { JobWizard } from "@/components/job-wizard";
import { parsePositiveSafeInteger } from "@/lib/job-wizard-id";
export const metadata = { title: "Edit job" };
export default async function EditJobPage({ params }: { params: { jobId: string } }) {
  const jobId = parsePositiveSafeInteger(params.jobId);
  if (jobId === null) notFound();
  return <JobWizard jobId={jobId} />;
}
