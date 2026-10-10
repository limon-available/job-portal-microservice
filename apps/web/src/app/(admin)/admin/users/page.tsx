import { Card, PageHeading } from "@/components/ui";
export const metadata = { title: "User administration" };
export default function AdminUsersPage() {
  return <><PageHeading eyebrow="Administration" title="Users" description="User administration endpoints are not available in the current API." /><Card><p className="text-sm text-muted-foreground">This area is reserved for authorized user administration once the backend APIs are added.</p></Card></>;
}
