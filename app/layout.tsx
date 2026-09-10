import "./globals.css";

export const metadata = {
  title: "Hiver Support Copilot",
  description: "A dataset-grounded customer support agent for Hiver."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
