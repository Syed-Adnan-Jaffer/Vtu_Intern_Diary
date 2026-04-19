import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

const INTERNSHIP_TYPES = [
  "Web Development",
  "Mobile Development",
  "Machine Learning / AI",
  "Data Science",
  "Cloud / DevOps",
  "Embedded Systems",
  "Cybersecurity",
  "Other",
];

type Form = {
  full_name: string;
  usn: string;
  branch: string;
  semester: string;
  college: string;
  internship_title: string;
  internship_type: string;
  company_name: string;
  mentor_name: string;
  start_date: string;
  end_date: string;
  weekly_plan: string;
  skip_weekends: boolean;
};

const empty: Form = {
  full_name: "",
  usn: "",
  branch: "",
  semester: "",
  college: "",
  internship_title: "",
  internship_type: "",
  company_name: "",
  mentor_name: "",
  start_date: "",
  end_date: "",
  weekly_plan: "",
  skip_weekends: true,
};

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error) {
        toast.error("Failed to load profile");
      } else if (data) {
        setForm({
          full_name: data.full_name ?? "",
          usn: data.usn ?? "",
          branch: data.branch ?? "",
          semester: data.semester ?? "",
          college: data.college ?? "",
          internship_title: data.internship_title ?? "",
          internship_type: data.internship_type ?? "",
          company_name: data.company_name ?? "",
          mentor_name: data.mentor_name ?? "",
          start_date: data.start_date ?? "",
          end_date: data.end_date ?? "",
          weekly_plan: data.weekly_plan ?? "",
          skip_weekends: data.skip_weekends ?? true,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.full_name || !form.usn || !form.start_date || !form.end_date) {
      toast.error("Please fill in name, USN, and internship dates.");
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error("End date must be after start date.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...form,
        // empty strings to null for date columns
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    void navigate({ to: "/dashboard" });
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Internship details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
              </Field>
              <Field label="USN" required>
                <Input value={form.usn} onChange={(e) => set("usn", e.target.value)} required placeholder="e.g. 1XX21CS001" />
              </Field>
              <Field label="Branch / Course">
                <Input value={form.branch} onChange={(e) => set("branch", e.target.value)} placeholder="CSE, ISE, ECE…" />
              </Field>
              <Field label="Semester">
                <Input value={form.semester} onChange={(e) => set("semester", e.target.value)} placeholder="e.g. 6th" />
              </Field>
              <Field label="College">
                <Input value={form.college} onChange={(e) => set("college", e.target.value)} />
              </Field>
              <Field label="Internship title">
                <Input value={form.internship_title} onChange={(e) => set("internship_title", e.target.value)} />
              </Field>
              <Field label="Internship type">
                <Select value={form.internship_type} onValueChange={(v) => set("internship_type", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERNSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Company / Organization">
                <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </Field>
              <Field label="Mentor name">
                <Input value={form.mentor_name} onChange={(e) => set("mentor_name", e.target.value)} />
              </Field>
              <Field label="Start date" required>
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} required />
              </Field>
              <Field label="End date" required>
                <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} required />
              </Field>
            </div>
            <Field label="Weekly plan (optional)">
              <Textarea
                rows={4}
                value={form.weekly_plan}
                onChange={(e) => set("weekly_plan", e.target.value)}
                placeholder="Outline the topics planned for each week so AI can keep entries logically progressing."
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="weekends" className="font-medium">Skip weekends</Label>
                <p className="text-xs text-muted-foreground">Saturdays &amp; Sundays won't appear on your dashboard.</p>
              </div>
              <Switch
                id="weekends"
                checked={form.skip_weekends}
                onCheckedChange={(v) => set("skip_weekends", v)}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
