import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  candidateId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
});

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).slice(0, 30000);
}

export const analyzeCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify candidate belongs to user (RLS also enforces, but be explicit)
    const { data: cand, error: candErr } = await supabase
      .from("candidates")
      .select("id, user_id")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (candErr) throw new Error(candErr.message);
    if (!cand) throw new Error("Candidate not found");

    // Download CV from storage (admin client – path is scoped to userId folder)
    if (!data.storagePath.startsWith(`${userId}/`)) {
      throw new Error("Invalid CV path");
    }
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("cvs")
      .download(data.storagePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download CV");

    const cvText = await extractPdfText(await file.arrayBuffer());
    if (!cvText.trim()) throw new Error("Could not extract text from PDF");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an expert technical recruiter. Analyze the CV and return structured output via the provided tool. Be concise and specific.",
          },
          {
            role: "user",
            content: `Analyze this CV and score the candidate.\n\nCV TEXT:\n${cvText}`,
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
        tools: [
          {
            type: "function",
            function: {
              name: "submit_analysis",
              description: "Submit structured CV analysis",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "integer", minimum: 0, maximum: 100 },
                  summary: { type: "string", description: "3 lines max" },
                  strengths: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  recommendation: { type: "string", enum: ["hire", "maybe", "reject"] },
                },
                required: ["score", "summary", "strengths", "risks", "recommendation"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("AI rate limit – try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable workspace.");
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return analysis");
    const parsed = JSON.parse(args) as {
      score: number;
      summary: string;
      strengths: string[];
      risks: string[];
      recommendation: string;
    };

    const { error: upErr } = await supabase
      .from("candidates")
      .update({
        ai_score: parsed.score,
        ai_summary: `${parsed.summary}\n\nRecommendation: ${parsed.recommendation}`,
        ai_strengths: parsed.strengths.map((s) => `• ${s}`).join("\n"),
        ai_risks: parsed.risks.map((s) => `• ${s}`).join("\n"),
      })
      .eq("id", data.candidateId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, score: parsed.score };
  });