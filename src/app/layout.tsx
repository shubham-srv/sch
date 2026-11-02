import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// next/font downloads the font at build time and serves it from this app,
// so browsers never request Google Fonts.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// TODO(owner): replace "Web" with the product name.
export const metadata: Metadata = {
  title: { default: "Web", template: "%s | Web" },
  description: "Frontend starter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-md bg-background px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>
        {/* Each route group's layout provides the <main id="main"> the link targets. */}
        {children}
      </body>
    </html>
  );
}
