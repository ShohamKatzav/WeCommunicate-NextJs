"use client"
import Login from './login/page';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import fetchUserData, { isLoading } from './utils/fetchUserData';
import User from './types/user';
import Loading from './components/loading';

// Define the Home component
function Home() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH;
  const [user, setUser] = useState<User>({});

  useEffect(() => {
    // Fetch the user email and token from cookies
    const verifyCookie = async () => {

      const user: User = await fetchUserData() as User;
      setUser(user);

      // If the token/email does not exist, mark the user as logged out
      if (!user || !user.token) {
        setLoggedIn(false);
        return;
      }

      // If the token exists, verify it with the auth server to see if it is valid
      const response = await fetch(`${baseUrl}/verify`, {
        method: "POST",
        headers: {
          'jwt-token': user.token,
        },
      });

      const result = await response.json();

      setLoggedIn(result.message === 'success');
      setEmail(user.email || "");
      router.push("/chat");
    };

    verifyCookie();
  }, []);

  if (isLoading() || Object.keys(user).length !== 0) return <Loading />
  else
    return <Login setLoggedIn={setLoggedIn} setEmail={setEmail} />
}

// Export the Home component as the default export
export default Home;