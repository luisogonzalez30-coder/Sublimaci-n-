import { BottomNav } from "@/components/bottom-nav";
import { redirect } from "next/navigation";
import { PAYWALL_PATH, hasActiveAccess } from "@/lib/billing/access";
import { requireWorkspace } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace } = await requireWorkspace();
  if (!hasActiveAccess(workspace)) redirect(PAYWALL_PATH); // defensa en profundidad (el middleware ya lo aplica)
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      {children}
      <BottomNav />
    </div>
  );
}
