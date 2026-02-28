export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-white selection:bg-indigo-500/30">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] h-[40%] w-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-8 text-center px-6">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tight sm:text-7xl bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Ridermate
          </h1>
          <p className="text-lg text-zinc-400 max-w-lg mx-auto">
            Your ultimate companion for the road. Efficient, reliable, and built for riders.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-all active:scale-95">
            Get Started
          </button>
          <button className="px-8 py-3 rounded-full bg-zinc-900 text-white border border-zinc-800 font-semibold hover:bg-zinc-800 transition-all active:scale-95">
            Learn More
          </button>
        </div>

        <div className="pt-12 flex gap-8 items-center text-zinc-500">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-zinc-300">01</span>
            <span className="text-xs uppercase tracking-widest">Connect</span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-zinc-300">02</span>
            <span className="text-xs uppercase tracking-widest">Navigate</span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-zinc-300">03</span>
            <span className="text-xs uppercase tracking-widest">Ride</span>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-zinc-600">
        &copy; {new Date().getFullYear()} Ridermate. All rights reserved.
      </footer>
    </div>
  );
}
