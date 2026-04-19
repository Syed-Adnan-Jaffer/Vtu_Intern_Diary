import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { exportDiaryDocx } from "@/server/export.functions";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/export")({
  component: () => (
    <RequireAuth>
      <ExportPage />
    </RequireAuth>
  ),
});

function ExportPage() {
  const { user } = useAuth();
  const exportFn = useServerFn(exportDiaryDocx);
  const [counts, setCounts] = useState<{ finalized: number; drafted: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("diary_entries").select("status, content").eq("user_id", user.id);
      if (!active) return;
      const finalized = (data ?? []).filter((e) => e.status === "finalized").length;
      const drafted = (data ?? []).filter((e) => e.status === "draft" && e.content && e.content.trim()).length;
      setCounts({ finalized, drafted });
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await exportFn({});
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Diary downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Export your diary</h1>
        <p className="mt-1 text-muted-foreground">
          Download a Word document with a cover page and one entry per day, ready to print or upload to the VTU portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What's included</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Cover page (name, USN, branch, internship details)
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            One page per finalized day, with date, day number, entry, and signature line
          </div>
          {counts && (
            <p className="rounded-md bg-muted p-3 text-muted-foreground">
              <strong className="text-foreground">{counts.finalized}</strong> finalized entries will be included.
              {counts.drafted > 0 && (
                <>
                  {" "}
                  <span className="ml-1 inline-flex items-center gap-1 text-warning-foreground/80">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {counts.drafted} draft{counts.drafted > 1 ? "s" : ""} won't be included until finalized.
                  </span>
                </>
              )}
            </p>
          )}
          <Button onClick={handleDownload} disabled={downloading} size="lg">
            <FileDown className="mr-2 h-4 w-4" />
            {downloading ? "Preparing…" : "Download .docx"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
