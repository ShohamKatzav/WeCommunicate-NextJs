"use client"
import { useCallback, useMemo, useState, ReactNode } from 'react';
import BottomPromptContext from './bottomPromptContext';

type BottomPromptProviderProps = {
    children: ReactNode;
};

export const BottomPromptProvider = ({ children }: BottomPromptProviderProps) => {
    const [activeIds, setActiveIds] = useState<string[]>([]);

    // Idempotent and order-preserving: a prompt whose "should I show" condition
    // flips true/true (e.g. a re-render with the same props) must not jump the
    // queue or duplicate its slot.
    const register = useCallback((id: string) => {
        setActiveIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const unregister = useCallback((id: string) => {
        setActiveIds(prev => (prev.includes(id) ? prev.filter(activeId => activeId !== id) : prev));
    }, []);

    const value = useMemo(() => ({ activeIds, register, unregister }), [activeIds, register, unregister]);

    return (
        <BottomPromptContext.Provider value={value}>
            {children}
        </BottomPromptContext.Provider>
    );
};
