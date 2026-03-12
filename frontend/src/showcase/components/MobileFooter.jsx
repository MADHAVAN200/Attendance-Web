import { Link } from 'react-router-dom';

export default function MobileFooter() {
    return (
        <footer className="bg-black py-12 px-8 border-t border-white/5 relative z-10 overflow-hidden">
            {/* Subtle glow background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] aspect-square -translate-y-1/2 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="max-w-md mx-auto flex flex-col items-center text-center gap-10">
                {/* Brand Section */}
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/mano-logo.svg" alt="Mano Logo" className="h-8" />
                        <span className="text-white font-bold text-lg tracking-tight">MANO-Attendance</span>
                    </div>
                    <p className="text-gray-400 text-sm italic">AI-Driven Workforce Productivity</p>
                </div>

                {/* Contact Points - Compact */}
                <div className="grid grid-cols-1 gap-4 w-full">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 transition-active active:scale-[0.98]">
                        <p className="text-blue-400 font-bold text-sm tracking-wide uppercase">Connect</p>
                        <p className="text-white font-medium text-sm">+91 91360 96633</p>
                        <p className="text-gray-400 text-xs">business@mano.co.in</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                        <p className="text-blue-400 font-bold text-sm tracking-wide uppercase">Dadar (East), Mumbai</p>
                        <p className="text-gray-400 text-xs leading-relaxed px-4">B-11, 2nd Floor, West View, 88, L.N Road, Dadar (East), Mumbai - 400014</p>
                    </div>
                </div>

                {/* Simplified Links */}
                <div className="flex justify-center gap-x-6 text-xs font-semibold text-gray-500 tracking-wider uppercase w-full">
                    <a href="/#" className="active:text-blue-400">Home</a>
                    <a href="/#features" className="active:text-blue-400">Features</a>
                    <a href="/#pricing" className="active:text-blue-400">Pricing</a>
                    <a href="/#contact" className="active:text-blue-400">Contact</a>
                </div>

                {/* Copyright */}
                <div className="pt-8 border-t border-white/5 w-full">
                    <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">
                        Copyright 2025 © <span className="text-gray-400">MANO-Attendance</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}
