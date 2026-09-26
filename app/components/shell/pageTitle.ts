// Every page title that sits under the navbar. The bar already clears itself
// with --content-top-offset, so mt-4 is the only extra gap - and it has to
// be the only one, or the pages drift apart again. Splash screens (error,
// offline) reuse the size without the margin, because they are centered
// under an icon rather than stacked under the bar.
// Bigger than the form controls under it (text-3xl sat under the login
// fields), but a phone gets 36px, not 48px: at 48px the app name alone -
// one word, "WeCommunicate", 8.05em wide in this font - is wider than a
// 375px screen, and every other title took two lines. On the narrowest
// phones it shrinks further, just enough for that word to fit between the
// page's 1rem gutters (8.2em with a little room). 48px from sm, 60px from md.
export const pageTitleSizeClassName =
    "text-center text-[min(2.25rem,calc((100vw_-_2rem)/8.2))] font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl";

export const pageTitleClassName =
    `mt-4 ${pageTitleSizeClassName} text-gray-900 dark:text-white`;
