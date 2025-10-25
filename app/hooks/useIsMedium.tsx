import { useState, useEffect } from 'react';

const useIsMedium = () => {
    const [isMediumScreen, setIsMediumScreen] = useState(false);

    useEffect(() => {
        const checkScreen = () => setIsMediumScreen(window.innerWidth >= 768);
        checkScreen();

        window.addEventListener('resize', checkScreen);
        return () => window.removeEventListener('resize', checkScreen);
    }, []);

    return isMediumScreen;
};

export default useIsMedium;