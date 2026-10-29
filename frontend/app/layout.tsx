import type { Metadata } from "next";
import "./globals.css";

const geistSans = {
  variable: "--font-geist-sans",
};

const geistMono = {
  variable: "--font-geist-mono",
};

export const metadata: Metadata = {
  title: "Jhoanes Bakery",
  description: "Order System",
  openGraph: {
    title: "Jhoanes Bakery",
    description: "Order System",
    url: "https://jhoanesbakery.com", // Reemplazar con la URL real si es distinta
    siteName: "Jhoanes Bakery",
    images: [
      {
        url: "/logo-whatsapp.png",
        width: 800,
        height: 800,
        alt: "Jhoanes Bakery Logo",
      },
    ],
    type: "website",
  },
  icons: {
    icon: "/logo-whatsapp.png",
    apple: "/logo-whatsapp.png",
  },
};

import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AppLayoutWrapper } from '@/components/layout/AppLayoutWrapper';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          <AuthProvider>
            <AppLayoutWrapper>
              <CartProvider>
                {children}
              </CartProvider>
            </AppLayoutWrapper>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
