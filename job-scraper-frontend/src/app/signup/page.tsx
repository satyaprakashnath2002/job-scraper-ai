"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchApi } from "@/lib/api";

export default function SignupPage() {
  const [formData, setFormData] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetchApi("/signup", {
        method: "POST",
        token: null,
        body: JSON.stringify(formData),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Email may already be registered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/30 p-8">
          <h2 className="text-2xl font-bold text-white mb-1 text-center">Create account</h2>
          <p className="text-slate-400 text-sm text-center mb-8">Join Job Scraper to start finding jobs</p>
          {error && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Full name</label>
              <input
                type="text"
                required
                className="w-full p-3.5 bg-slate-800/80 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white placeholder-slate-500 transition"
                placeholder="Your name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                required
                className="w-full p-3.5 bg-slate-800/80 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white placeholder-slate-500 transition"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full p-3.5 bg-slate-800/80 border border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white placeholder-slate-500 transition"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:bg-emerald-500 transition disabled:opacity-50 shadow-lg shadow-emerald-900/20"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
