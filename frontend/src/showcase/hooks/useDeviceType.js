import { useState, useEffect } from "react";

/**
 * Returns { device, isPortrait }
 * device: "mobile" | "tablet" | "desktop"
 * isPortrait: boolean
 *
 * Breakpoints:
 *   mobile  — width ≤ 767
 *   tablet  — 768 ≤ width ≤ 1199
 *   desktop — width ≥ 1200
 */
function getDevice(w) {
    if (w < 768) return "mobile";
    if (w < 1200) return "tablet";
    return "desktop";
}

export default function useDeviceType() {
    const [state, setState] = useState(() => ({
        device: getDevice(window.innerWidth),
        isPortrait: window.matchMedia("(orientation: portrait)").matches,
    }));

    useEffect(() => {
        const update = () => {
            setState({
                device: getDevice(window.innerWidth),
                isPortrait: window.matchMedia("(orientation: portrait)").matches,
            });
        };

        window.addEventListener("resize", update);
        window.matchMedia("(orientation: portrait)").addEventListener("change", update);

        return () => {
            window.removeEventListener("resize", update);
            window.matchMedia("(orientation: portrait)").removeEventListener("change", update);
        };
    }, []);

    return state;
}
