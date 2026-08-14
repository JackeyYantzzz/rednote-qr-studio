import { notFound } from "next/navigation";
import { ShareTestLab } from "@/components/share-test-lab";

export const dynamic = "force-dynamic";

export default function ShareTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ShareTestLab />;
}
