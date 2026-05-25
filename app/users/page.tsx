import { ShieldCheck, UserCog } from "lucide-react";
import { updateUserRoleAction } from "@/app/actions";
import { requireAdmin, listUserProfiles } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const users = await listUserProfiles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">User Management</h1>
          <p className="text-neutral-500 mt-1">Review account roles and control admin access.</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl shadow-xl border border-neutral-800 overflow-hidden">
        <div className="p-6 border-b border-neutral-800 bg-[#151515]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <UserCog size={17} className="text-emerald-400" /> Accounts ({users.length})
          </h2>
        </div>

        <div className="divide-y divide-neutral-800">
          {users.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold text-white">No accounts found</h3>
              <p className="text-sm text-neutral-500 mt-1">Users will appear here after signup.</p>
            </div>
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUser.id;
              return (
                <div key={user.id} className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-white truncate">{user.displayName || user.email}</h3>
                      <span className="bg-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide uppercase">
                        {user.role}
                      </span>
                      {isSelf ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide uppercase">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-neutral-500">{user.email}</p>
                    <p className="text-xs text-neutral-600 mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>

                  <form action={updateUserRoleAction} className="flex items-center gap-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      disabled={isSelf}
                      className="h-10 bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:text-neutral-600"
                    >
                      <option value="requester">Requester</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      disabled={isSelf}
                      className="h-10 px-4 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-bold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:bg-neutral-800"
                    >
                      Save Role
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6 flex gap-4">
        <ShieldCheck size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-white">Role policy</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Signup never exposes role selection. The configured seed admin email receives admin access at account creation; after that, only admins can change roles here.
          </p>
        </div>
      </div>
    </div>
  );
}
