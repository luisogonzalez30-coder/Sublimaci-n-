import { BottomNav } from "@/components/bottom-nav";
import { requireWorkspace } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspace();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      {children}
      <BottomNav />
    </div>
  );
}
