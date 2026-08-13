import { ArrowUp, ArrowDown } from "lucide-react";

export default function TrendStatCard({
  label,
  value,
  changePercent,
}: {
  label: string;
  value: string | number;
  changePercent?: number | null;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 px-2 py-1">
      <span className="text-[2.1rem] leading-none font-extrabold tracking-tight text-[#002D09]">{value}</span>
      <span className="flex items-center gap-1.5 text-[13px] text-[#343233]/60">
        {label}
        {changePercent !== undefined && changePercent !== null && changePercent !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-bold ${
              changePercent > 0 ? "text-[#00A651]" : "text-red-600"
            }`}
          >
            {changePercent > 0 ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
            {Math.abs(changePercent)}%
          </span>
        )}
      </span>
    </div>
  );
}
