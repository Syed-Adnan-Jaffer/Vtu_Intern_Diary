import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, CalendarDays, Sparkles, FileDown } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Loading…</div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-16 py-8">
      <section className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI-assisted internship diary for VTU students
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          Stop falling behind on your internship diary.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Jot 2–3 quick bullet points each day. Get a polished, formal VTU-style entry.
          Export everything as a Word document, ready to upload.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Get started — it's free</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          { icon: BookOpen, title: "Bullets in", body: "Type a few rough notes about what you learned today." },
          { icon: Sparkles, title: "AI expands", body: "Get a 100–180 word formal diary entry, edit before saving." },
          { icon: FileDown, title: "Export .docx", body: "Download a complete diary formatted for VTU submission." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border bg-card p-5">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-8 text-center">
        <CalendarDays className="mx-auto h-7 w-7 text-primary" />
        <h2 className="mt-3 text-2xl font-semibold">Behind on weeks of entries?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Catch-up mode generates plausible, varied entries for missed days based on what you actually covered. Review them in seconds.
        </p>
      </section>
    </div>
  );
}
