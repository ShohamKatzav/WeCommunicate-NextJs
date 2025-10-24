import { useState, useEffect } from 'react';

const useIsMedium = () => {
    const [isMediumScreen, setIsMediumScreen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMediumScreen(window?.innerWidth >= 768);
        };

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMediumScreen;
};

export default useIsMedium;