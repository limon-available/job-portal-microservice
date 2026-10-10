import { ResetForm } from "@/components/auth-forms";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Choose a new password" };

export default function ResetPage({ params }: { params: { token: string } }) {
  const { token } = params;
  return <><PageHeading eyebrow="Account security" title="Choose a new password" description="Set a new password for your account." /><ResetForm token={token} /></>;
}
