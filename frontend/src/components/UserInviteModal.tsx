import { useState, FormEvent } from "react";
import { X, Copy, Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useInviteUser } from "@/hooks/queries";
import { formatApiError } from "@/lib/api";

const ROLES = ["Global Admin", "Product Owner", "SecOps Lead", "IT Operator", "Auditor", "Read-Only"];

export function UserInviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("IT Operator");
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await invite.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      setTempPw(res.temp_password);
      toast.success(`Invited ${res.user.email}`);
    } catch (e: any) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Invite failed");
    }
  };

  const copy = async () => {
    if (!tempPw) return;
    await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${tempPw}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        data-testid="invite-user-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-500" />
            Invite Teammate
          </h3>
          <button
            data-testid="invite-close"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!tempPw ? (
          <form onSubmit={submit} className="p-5 space-y-4">
            <Field
              label="Full name"
              testid="invite-name"
              value={name}
              onChange={setName}
              placeholder="Sarah Connor"
              required
            />
            <Field
              label="Work email"
              testid="invite-email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="sarah@company.com"
              required
            />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Role
              </label>
              <select
                data-testid="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              data-testid="invite-submit"
              type="submit"
              disabled={invite.isPending}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {invite.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Send invitation
            </button>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              User created! Share these credentials with your teammate — this password is
              shown <b>only once</b>.
            </div>
            <div className="bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-500">Email:</span>{" "}
                <span className="text-slate-900 dark:text-slate-100">{email}</span>
              </div>
              <div>
                <span className="text-slate-500">Password:</span>{" "}
                <span data-testid="invite-temp-password" className="text-slate-900 dark:text-slate-100">
                  {tempPw}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="invite-copy"
                onClick={copy}
                className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy credentials"}
              </button>
              <button
                data-testid="invite-done"
                onClick={onClose}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required, testid,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; testid?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <input
        data-testid={testid}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
