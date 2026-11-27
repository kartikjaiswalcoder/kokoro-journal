import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JournalSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <div className="mb-5 flex items-center gap-2 rounded-full border border-sakura-100 bg-background/80 px-4 shadow-soft focus-within:border-sakura-400 transition-colors duration-500">
    <Search size={16} className="shrink-0 text-sakura-400" />
    <input aria-label={label} placeholder={`${label}…`} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full py-3 bg-transparent outline-none text-sm text-charcoal placeholder:text-charcoal/35" />
    {value && <Button variant="ghost" size="icon" aria-label="Clear search" className="shrink-0 h-7 w-7 rounded-full text-charcoal/40 hover:bg-sakura-100 hover:text-sakura-600" onClick={() => onChange("")}><X size={14} /></Button>}
  </div>;
}