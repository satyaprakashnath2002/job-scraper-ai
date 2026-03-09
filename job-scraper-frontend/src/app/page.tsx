import Link from "next/link";

const FEATURES = [
  {
    title: "Multi-platform",
    desc: "Search LinkedIn, Naukri, Internshala & Unstop in one place.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "Track applications",
    desc: "Every application saved with platform, date and link.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    title: "Profile",
    desc: "Upload a photo, update your name, manage your account.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            background: "radial-gradient(ellipse 100% 80% at 50% -20%, rgba(16,185,129,0.6), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(rgba(30,41,59,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.07) 1px, transparent 1px)",
            backgroundSize: "4rem 4rem",
          }}
        />
      </div>

      <div className="relative flex flex-col items-center flex-1 px-5 sm:px-6 py-14 sm:py-20">
        {/* Hero */}
        <header className="text-center max-w-2xl w-full">
          <p className="text-emerald-400/90 text-sm font-medium tracking-wide uppercase mb-4">
            Job search, simplified
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
            Job<span className="text-emerald-400">Scraper</span>
          </h1>
          <p className="mt-5 text-slate-400 text-lg sm:text-xl leading-relaxed max-w-lg mx-auto">
            One search across top job boards. Track every application and manage your profile in one place.
          </p>
          <nav
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
            aria-label="Sign in or sign up"
          >
            <Link
              href="/login"
              className="w-full sm:w-auto min-w-[180px] px-8 py-3.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 text-center"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="w-full sm:w-auto min-w-[180px] px-8 py-3.5 rounded-xl font-semibold bg-slate-800/80 text-slate-200 border border-slate-600/80 hover:bg-slate-700/80 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition text-center"
            >
              Create account
            </Link>
          </nav>
        </header>

        {/* Features */}
        <section
          className="mt-20 sm:mt-28 w-full max-w-4xl"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 list-none p-0 m-0">
            {FEATURES.map((item) => (
              <li
                key={item.title}
                className="group relative p-6 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-700/80 hover:border-emerald-500/30 hover:bg-slate-900/90 transition-all duration-200"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
                  {item.icon}
                </div>
                <h3 className="mt-4 font-semibold text-white text-base">{item.title}</h3>
                <p className="mt-2 text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer note */}
        <p className="mt-16 text-slate-500 text-sm">
          Secure sign up · Free to use
        </p>
      </div>
    </main>
  );
}
