import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const minimalNavLinks = [
    { label: "Home", path: "/#" },
    { label: "Features", path: "/#features" },
    { label: "Pricing", path: "/#pricing" },
    { label: "Contact", path: "/#contact" },
];

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('#');

    useEffect(() => {
        const sections = ['features', 'pricing', 'contact'];

        const observerOptions = {
            root: null,
            rootMargin: '-40% 0px -40% 0px',
            threshold: 0
        };

        let observer;

        const startObserving = () => {
            if (observer) observer.disconnect();

            observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        setActiveSection(id ? `#${id}` : '#');
                    }
                });
            }, observerOptions);

            const heroSection = document.querySelector('.hero-wrap');
            if (heroSection) {
                observer.observe(heroSection);
            }

            sections.forEach(id => {
                const el = document.getElementById(id);
                if (el) observer.observe(el);
            });
        };

        // Initial attempt
        startObserving();

        // Since sections might be rendered conditionally after hero reveals,
        // we use a MutationObserver to re-check when the DOM changes.
        const mutationObserver = new MutationObserver(() => {
            startObserving();
        });

        mutationObserver.observe(document.body, { childList: true, subtree: true });

        return () => {
            if (observer) observer.disconnect();
            mutationObserver.disconnect();
        };
    }, []);

    return (
        <header className="nav-shell">
            <nav className="container nav-glass">
                <Link to="/" className="brand-mark">
                    <img src="/mano-logo.svg" alt="Mano Logo" className="h-7 w-auto" style={{ marginRight: '-0.2rem' }} />
                    <span>MANO-Attendance</span>
                </Link>

                <div className="desktop-nav">
                    {minimalNavLinks.map((item) => {
                        const isActive = activeSection === item.path.replace('/', '');
                        return (
                            <a
                                key={item.path}
                                href={item.path}
                                className={`top-link ${isActive ? 'active' : ''}`}
                            >
                                {item.label}
                            </a>
                        );
                    })}
                </div>

                <div className="nav-cta-group">
                    <NavLink to="/login" className="btn-ghost" style={{ paddingInline: '1.5rem' }}>Login</NavLink>
                    <button className="mobile-toggle" onClick={() => setMobileOpen((prev) => !prev)}>
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </nav>

            <div className={`mobile-panel ${mobileOpen ? "open" : ""}`}>
                <div className="container mobile-inner glass-card">
                    {minimalNavLinks.map((item) => {
                        const isActive = activeSection === item.path.replace('/', '');
                        return (
                            <a
                                key={item.path}
                                onClick={() => setMobileOpen(false)}
                                href={item.path}
                                className={`mobile-link ${isActive ? 'active' : ''}`}
                            >
                                {item.label}
                            </a>
                        );
                    })}
                    <div className="mobile-actions">
                        <NavLink onClick={() => setMobileOpen(false)} to="/login" className="btn-ghost">Login</NavLink>
                    </div>
                </div>
            </div>
        </header>
    );
}
