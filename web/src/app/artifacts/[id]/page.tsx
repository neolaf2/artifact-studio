import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArtifactEditor } from '@/components/ArtifactEditor';
import { loadArtifact } from '@/lib/loadArtifact';
import { getArtifactMeta } from '@/lib/registry';

type Props = { params: Promise<{ id: string }> };

export default async function ArtifactPage({ params }: Props) {
  const { id } = await params;
  if (!getArtifactMeta(id)) notFound();
  const bundle = await loadArtifact(id);
  return (
    <div>
      <div className="border-b border-zinc-200 bg-white px-4 py-2 text-sm lg:px-6">
        <Link href="/" className="text-amber-800 hover:underline">
          ← Artifacts
        </Link>
      </div>
      <ArtifactEditor initial={bundle} />
    </div>
  );
}
