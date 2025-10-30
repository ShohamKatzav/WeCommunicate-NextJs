import { createContext } from 'react';
import User from '../types/user';

type UserContextType = {
  user: User | null;
  loadingUser: boolean;
  updateUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);
export default UserContext;