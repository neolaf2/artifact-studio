import { NextResponse } from 'next/server';
import {
  createArtifactFromTemplate,
  listArtifacts,
} from '@/lib/projectStore';
import { ARTIFACT_TEMPLATES } from '@/lib/templates';
import type { TemplateId } from '@/lib/templates';

export async function GET() {
  try {
    const artifacts = await listArtifacts();
    return NextResponse.json({
      artifacts,
      templates: ARTIFACT_TEMPLATES.map((t) => ({
        id: t.templateId,
        title: t.title,
        titleZh: t.titleZh,
        description: t.description,
        descriptionZh: t.descriptionZh,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'List failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      template?: string;
      id?: string;
    };
    const template = body.template as TemplateId | undefined;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (template !== 'clarification' && template !== 'tender') {
      return NextResponse.json(
        { error: 'template must be clarification or tender' },
        { status: 400 },
      );
    }
    const result = await createArtifactFromTemplate({
      name: body.name.trim(),
      template,
      id: body.id?.trim(),
    });
    return NextResponse.json(
      { ok: true, id: result.id, meta: result.meta },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create failed';
    const status =
      /already exists|reserved|Invalid|required|Unknown template/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
