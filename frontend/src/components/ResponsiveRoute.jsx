import React, { useState, useEffect } from 'react';

const ResponsiveRoute = ({ DesktopComponent, MobileComponent }) => {
    const detectMobile = () => {
        if (typeof window === 'undefined') return false;
        const prefersCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        return window.innerWidth < 1024 || prefersCoarse;
    };

    const [isMobile, setIsMobile] = useState(detectMobile());

    useEffect(() => {
        const handleChange = () => setIsMobile(detectMobile());
        window.addEventListener('resize', handleChange);
        if (window.matchMedia) {
            try {
                const mq = window.matchMedia('(pointer: coarse)');
                if (mq.addEventListener) mq.addEventListener('change', handleChange);
                else if (mq.addListener) mq.addListener(handleChange);
            } catch (e) {
                // ignore
            }
        }

        return () => {
            window.removeEventListener('resize', handleChange);
            if (window.matchMedia) {
                try {
                    const mq = window.matchMedia('(pointer: coarse)');
                    if (mq.removeEventListener) mq.removeEventListener('change', handleChange);
                    else if (mq.removeListener) mq.removeListener(handleChange);
                } catch (e) {}
            }
        };
    }, []);

    return isMobile ? <MobileComponent /> : <DesktopComponent />;
};

export default ResponsiveRoute;
