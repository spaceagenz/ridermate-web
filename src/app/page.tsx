import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white font-sans selection:bg-neutral-800 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-xl font-bold tracking-tight">Ridermate</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="#" className="hover:text-white transition-colors">Features</Link>
            <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="#" className="hover:text-white transition-colors">Community</Link>
            <Link href="#" className="hover:text-white transition-colors">Pro</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="#" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-4 sm:px-6 lg:px-8 pt-24 pb-32">
        {/* Background Gradients/Glows matching Next.js style (subtle) */}
        <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 opacity-[0.15] blur-[120px] bg-gradient-to-tr from-neutral-500 to-white rounded-full pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl z-10 w-full">
          <a href="#" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-sm text-neutral-300 backdrop-blur-md hover:bg-white/[0.06] transition-colors">
            <span className="flex h-2 w-2 rounded-full bg-neutral-400 animate-pulse"></span>
            Introducing Ridermate v2.0
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-7-7 7 7-7 7" />
            </svg>
          </a>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-[-0.04em] text-white">
            The Ultimate <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
              Companion for Riders
            </span>
          </h1>

          <p className="max-w-2xl text-lg sm:text-xl text-neutral-400 leading-relaxed tracking-tight">
            Ridermate provides everything you need to track, navigate, and ride with ease. Built for performance, designed for the modern rider.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4">
            <Link href="#" className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-neutral-200 transition-colors w-full sm:w-auto">
              Start Building
            </Link>
            <Link href="#" className="flex items-center justify-center gap-2 rounded-full border border-neutral-800 bg-black px-8 py-3.5 text-sm font-medium text-white hover:bg-neutral-900 hover:border-neutral-700 transition-colors w-full sm:w-auto shadow-[0_0_20px_rgba(255,255,255,0.02)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              View Documentation
            </Link>
          </div>
        </div>

        {/* Feature Grid Mockup */}
        <div className="mt-32 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-7xl mx-auto z-10">
          {[
            { title: "Real-time Tracking", desc: "Monitor your position and performance metrics with sub-second latency." },
            { title: "Smart Navigation", desc: "Routes optimized for scenic roads, avoiding heavy traffic automatically." },
            { title: "Ride Analytics", desc: "Detailed breakdown of your speed, lean angles, and altitude changes." },
            { title: "Community Driven", desc: "Connect with local riders, share routes, and plan group rides seamlessly." },
            { title: "Offline Mode", desc: "Navigate confidently even when you lose cellular connection in the mountains." },
            { title: "Safety First", desc: "Automatic crash detection and emergency contact notification." },
          ].map((feature, i) => (
            <div key={i} className="group relative rounded-xl border border-white/[0.08] bg-neutral-950/50 p-6 hover:bg-neutral-900/80 transition-all">
              <div className="mb-4 inline-block rounded-lg bg-white/5 p-2 border border-white/[0.08]">
                <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-neutral-200 tracking-tight">{feature.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-black py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-neutral-500">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="font-semibold text-neutral-400">Ridermate</span>
          </div>
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Ridermate Inc. All rights reserved.
          </p>
          <div className="flex gap-4 text-neutral-500 text-sm">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
