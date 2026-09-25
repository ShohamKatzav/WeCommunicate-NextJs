// Every page title that sits under the navbar. The bar already clears itself
// with --content-top-offset, so mt-4 is the only extra gap - and it has to
// be the only one, or the pages drift apart again. Splash screens (error,
// offline) reuse the size without the margin, because they are centered
// under an icon rather than stacked under the bar.
// Bigger than the form controls under it. text-3xl sat under the login
// fields; 48px on a phone and 60px from md up keeps the title in front.
export const pageTitleSizeClassName =
    "text-center text-5xl font-extrabold tracking-tight text-balance md:text-6xl";

export const pageTitleClassName =
    `mt-4 ${pageTitleSizeClassName} text-gray-900 dark:text-white`;
