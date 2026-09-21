import { NextResponse } from 'next/server';
import { getLlmConfigStatus } from '@/lib/llm/config';

export async function GET() {
  return NextResponse.json(getLlmConfigStatus());
}
