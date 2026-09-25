"use client"
import { createContext } from 'react';
import User from '@/types/user';

type UserContextType = {
  user: User | null;
  loadingUser: boolean;
  // Resolves false when the cookie couldn't be written or cleared.
  updateUser: (user: User | null) => Promise<boolean>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loadingUser: false,
  updateUser: async () => false
});
export default UserContext;