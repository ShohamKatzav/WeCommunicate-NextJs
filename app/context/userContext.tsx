"use client"
import { createContext } from 'react';
import User from '@/types/user';

type UserContextType = {
  user: User | null;
  loadingUser: boolean;
  updateUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loadingUser: false,
  updateUser: () => { }
});
export default UserContext;