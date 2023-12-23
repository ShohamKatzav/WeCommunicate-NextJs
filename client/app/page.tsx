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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH;
  const { user, updateUser, loading } = useUser();

  const verifyCookie = async () => {
    // If the token/email does not exist, mark the user as logged out
    if (!user || !user.token) {
      return;
    }

    await AxiosWithAuth().post(`${baseUrl}/verify`)
      .then(response => {
        setEmail(user?.email || "unknown");
        router.push("/chat");
      }).catch(error => {
        if (error?.response?.status === 401) {
          window.alert("Wrong email or password");
          updateUser(null);
        }
        else {
          window.alert("Error occured: " + error?.response?.data?.message);
          updateUser(null);
        }
      })
  };

  useEffect(() => {
    verifyCookie();
  }, [loading]);

  if (loading || user !== null && Object.keys(user).length > 0) return <Loading />
  else
    return <Login setEmail={setEmail} />
}

// Export the Home component as the default export
export default Home;