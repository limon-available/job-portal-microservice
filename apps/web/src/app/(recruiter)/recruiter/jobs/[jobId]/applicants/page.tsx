import { notFound } from "next/navigation";
import { ApplicantTable } from "@/components/recruiter-jobs";
export const metadata = { title: "Applicants" };
export default function ApplicantsPage({ params }: { params: { jobId: string } }) {
  const jobId = Number(params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) notFound();
  return <ApplicantTable jobId={jobId} />;
}
