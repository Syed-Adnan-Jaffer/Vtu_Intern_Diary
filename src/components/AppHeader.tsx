import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { BookOpen } from "lucide-react";

export function AppHeader() {
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-serif text-lg">VTU Diary</span>
        </Link>
        {user ? (
          <nav className="flex items-center gap-1 sm:gap-3 text-sm">
            <Link
              to="/dashboard"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "rounded-md px-2 py-1 text-foreground font-medium" }}
            >
              Dashboard
            </Link>
            <Link
              to="/catch-up"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "rounded-md px-2 py-1 text-foreground font-medium" }}
            >
              Catch up
            </Link>
            <Link
              to="/export"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "rounded-md px-2 py-1 text-foreground font-medium" }}
            >
              Export
            </Link>
            <Link
              to="/profile"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "rounded-md px-2 py-1 text-foreground font-medium" }}
            >
              Profile
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </nav>
        ) : (
          <Link to="/auth">
            <Button size="sm">Sign in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
