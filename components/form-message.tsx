import type { ActionState } from "@/lib/action-state";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{state.message}</p>;
  return null;
}
