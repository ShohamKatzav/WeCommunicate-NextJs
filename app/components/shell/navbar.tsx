"use client"
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X } from "lucide-react";
import { useUser } from "../../hooks/useUser";
import { useSocket } from "../../hooks/useSocket";
import { AsShortName } from "../../utils/stringFormat";
import ThemeToggle from "../ui/themeToggle";
import Avatar from "../ui/avatar";
import './bars.css';

const DYNAMIC_OFFLINE_LINKS = ['/chat', '/locations'];

function LogOutButton({
  variant,
  onClick,
}: {
  variant: "icon" | "labelled";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Log out"
      title="Log out"
      className={
        variant === "icon"
          ? "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
          : "flex items-center justify-center gap-3 text-3xl capitalize text-muted-foreground hover:text-foreground transition-colors"
      }
    >
      <LogOut className={variant === "icon" ? "h-5 w-5" : "h-7 w-7"} aria-hidden="true" />
      {variant === "labelled" && <span>log out</span>}
    </button>
  );
}

const Navbar = () => {
  const [nav, setNav] = useState(false);
  const { user, updateUser } = useUser();
  const { socket } = useSocket();
  const router = useRouter();
  const pathname = usePathname();

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
      if (socket?.connected) {
        socket.disconnect();
      }
      await updateUser(null);

      // Clear service worker cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          const messageChannel = new MessageChannel();
          const timeout = setTimeout(() => {
            messageChannel.port1.close();
          }, 1000);

          messageChannel.port1.onmessage = () => {
            clearTimeout(timeout);
            messageChannel.port1.close();
          };

          navigator.serviceWorker.controller.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
        } catch (error) {
          console.error('Service worker clear cache error:', error);
        }
      }
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  // Login stays a text link: it navigates to a page, and a door icon
  // next to nothing else reads as log out. Log out is an action, rendered
  // separately after the account controls.
  const links = [
    { id: 1, text: "login", link: "/login", auth: false, action: () => { } },
    { id: 2, text: "chat", link: "/chat", auth: true, action: () => { } },
    { id: 3, text: "locations", link: "/locations", auth: true, action: () => { } },
    { id: 4, text: "moderator", link: "/moderator", auth: true, moderatorOnly: true, action: () => { } },
    { id: 5, text: "about", link: "/about", auth: null, action: () => { } },
    { id: 6, text: "contact", link: "/contact", auth: null, action: () => { } },
  ];

  const isUserConnected = () => {
    return user != null && Object.keys(user).length > 0;
  }

  const shouldDisplayLink = ({ auth, moderatorOnly }: typeof links[0]) => {
    const connected = isUserConnected();

    if (moderatorOnly && !user?.isModerator) return false;

    if (auth === true) return connected;
    if (auth === false) return !connected;
    return true;
  };

  const isActiveLink = (href: string) => {
    const currentPath = pathname || '';
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const linkClassName = (link: string, extra = "") => {
    const active = link !== "/" && isActiveLink(link);
    return [
      "nav-links rounded-md px-2 py-1.5 text-sm font-medium capitalize transition-colors duration-200 lg:px-3",
      active
        ? "bg-foreground/10 text-foreground"
        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      extra,
    ].join(" ");
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

  const displayName = user?.nickname || (user?.email ? AsShortName(user.email) : "");

  return (
    <div className='container z-1'>
      {/* Height and text color belong to the .navbar rule in bars.css: it is
          unlayered, so it wins over any Tailwind h- or text- utility set
          here, which made the ones that used to be on this element dead
          code. */}
      <nav
        // bg-bar-background: its own token (globals.css), not --background
        // (same as the page - no visible edge) and not --card (the same
        // white as a content tile, and lighter than the page in dark mode
        // rather than darker). Solid, no opacity/blur, so nothing scrolling
        // underneath shows through - shadow-md casts down onto the page to
        // read as a lifted band, and the gradient strip below is the seam.
        className="navbar flex items-center bg-bar-background shadow-md nav wrap-break-word"
        aria-label="Main"
      >
        <div className="flex w-full items-center justify-between px-3 md:px-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5"
          >
            {/* The wordmark right next to it already names the app, so this
                is decorative - same as the MessageSquare mark it replaces. */}
            <Image
              src="/icon192.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg"
            />
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              We Communicate
            </h1>
          </Link>

          <ul className="hidden items-center md:flex">
            {links.map((item) => (
              shouldDisplayLink(item) &&
              <li key={item.id}>
                <Link
                  onClick={(e) => handleLinkClick(e, item.link, item.action)}
                  href={item.link}
                  prefetch={!DYNAMIC_OFFLINE_LINKS.includes(item.link)}
                  className={linkClassName(item.link, "block")}
                  aria-current={item.link !== "/" && isActiveLink(item.link) ? "page" : undefined}
                >
                  {item.text}
                </Link>
              </li>
            ))}
            <li className="ml-1">
              <ThemeToggle variant="icon" />
            </li>
            {isUserConnected() && displayName && (
              <li className="ml-1">
                <Link
                  href="/profile/edit"
                  data-testid="navbar-profile-link"
                  className="flex max-w-36 items-center gap-1.5 truncate rounded-full border border-border bg-foreground/5 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                  title={displayName}
                >
                  <Avatar avatarUrl={user?.avatarUrl} nickname={user?.nickname} email={user?.email} size={20} />
                  <span className="truncate">{displayName}</span>
                </Link>
              </li>
            )}
            {isUserConnected() && (
              <li className="ml-1">
                <LogOutButton variant="icon" onClick={() => { void handleLogOut(); }} />
              </li>
            )}
          </ul>

          <button
            type="button"
            onClick={() => toggleNav()}
            className="relative z-50 cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground md:hidden"
            aria-label={nav ? "Close menu" : "Open menu"}
            aria-expanded={nav}
          >
            {nav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {nav && (
          // overflow-y-auto + [justify-content:safe_center]: on a short phone
          // screen the logged-in list (chat/locations/moderator/about/
          // contact, then theme, profile, log out) can exceed 100dvh - plain
          // `justify-center` on an overflowing flex column clips content off
          // both ends with no way to reach it, so "safe" falls back to
          // start-alignment (and lets the list scroll) only once it no
          // longer fits, while still centering it when it does.
          <ul
            data-testid="mobile-nav-overlay"
            className="absolute inset-x-0 top-0 z-40 flex h-[100dvh] flex-col items-center gap-1 overflow-y-auto py-8 [justify-content:safe_center] bg-background text-muted-foreground"
          >
            {links.map((item) => (
              shouldDisplayLink(item) &&
              <li
                key={item.id}
                className="px-4 py-4 text-3xl capitalize"
              >
                <Link
                  onClick={() => { item.action(); toggleNav() }}
                  href={item.link}
                  prefetch={!DYNAMIC_OFFLINE_LINKS.includes(item.link)}
                  className={item.link !== "/" && isActiveLink(item.link) ? "text-foreground" : "hover:text-foreground"}
                  aria-current={item.link !== "/" && isActiveLink(item.link) ? "page" : undefined}
                >
                  {item.text}
                </Link>
              </li>
            ))}
            {/* Same row shape as the links above (px-4 py-4, same centering)
                instead of its own fixed-width box, so it lands on the same
                axis as "chat" / "about" / etc. instead of sitting off-center
                as a narrower, smaller-type block underneath them. */}
            <li className="px-4 py-4">
              <ThemeToggle variant="labelled" />
            </li>
            {/* Desktop's profile link stays in the DOM on a narrow viewport
                (its row is CSS-hidden, not unmounted). A distinct testid
                keeps this one from colliding with it in a getByTestId query. */}
            {isUserConnected() && displayName && (
              <li className="px-4 py-4">
                <Link
                  onClick={() => toggleNav()}
                  href="/profile/edit"
                  data-testid="navbar-profile-link-mobile"
                  className="flex items-center gap-2 text-3xl hover:text-foreground"
                >
                  <Avatar avatarUrl={user?.avatarUrl} nickname={user?.nickname} email={user?.email} size={28} />
                  <span className="max-w-[60vw] truncate">{displayName}</span>
                </Link>
              </li>
            )}
            {isUserConnected() && (
              <li className="px-4 py-4">
                <LogOutButton
                  variant="labelled"
                  onClick={() => {
                    toggleNav();
                    void handleLogOut();
                  }}
                />
              </li>
            )}
          </ul>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-r from-pink-400 via-indigo-500 to-indigo-700"
          aria-hidden="true"
        />
      </nav>
    </div >
  );
};

export default Navbar;
