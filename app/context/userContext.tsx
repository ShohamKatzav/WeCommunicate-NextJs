"use client"
import { createContext } from 'react';
import User from '@/types/user';

type UserContextType = {
  user: User | null;
  loadingUser: boolean;
  // Resolves false when the cookie couldn't be written or cleared.
  updateUser: (user: User | null) => Promise<boolean>;
  // Re-reads the signed-in user from the server (the account, not the
  // cookie's copy) - e.g. after a moderator changes this user's role.
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loadingUser: false,
  updateUser: async () => false,
  refreshUser: async () => {}
});
export default UserContext;