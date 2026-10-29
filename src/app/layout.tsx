import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrameFlow Studio · A private creative workspace",
  description: "Create consent-based camera sessions, protect captured media, and render real MP4 videos.",
  applicationName: "FrameFlow Studio",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf9f6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
