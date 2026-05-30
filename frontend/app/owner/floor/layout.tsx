/**
 * app/owner/floor/layout.tsx
 *
 * Minimal segment layout for /owner/floor and all its children.
 * The actual chrome (Sidebar, TopBar, RouteGuard) is already applied
 * by app/owner/layout.tsx one level up — this file is intentionally
 * thin so individual pages can own their own PageWrapper titles and
 * subtitles rather than getting a duplicated header.
 */
export const metadata = {
  title: "Floor Layout – Restaurant OS",
};

export default function FloorSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}