import { useState, useEffect } from 'react';

export default function useOrientation() {
    const [isPortrait, setIsPortrait] = useState(
        window.matchMedia('(orientation: portrait)').matches
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(orientation: portrait)');

        const handleChange = (e) => {
            setIsPortrait(e.matches);
        };

        // Modern listener
        mediaQuery.addEventListener('change', handleChange);

        // Initial sync
        setIsPortrait(mediaQuery.matches);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return isPortrait;
}
