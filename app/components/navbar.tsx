"use client"
import Link from "next/link";
import React, { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import './Bars.css';

const Navbar = () => {
  const [nav, setNav] = useState(false);
  const { user, updateUser } = useUser();
  const { socket } = useSocket();

  const links = [
    {
      id: 1,
      text: "login",
      link: "login",
      onclick: () => { }
    },
    {
      id: 2,
      text: "chat",
      link: "chat",
      onclick: () => { }
    },
    {
      id: 3,
      text: "locations",
      link: "locations",
      onclick: () => { }
    },
    {
      id: 4,
      text: "about",
      link: "about",
      onclick: () => { }
    },
    {
      id: 5,
      text: "contact",
      link: "contact",
      onclick: () => { }
    },
    {
      id: 6,
      text: "Log out",
      link: "/",
      onclick: () => handleLogOut()
    },
  ];

  const handleLogOut: any = async () => {
    updateUser({});
    socket?.disconnect();
  };

  const isUserConnected = () => {
    return user != null && Object.keys(user).length > 0;
  }

  const shouldDisplayLink = (id: number) => {
    if ((id === 2 || id === 3 || id === 6) && isUserConnected()) return true;
    if (id === 1 && !isUserConnected()) return true;
    if (id !== 1 && id !== 2 && id !== 3 && id !== 6) return true;
    return false;
  };

  return (
    <div className='container' >
      <div className="navbar flex justify-between items-center w- h-20 px-4 text-white bg-black nav break-words">
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
          {links.map(({ id, text, link, onclick }) => (
            shouldDisplayLink(id) &&
            <li
              key={id}
              className="nav-links px-4 cursor-pointer capitalize font-medium
             text-gray-500 hover:scale-105 hover:text-white duration-200 link-underline"
            >
              <Link onClick={onclick} href={link}>{text}</Link>
            </li>

          ))}
        </ul>

        <div
          onClick={() => setNav(!nav)}
          className="cursor-pointer pr-4 z-20 text-gray-500 md:hidden"
        >
          {nav ? <FaTimes size={30} /> : <FaBars size={30} />}
        </div>

        {nav && (
          <ul className="flex flex-col justify-center items-center absolute top-0 left-0
        w-full h-screen bg-gradient-to-b from-black to-gray-800 text-gray-500 z-10">
            {links.map(({ id, text, link, onclick }) => (
              shouldDisplayLink(id) &&
              <li
                key={id}
                className="px-4 cursor-pointer capitalize py-6 text-4xl"
              >
                <Link onClick={() => { onclick(); setNav(!nav) }} href={link}>
                  {text}
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