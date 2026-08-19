import { Users as UsersIcon, Trash2, ShieldCheck, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTenantUsers, useRemoveUser } from "@/hooks/queries";
import { useAuth } from "@/context/AuthContext";

export function TenantUsersPanel() {
  const { data: users, isLoading } = useTenantUsers();
  const remove = useRemoveUser();
  const { user: me } = useAuth();

  const handleRemove = async (id: string, email: string) => {
    if (!window.confirm(`Remove ${email} from this tenant?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success(`${email} removed`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to remove user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-blue-500" />
            Users & Access
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Manage teammates, roles and RBAC permissions inside your tenant.
          </p>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">MFA</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(users ?? []).map((u: any) => {
                const initials = (u.name || u.email)
                  .split(" ")
                  .map((s: string) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const isMe = u.id === me?.id;
                return (
                  <tr
                    key={u.id}
                    data-testid={`user-row-${u.id}`}
                    className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-[10px]">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {u.name}{" "}
                            {isMe && (
                              <span className="text-[10px] font-bold text-blue-500 ml-1">(you)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {u.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit">
                        <ShieldCheck className="w-3 h-3" />
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          u.mfa_enabled
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {u.mfa_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isMe && (
                        <button
                          data-testid={`user-remove-${u.id}`}
                          onClick={() => handleRemove(u.id, u.email)}
                          className="text-red-500 hover:text-red-400 inline-flex items-center gap-1 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
