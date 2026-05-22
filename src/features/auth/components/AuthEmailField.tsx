import { Mail } from "lucide-react";
import { Input } from "../../../components/ui/input";

interface AuthEmailFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export function AuthEmailField({ id, value, onChange }: AuthEmailFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        Email
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          autoComplete="email"
          className="h-12 pl-11 text-base"
          id={id}
          placeholder="you@example.com"
          type="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
