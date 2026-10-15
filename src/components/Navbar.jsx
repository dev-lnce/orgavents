import React from 'react';
import { Calendar, Search, Bell, Sparkles, User, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest/85 backdrop-blur-xl border-b border-hairline z-40 px-gutter flex items-center justify-between shadow-subtle-sm">
      {/* Brand Lockup */}
      <div className="flex items-center gap-space-sm">
        <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-primary-glow">
          <Sparkles className="w-5 h-5 text-on-primary" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface leading-none">
              OrgaVents
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[10px] font-label-sm font-semibold uppercase tracking-wider">
              v1.0
            </span>
          </div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline text-[10px]">
            University Life OS
          </span>
        </div>
      </div>

      {/* Center Active Term Badge */}
      <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low border border-hairline shadow-subtle-sm">
        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
        <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
          Active Term: Spring 2026 • Campus Life & Events
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-space-sm">
        <div className="relative hidden sm:flex items-center w-64">
          <Search className="w-4 h-4 absolute left-3 text-outline pointer-events-none" />
          <input
            type="text"
            placeholder="Search campus events..."
            className="w-full h-9 pl-9 pr-12 rounded-md bg-surface border border-hairline font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
          />
          <kbd className="absolute right-2 px-1.5 py-0.5 rounded bg-surface-container text-on-secondary-container font-mono text-[11px] font-medium border border-hairline">
            ⌘K
          </kbd>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Bell className="w-4 h-4 text-secondary" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary-container ring-2 ring-surface-container-lowest"></span>
        </button>

        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm font-semibold text-xs">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
