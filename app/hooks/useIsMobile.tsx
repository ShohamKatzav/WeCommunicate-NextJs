import { useState, useEffect } from 'react';

const useIsMobile = () => {
    const [isMobileScreen, setIsMobileScreen] = useState(false);

    useEffect(() => {
        const checkScreen = () => setIsMobileScreen(window.innerWidth <= 768);
        checkScreen();

        window.addEventListener('resize', checkScreen);
        return () => window.removeEventListener('resize', checkScreen);
    }, []);

    return isMobileScreen;
};

export default useIsMobile;