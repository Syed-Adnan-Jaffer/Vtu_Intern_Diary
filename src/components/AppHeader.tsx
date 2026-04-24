import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState } from "react";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const NavLinks = ({ mobile }: { mobile?: boolean }) => (
    <>
      <Link
        to="/dashboard"
        className={`rounded-md px-2 py-1 text-muted-foreground hover:text-foreground ${mobile ? 'block py-3 text-lg' : ''}`}
        activeProps={{ className: `rounded-md px-2 py-1 text-foreground font-medium ${mobile ? 'block py-3 text-lg' : ''}` }}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Dashboard
      </Link>
      <Link
        to="/catch-up"
        className={`rounded-md px-2 py-1 text-muted-foreground hover:text-foreground ${mobile ? 'block py-3 text-lg' : ''}`}
        activeProps={{ className: `rounded-md px-2 py-1 text-foreground font-medium ${mobile ? 'block py-3 text-lg' : ''}` }}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Catch up
      </Link>
      <Link
        to="/export"
        className={`rounded-md px-2 py-1 text-muted-foreground hover:text-foreground ${mobile ? 'block py-3 text-lg' : ''}`}
        activeProps={{ className: `rounded-md px-2 py-1 text-foreground font-medium ${mobile ? 'block py-3 text-lg' : ''}` }}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Export
      </Link>
      <Link
        to="/profile"
        className={`rounded-md px-2 py-1 text-muted-foreground hover:text-foreground ${mobile ? 'block py-3 text-lg' : ''}`}
        activeProps={{ className: `rounded-md px-2 py-1 text-foreground font-medium ${mobile ? 'block py-3 text-lg' : ''}` }}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Profile
      </Link>
      {mobile ? (
        <Button variant="destructive" className="mt-4 w-full" onClick={() => { signOut(); setMobileMenuOpen(false); }}>
          Sign out
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur shadow-sm dark:shadow-none">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/graduation-cap-fill.svg" alt="VTU Intern Diary" className="h-5 w-5 dark:invert" />
          <span className="font-serif text-lg">VTU Intern Diary</span>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1 sm:gap-3 text-sm">
                <NavLinks />
              </nav>

              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shadow-sm hover:shadow-md transition-shadow" onClick={toggleTheme}>
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>

              {/* Mobile Hamburger Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shadow-sm hover:shadow-md transition-shadow" onClick={toggleTheme}>
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Link to="/auth">
                <Button size="sm">Sign in</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Nav Dropdown Panel */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-lg absolute w-full left-0 p-4 shadow-lg flex flex-col animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-1">
            <NavLinks mobile />
          </nav>
        </div>
      )}
    </header>
  );
}
