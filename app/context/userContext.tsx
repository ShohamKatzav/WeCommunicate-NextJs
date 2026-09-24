"use client"
import { createContext } from 'react';
import User from '@/types/user';

type UserContextType = {
  user: User | null;
  loadingUser: boolean;
  updateUser: (user: User | null) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loadingUser: false,
  updateUser: async () => { }
});
export default UserContext;