import { AlertTriangle, ArrowRight, Camera, MapPin, User } from "lucide-react";
import Link from "next/link";
import { submitRequestAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getRuntimeSetupStatus } from "@/lib/supabase";

export default async function SubmitRequest() {
  await requireUser();
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  if (isSetupRequired) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-[#111111] rounded-2xl p-8 md:p-10 shadow-xl border border-amber-500/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-space">Setup Required</h1>
              <p className="text-sm text-neutral-500">New requests require database and AI triage configuration.</p>
            </div>
          </div>
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 text-sm text-neutral-400 leading-relaxed">
            Complete the manual setup in{" "}
            <span className="font-mono text-neutral-200">.codex/setup.md</span>, then restart the dev server.
          </div>
          <div className="pt-6 flex items-center justify-between">
            <Link href="/tickets" className="text-sm font-medium text-neutral-500 hover:text-white px-4 py-2">
              My Tickets
            </Link>
            <Link href="/api/health" className="bg-neutral-800 text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-neutral-700 transition-all border border-neutral-700">
              Check Health
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white font-space mb-2">New Request</h1>
        <p className="text-neutral-500">Describe the issue and AI triage will structure it immediately.</p>
      </div>

      <div className="bg-[#111111] rounded-2xl p-8 md:p-10 shadow-xl border border-neutral-800">
        <form action={submitRequestAction} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-semibold text-neutral-300">What&apos;s the issue?</label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              rows={5}
              placeholder="E.g., Aircon in Room 304 is leaking again. Floor is wet near the outlet."
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white transition-all resize-none placeholder:text-neutral-700"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <MapPin size={16} className="text-neutral-500" /> Location
              </label>
              <input
                id="location"
                name="location"
                required
                type="text"
                placeholder="Building A, Room 304"
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white transition-all placeholder:text-neutral-700"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactName" className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <User size={16} className="text-neutral-500" /> Contact Name
              </label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                placeholder="Jane Doe"
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white transition-all placeholder:text-neutral-700"
              />
            </div>
          </div>

          <div className="space-y-2 relative">
            <label htmlFor="urgencyNote" className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
              <AlertTriangle size={16} className="text-neutral-500" /> Urgency Note (Optional)
            </label>
            <input
              id="urgencyNote"
              name="urgencyNote"
              type="text"
              placeholder="Why is it urgent?"
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white transition-all pr-10 placeholder:text-neutral-700"
            />
          </div>

          <div className="pt-2">
            <label htmlFor="image" className="text-sm font-semibold text-neutral-300 block mb-2">Photo (Optional)</label>
            <label htmlFor="image" className="w-full border-2 border-dashed border-neutral-800 bg-[#0a0a0a] rounded-xl p-8 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-600 transition-all cursor-pointer">
              <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center mb-3 border border-neutral-800">
                <Camera size={20} className="text-neutral-400" />
              </div>
              <span className="text-sm font-medium">Click to attach a photo</span>
              <span className="text-xs mt-1 text-neutral-600">JPG, PNG, GIF, or WebP up to 5MB</span>
            </label>
            <input id="image" name="image" type="file" accept="image/*" className="sr-only" />
          </div>

          <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
            <Link href="/tickets" className="text-sm font-medium text-neutral-500 hover:text-white px-4 py-2">
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-emerald-500 text-black rounded-xl px-8 py-3 text-sm font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
            >
              Submit Request <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
