import { ForgotForm } from "@/components/auth-forms";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return <><PageHeading eyebrow="Account help" title="Forgot password?" description="Enter your account email and we'll send you a secure reset link." /><ForgotForm /></>;
}
