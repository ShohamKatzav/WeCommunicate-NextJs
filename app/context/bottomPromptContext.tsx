"use client"
import { createContext } from 'react';

// Registration order doubles as display order: the first prompt to ask for a
// slot is the one shown, everything after it just waits in `activeIds` until
// the front of the line unregisters (dismissed, snoozed, or its own condition
// stopped being true). That is what keeps N simultaneous prompts from ever
// costing more than one prompt's worth of screen space - see
// bottomPromptStack.tsx and usePromptSlot.tsx.
type BottomPromptContextType = {
    activeIds: string[];
    register: (id: string) => void;
    unregister: (id: string) => void;
};

const BottomPromptContext = createContext<BottomPromptContextType | undefined>(undefined);
export default BottomPromptContext;
