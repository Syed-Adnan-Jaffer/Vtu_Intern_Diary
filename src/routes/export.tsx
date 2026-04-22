import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { FileDown, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/export")({
  component: () => (
    <RequireAuth>
      <ExportPage />
    </RequireAuth>
  ),
});

function ExportPage() {
  const { user } = useAuth();
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
    if (!user) return;
    setDownloading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!profile) throw new Error("Profile not found");

      const { data: entries } = await supabase
        .from("diary_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "finalized")
        .order("entry_date", { ascending: true });

      const filled = (entries ?? []).filter((e) => e.content && e.content.trim().length > 0);

      const cover: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: "INTERNSHIP DIARY", bold: true, size: 48, font: "Times New Roman" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: "Visvesvaraya Technological University",
              italics: true,
              size: 28,
              font: "Times New Roman",
            }),
          ],
        }),
        ...labelValue("Name of the Student", profile.full_name),
        ...labelValue("USN", profile.usn),
        ...labelValue("Branch", profile.branch),
        ...labelValue("Semester", profile.semester),
        ...labelValue("College", profile.college),
        ...labelValue("Internship Title", profile.internship_title),
        ...labelValue("Internship Type", profile.internship_type),
        ...labelValue("Company / Organization", profile.company_name),
        ...labelValue("Mentor", profile.mentor_name),
        ...labelValue(
          "Duration",
          profile.start_date && profile.end_date
            ? `${format(parseISO(profile.start_date), "dd MMM yyyy")} — ${format(parseISO(profile.end_date), "dd MMM yyyy")}`
            : null,
        ),
        new Paragraph({ children: [new PageBreak()] }),
      ];

      const dayPages: Paragraph[] = [];
      filled.forEach((e, idx) => {
        const dateText = format(parseISO(e.entry_date), "EEEE, dd MMMM yyyy");
        
        let parsed;
        try {
          parsed = JSON.parse(e.content || "{}");
        } catch {
          parsed = { summary: e.content || "" };
        }

        dayPages.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: `Day ${e.day_number ?? idx + 1} — ${dateText}`,
                bold: true,
                size: 28,
                font: "Times New Roman",
              }),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888", space: 4 },
            },
          }),
        );

        // Render modular parsed JSON data natively
        dayPages.push(
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: "Work Summary: ", bold: true, size: 24, font: "Times New Roman" }),
              new TextRun({ text: parsed.summary || "No summary provided", size: 24, font: "Times New Roman" }),
            ],
          })
        );
        if (parsed.hours) {
          dayPages.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({ text: "Hours Logged: ", bold: true, size: 24, font: "Times New Roman" }),
                new TextRun({ text: String(parsed.hours), size: 24, font: "Times New Roman" }),
              ],
            })
          );
        }
        if (parsed.learnings) {
          dayPages.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({ text: "Learnings/Outcomes: ", bold: true, size: 24, font: "Times New Roman" }),
                new TextRun({ text: parsed.learnings, size: 24, font: "Times New Roman" }),
              ],
            })
          );
        }
        if (parsed.skills) {
          dayPages.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({ text: "Skills Used: ", bold: true, size: 24, font: "Times New Roman" }),
                new TextRun({ text: parsed.skills, size: 24, font: "Times New Roman" }),
              ],
            })
          );
        }

        // signature line
        dayPages.push(
          new Paragraph({
            spacing: { before: 600, after: 100 },
            children: [
              new TextRun({
                text: "Signature of the Student: ____________________     Signature of the Mentor: ____________________",
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );
        if (idx !== filled.length - 1) {
          dayPages.push(new Paragraph({ children: [new PageBreak()] }));
        }
      });

      if (filled.length === 0) {
        dayPages.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "No diary entries have been finalized yet.",
                italics: true,
                size: 24,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      }

      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Times New Roman", size: 24 } } },
        },
        sections: [
          {
            properties: {
              page: {
                size: { width: 12240, height: 15840 },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              },
            },
            children: [...cover, ...dayPages],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Internship_Diary_${(profile.usn ?? "student").replace(/\s+/g, "_")}.docx`);
      toast.success("Diary downloaded!");
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
function labelValue(label: string, value: string | null): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 26, font: "Times New Roman" }),
        new TextRun({ text: value ?? "—", size: 26, font: "Times New Roman" }),
      ],
    }),
  ];
}
