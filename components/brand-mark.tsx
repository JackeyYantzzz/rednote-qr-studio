import Link from "next/link";
import { Sparkles } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="inline-flex items-center gap-3" href="/">
      <span className="grid size-10 place-items-center rounded-[14px] bg-[#ef5a4f] text-white shadow-[0_8px_20px_rgba(239,90,79,.24)]">
        <Sparkles size={20} />
      </span>
      {!compact && (
        <span>
          <strong className="block text-base leading-4 font-black tracking-tight">红薯帖帖</strong>
          <small className="mt-1 block text-[10px] font-bold tracking-[0.18em] text-[#91877e]">
            REDNOTE STUDIO
          </small>
        </span>
      )}
    </Link>
  );
}
