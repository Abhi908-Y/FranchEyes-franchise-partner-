import './globals.css';

export const metadata = {
  title: 'Franchise partner desk',
  description: 'Upload franchise applications and get a recommendation, reason and next steps for every partner.',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Schibsted+Grotesk:wght@500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
