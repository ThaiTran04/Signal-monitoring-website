import { MONO } from "../../utils/constants";

export interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

export function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3.5">
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <div className="text-[26px] font-bold leading-none" style={{ color, fontFamily: MONO }}>
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mt-1.5">
          {label}
        </div>
      </div>
    </div>
  );
}
