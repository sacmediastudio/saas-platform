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
    <div className="bg-[#F7F8F4] rounded-lg p-4">
      <p className="text-sm text-[#343233]/70">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-2xl font-semibold">{value}</p>
        {changePercent !== undefined && changePercent !== null && changePercent !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              changePercent > 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {changePercent > 0 ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
            {Math.abs(changePercent)}%
          </span>
        )}
      </div>
    </div>
  );
}
