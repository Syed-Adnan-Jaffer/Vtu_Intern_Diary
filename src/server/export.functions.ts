import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from "docx";
import { format, parseISO } from "date-fns";

export const exportDiaryDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: profile, error: pErr } = await supabase.from("profiles").select("*").single();
    if (pErr || !profile) throw new Error("Profile not found");

    const { data: entries, error: eErr } = await supabase
      .from("diary_entries")
      .select("*")
      .order("entry_date", { ascending: true });
    if (eErr) throw new Error("Failed to load entries");

    const filled = (entries ?? []).filter((e) => e.content && e.content.trim().length > 0);

    const cover: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: "INTERNSHIP DIARY", bold: true, size: 48, font: "Times New Roman" }),
        ],
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
      dayPages.push(
        new Paragraph({
          spacing: { before: 200, after: 200, line: 360 },
          children: [
            new TextRun({ text: e.content ?? "", size: 24, font: "Times New Roman" }),
          ],
        }),
      );
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

    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, filename: `Internship_Diary_${(profile.usn ?? "student").replace(/\s+/g, "_")}.docx` };
  });

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
