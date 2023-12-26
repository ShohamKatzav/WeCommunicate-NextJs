import { useState, useEffect } from 'react';

export const useIsMedium = () => {
    const [isMediumScreen, setIsMediumScreen] = useState(window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMediumScreen(window.innerWidth >= 768);
        };

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMediumScreen;
};