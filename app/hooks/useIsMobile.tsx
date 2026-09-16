import { useState, useEffect } from 'react';

const useIsMobile = () => {
    const [isMobileScreen, setIsMobileScreen] = useState(false);

    useEffect(() => {
        // Keep the compact chat controls in sync with the point at which the
        // two sidebars become drawers (Tailwind's xl breakpoint).
        const checkScreen = () => setIsMobileScreen(window.innerWidth < 1280);
        checkScreen();

        window.addEventListener('resize', checkScreen);
        return () => window.removeEventListener('resize', checkScreen);
    }, []);

    return isMobileScreen;
};

export default useIsMobile;
