"use client"
import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { FaBars, FaTimes } from "react-icons/fa";
import { deleteUserCoockie } from '../lib/cookieActions';
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import './bars.css';

const DYNAMIC_OFFLINE_LINKS = ['chat', 'locations'];

const Navbar = () => {
  const [nav, setNav] = useState(false);
  const { user, updateUser } = useUser();
  const { socket } = useSocket();
  const router = useRouter();

  const toggleNav = () => {
    setNav(!nav);
    if (!nav) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  };

  const handleLogOut = async () => {
    try {
      updateUser(null);
      if (socket?.connected) {
        await new Promise<void>((resolve) => {
          socket.once('disconnect', () => resolve());
          socket.disconnect();
          setTimeout(resolve, 1000);
        });
      }
      await deleteUserCoockie();

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {

        await new Promise<void>((resolve, reject) => {
          const messageChannel = new MessageChannel();
          const timeout = setTimeout(() => {
            console.log('⚠️ TIMEOUT: No response from service worker');
            messageChannel.port1.close();
            resolve();
          }, 3000);

          messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            messageChannel.port1.close();
            resolve();
          };

          navigator.serviceWorker.controller!.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
        });
      }
      await router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const links = [
    { id: 1, text: "login", link: "login", auth: false, action: () => { } },
    { id: 2, text: "chat", link: "chat", auth: true, action: () => { } },
    { id: 3, text: "locations", link: "locations", auth: true, action: () => { } },
    { id: 4, text: "about", link: "about", auth: null, action: () => { } },
    { id: 5, text: "contact", link: "contact", auth: null, action: () => { } },
    { id: 6, text: "log out", link: "/", auth: true, action: () => handleLogOut() },
  ];

  const isUserConnected = () => {
    return user != null && Object.keys(user).length > 0;
  }

  const shouldDisplayLink = ({ auth }: typeof links[0]) => {
    const connected = isUserConnected();

    if (auth === true) return connected;
    if (auth === false) return !connected;
    return true;
  };


  const handleLinkClick = (e: React.MouseEvent, link: string, onclick: () => void) => {
    onclick();
    if (!navigator.onLine) {
      if (DYNAMIC_OFFLINE_LINKS.includes(link)) {
        e.preventDefault();
        window.location.replace('/offline.html');
        return;
      }
    }
  };

  return (
    <div className='container z-1'>
      <div className="navbar flex justify-between items-center h-20 px-4 text-white bg-black nav wrap-break-word">
        <div>
          <h1 className="text-4xl font-signature ml-2">
            <a
              className="link-underline link-underline-black"
              href="/"
              rel="noreferrer"
            >
              We Communicate
            </a>
          </h1>
        </div>

        <ul className="hidden md:flex">
          {links.map((item) => (
            shouldDisplayLink(item) &&
            <li
              key={item.id}
              className="nav-links px-4 cursor-pointer capitalize font-medium
              text-gray-500 hover:scale-105 hover:text-white duration-200 link-underline"
            >
              <Link
                onClick={(e) => handleLinkClick(e, item.link, item.action)}
                href={item.link}
                prefetch={!DYNAMIC_OFFLINE_LINKS.includes(item.link)}
              >
                {item.text}
              </Link>
            </li>

          ))}
        </ul>

        <div
          onClick={() => toggleNav()}
          className="cursor-pointer pr-4 z-2 text-gray-500 md:hidden"
        >
          {nav ? <FaTimes size={30} /> : <FaBars size={30} />}
        </div>

        {nav && (
          <ul className="flex flex-col justify-center items-center absolute top-0 left-0
          w-full h-screen bg-linear-to-b from-black to-gray-800 text-gray-500">
            {links.map((item) => (
              shouldDisplayLink(item) &&
              <li
                key={item.id}
                className="px-4 cursor-pointer capitalize py-6 text-4xl"
              >
                <Link
                  onClick={() => { item.action(); toggleNav() }}
                  href={item.link}
                  prefetch={!DYNAMIC_OFFLINE_LINKS.includes(item.link)}
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div >
  );
};

export default Navbar;