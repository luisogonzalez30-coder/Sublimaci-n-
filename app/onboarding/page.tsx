import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { countryFromWhatsapp } from "@/lib/countries";
import { getWorkspace, listInsumos, listProductos, requireUser } from "@/lib/data";

export const metadata = { title: "Configura tu taller" };

export default async function OnboardingPage() {
  const { user } = await requireUser();
  const { workspace } = await getWorkspace();
  const [insumos, productos] = workspace ? await Promise.all([listInsumos(), listProductos()]) : [[], []];
  if (workspace && productos.length > 0) redirect("/");

  const meta = user.user_metadata as { whatsapp?: string };
  const initialStep = !workspace ? 1 : insumos.length === 0 ? 2 : 3;
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-6">
      <OnboardingWizard
        initialStep={initialStep}
        initialCountry={workspace?.country_code ?? countryFromWhatsapp(meta.whatsapp).code}
        initialTax={workspace ? Number(workspace.tax_rate_pct) : undefined}
        existingInsumos={insumos}
      />
    </main>
  );
}
