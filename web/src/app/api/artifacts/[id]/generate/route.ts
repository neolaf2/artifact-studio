import { NextResponse } from 'next/server';
import { loadArtifact } from '@/lib/loadArtifact';
import { getArtifactMeta } from '@/lib/registry';
import { completeJsonPrompt } from '@/lib/llm/client';
import {
  buildArtifactPrompt,
  buildFieldPrompt,
  normalizeGenerationResult,
} from '@/lib/llm/prompts';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getArtifactMeta(id)) {
    return NextResponse.json({ error: 'Unknown artifact' }, { status: 404 });
  }
  try {
    const body = (await req.json()) as {
      mode?: 'field' | 'artifact';
      path?: string;
      instruction?: string;
      data?: Record<string, unknown>;
    };
    const mode = body.mode === 'field' ? 'field' : 'artifact';
    if (mode === 'field' && !body.path) {
      return NextResponse.json({ error: 'field mode requires path' }, { status: 400 });
    }
    const bundle = await loadArtifact(id);
    const data = body.data || bundle.data;
    const prompt =
      mode === 'field'
        ? buildFieldPrompt({
            path: body.path!,
            instruction: body.instruction,
            schema: bundle.schema,
            ontology: bundle.tboxMarkdown,
            data,
            artifactKind: bundle.meta.tboxLabel,
          })
        : buildArtifactPrompt({
            instruction: body.instruction,
            schema: bundle.schema,
            ontology: bundle.tboxMarkdown,
            data,
            artifactKind: bundle.meta.tboxLabel,
          });
    const raw = await completeJsonPrompt(prompt);
    const result = normalizeGenerationResult(mode, raw);
    return NextResponse.json({ mode, ...result, rawPreview: raw.slice(0, 200) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
