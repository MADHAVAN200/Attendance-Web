import React, { useState, useEffect } from 'react';

const ResponsiveRoute = ({ DesktopComponent, MobileComponent }) => {
    // Initialize based on the current window width
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        // Create an event listener to update state when the window is resized/zoomed
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Call handler right away so state gets updated with initial window size
        handleResize();

        // Remove event listener on cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Return the appropriate component
    return isMobile ? <MobileComponent /> : <DesktopComponent />;
};

export default ResponsiveRoute;
