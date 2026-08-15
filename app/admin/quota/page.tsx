import { QuotaManager } from "@/components/quota-manager";
import { getGlobalGenerationQuota } from "@/lib/server/generation-quota";

export const dynamic = "force-dynamic";

export default async function AdminQuotaPage() {
  const quota = await getGlobalGenerationQuota();
  return <QuotaManager initialQuota={quota} />;
}
