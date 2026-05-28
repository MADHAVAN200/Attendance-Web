import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import useDeviceType from "../hooks/useDeviceType";

const navLinks = [
    { label: "Home", to: "/", hash: "" },
    { label: "Features", to: "/", hash: "#features" },
    { label: "Pricing", to: "/", hash: "#pricing" },
    { label: "Contact", to: "/", hash: "#contact" },
];

export default function TabletNavbar({ theme = "dark", toggleTheme }) {
    const { isPortrait } = useDeviceType();
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    const navRef = useRef(null);

    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const scrollTo = (hash) => {
        setMenuOpen(false);
        if (hash) {
            const el = document.querySelector(hash);
            if (el) el.scrollIntoView({ behavior: "smooth" });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    /* Landscape: show inline links like desktop.  Portrait: hamburger dropdown. */
    return (
        <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-16">
                {/* Brand */}
                <Link to="/" onClick={() => scrollTo("")} className="text-white font-extrabold text-xl tracking-tight">
                    MANO
                </Link>

                {isPortrait ? (
                    /* Portrait: hamburger toggle */
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleTheme}
                            className="text-white p-2"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button onClick={() => setMenuOpen(v => !v)} className="text-white p-2 -mr-2" aria-label="Toggle menu">
                            {menuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                ) : (
                    /* Landscape: inline links */
                    <div className="flex items-center gap-6">
                        {navLinks.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => scrollTo(link.hash)}
                                className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                {link.label}
                            </button>
                        ))}
                        <button 
                            onClick={toggleTheme}
                            className="text-gray-300 hover:text-white transition-colors p-2"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <Link to="/login" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold px-6 py-2 rounded-xl hover:shadow-blue-500/25 active:scale-95 transition-all">
                            Login
                        </Link>
                    </div>
                )}
            </div>

            {/* Portrait dropdown */}
            {isPortrait && menuOpen && (
                <>
                    <div className="fixed inset-0 top-16 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="relative z-50 border-t border-white/5 bg-[#0a0a0f]/95 backdrop-blur-xl px-6 py-3 flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => scrollTo(link.hash)}
                                className="text-gray-300 hover:text-white py-2.5 text-left text-sm font-medium transition-colors"
                            >
                                {link.label}
                            </button>
                        ))}
                        <div className="flex gap-2 mt-2">
                            <button 
                                onClick={() => {
                                    toggleTheme();
                                    setMenuOpen(false);
                                }}
                                className="flex-1 border border-white/10 text-white font-medium py-2.5 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                            </button>
                            <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-center font-bold py-2.5 rounded-xl active:scale-95 transition-all text-sm">
                                Login
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </nav>
    );
}
