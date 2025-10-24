"use client"
import Login from './login/page';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Loading from './components/loading';
import AxiosWithAuth from './utils/axiosWithAuth';
import { useUser } from './hooks/useUser';

// Define the Home component
const Home = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/account";
  const { user, updateUser, loading } = useUser();
  const [navigated, setNavigated] = useState(false);

  const verifyCookie = async () => {
    if (!user?.token || navigated) return

    try {
      await AxiosWithAuth().post(`${baseUrl}/verify`);
      setEmail(user.email || "unknown");
      setNavigated(true);
      router.push("/chat");
    } catch (error: any) {
      if (error.response?.status === 401) {
        window.alert("Wrong email or password");
      } else {
        window.alert("Error occurred: " + error.response?.data?.message);
      }
      updateUser(null);
    }
  };

  useEffect(() => {
    if (user && user.token) {
      verifyCookie();
    }
  }, [user]);

  if (loading || (user && Object.keys(user).length > 0)) return <Loading />;
  else
    return <Login setEmail={setEmail} />
}

// Export the Home component as the default export
export default Home;