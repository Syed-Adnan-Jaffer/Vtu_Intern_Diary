import { Sparkles } from "lucide-react";

type PrimaryCTAButtonProps = {
  className?: string;
};

export function PrimaryCTAButton({ className = "" }: PrimaryCTAButtonProps) {
  return (
    <button
      type="button"
      className={`cta-breathe inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.45),0_0_32px_rgba(14,165,233,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 ${className}`}
    >
      <Sparkles className="h-4 w-4" />
      <span>Get started — it's free</span>
    </button>
  );
}
