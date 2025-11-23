import { createContext } from 'react';

type reloadConversationBarContextType = {
    reloadKey: boolean | null | undefined;
    updateReloadKey: () => void;
};

const ReloadConversationBarContext = createContext<reloadConversationBarContextType | undefined>(undefined);
export default ReloadConversationBarContext;