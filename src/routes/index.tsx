import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, CalendarDays, Sparkles, FileDown } from "lucide-react";
import { PrimaryCTAButton } from "@/components/PrimaryCTAButton";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Loading…</div>
    );
  }
  return (
    <div className="space-y-16 py-8">
      <section className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI-assisted internship diary for VTU students
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          The ultimate companion for your VTU Internship.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Effortlessly maintain a professional internship record. Input daily highlights, let AI handle
          the formal expansion, and download a perfectly formatted .docx file.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <PrimaryCTAButton />
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl hover:border-primary/50">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h3 className="mt-3 text-lg font-semibold">Bullets in → AI expands</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Type a few rough notes about what you learned today, and get a polished 100-180 word formal diary entry.
          </p>
        </div>

        <Link
          to="/export"
          className="rounded-xl border bg-card p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl hover:border-primary/50"
        >
          <FileDown className="h-6 w-6 text-primary" />
          <h3 className="mt-3 text-lg font-semibold">Export .docx</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Download a complete diary formatted for VTU submission.
          </p>
        </Link>

        <Link
          to="/catch-up"
          className="rounded-xl border bg-card p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl hover:border-primary/50"
        >
          <CalendarDays className="h-6 w-6 text-primary" />
          <h3 className="mt-3 text-lg font-semibold">Behind on weeks of entries?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Catch-up mode generates plausible, varied entries for missed days based on what you actually covered.
          </p>
        </Link>
      </section>
    </div>
  );
}
