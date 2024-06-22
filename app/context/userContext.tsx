"use client"
import { createContext } from 'react';
import User from '../types/user';

type UserContextType = {
  user: User | null;
  updateUser: (user: User | null) => void;
  loading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);
export default UserContext;