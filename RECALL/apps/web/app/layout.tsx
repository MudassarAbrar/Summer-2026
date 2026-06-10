import { ReactNode } from 'react';

export const metadata = {
  title: 'Recall — Save and Act',
  description: 'Never forget what you save. Always act on it.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
