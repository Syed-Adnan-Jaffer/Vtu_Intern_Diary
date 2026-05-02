import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { Linkedin } from "lucide-react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { ThemeProvider } from "@/components/theme-provider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VTU Internship Diary — AI-assisted daily entries" },
      {
        name: "description",
        content:
          "Generate professional VTU internship diary entries from quick bullet points and export as Word document.",
      },
      { property: "og:title", content: "VTU Internship Diary" },
      {
        property: "og:description",
        content: "Stop falling behind on your internship diary. Bullet points in, polished entries out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "icon", href: "/graduation-cap-fill.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vtu-theme">
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <AppHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-10">
            <Outlet />
          </main>
          <footer className="border-t border-white/10 bg-zinc-900 font-sans text-white/85">
            <div className="mx-auto grid w-full gap-10 px-4 py-12 md:grid-cols-3 md:px-8">
              <div>
                <h3 className="text-lg font-semibold text-white">VTU Intern Diary</h3>
                <p className="mt-3 text-sm text-white/70">
                  Simplifying internship documentation for VTU students.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-white">Product</h4>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <Link to="/dashboard" className="text-white/75 transition-colors hover:text-sky-300">
                    Dashboard
                  </Link>
                  <Link to="/catch-up" className="text-white/75 transition-colors hover:text-sky-300">
                    Catch up
                  </Link>
                  <Link to="/export" className="text-white/75 transition-colors hover:text-sky-300">
                    Export
                  </Link>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-white">Support</h4>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <a
                    className="font-semibold text-white transition-colors hover:text-sky-300"
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=support.vtuinterndiary@gmail.com&su=VTU+Intern+Diary+Support+Request"
                    target="_blank"
                    rel="noreferrer"
                  >
                    support.vtuinterndiary@gmail.com
                  </a>
                  <Link to="/" className="text-white/75 transition-colors hover:text-sky-300">
                    Help Center
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10">
              <div className="mx-auto flex w-full flex-col gap-3 px-4 py-4 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between md:px-8">
                <div>© 2026 VTU Intern Diary.</div>
                <div className="flex items-center gap-4">
                  <a
                    href="https://www.linkedin.com/in/syed-adnan-jaffer-146b03360/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="LinkedIn"
                    className="transition-colors hover:text-sky-300"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          </footer>
          <Toaster />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
