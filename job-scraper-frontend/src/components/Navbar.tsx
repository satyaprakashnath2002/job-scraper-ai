"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)}
        className={`text-sm font-medium transition ${
          active
            ? "text-emerald-400"
            : "text-slate-400 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="bg-slate-900/95 border-b border-slate-700/80 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-white hover:text-emerald-400 transition"
          >
            Job<span className="text-emerald-400">Scraper</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLink("/dashboard", "Dashboard")}
            {navLink("/ai", "AI Tools")}
            {navLink("/history", "History")}
            {navLink("/profile", "Profile")}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 text-sm font-medium transition"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700/80 py-4 space-y-3">
            <div className="flex flex-col gap-3">
              {navLink("/dashboard", "Dashboard")}
              {navLink("/ai", "AI Tools")}
              {navLink("/history", "History")}
              {navLink("/profile", "Profile")}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="text-left text-slate-400 hover:text-red-400 text-sm font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
