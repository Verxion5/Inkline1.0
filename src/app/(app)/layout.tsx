import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ id: user.id, name: user.name, email: user.email, prefs: user.prefs }}>
      {children}
    </AppShell>
  );
}
