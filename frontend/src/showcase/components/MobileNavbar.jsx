import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

export default function MobileNavbar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] p-2">
            <nav className="relative flex items-center justify-between bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 shadow-2xl">
                <Link to="/" className="flex items-center gap-2">
                    <img src="/mano-logo.svg" alt="Mano Logo" className="h-7 w-auto" />
                    <span className="text-white font-bold text-base tracking-tight">MANO</span>
                </Link>

                <div className="flex items-center gap-3">
                    <NavLink to="/login" className="text-xs font-semibold text-white/70 hover:text-white transition px-2">Login</NavLink>
                    <button
                        className="bg-white/10 border border-white/20 text-white p-2 rounded-xl active:scale-95 transition-transform"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                <div className={`absolute top-full left-0 right-0 mt-1 p-1 transition-all duration-300 origin-top ${mobileOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'}`}>
                    <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-0 shadow-2xl">
                        {[
                            { label: "Home", path: "/#" },
                            { label: "Features", path: "/#features" },
                            { label: "Pricing", path: "/#pricing" },
                            { label: "Contact", path: "/#contact" }
                        ].map((link) => (
                            <a
                                key={link.path}
                                href={link.path}
                                onClick={() => setMobileOpen(false)}
                                className="text-white/80 py-2.5 px-3 rounded-xl active:bg-white/5 active:text-white transition-all text-sm font-medium"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Backdrop overlay to close menu on outside tap */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-[-1]"
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </header>
    );
}
