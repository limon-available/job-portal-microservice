import { notFound } from "next/navigation";
import { JobWizard } from "@/components/job-wizard";
export const metadata = { title: "Edit job" };
export default async function EditJobPage({ params }: { params: { jobId: string } }) {
  const jobId = Number(params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) notFound();
  return <JobWizard jobId={jobId} />;
}
