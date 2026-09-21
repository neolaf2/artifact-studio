import { ProjectsDashboard } from '@/components/ProjectsDashboard';
import { listArtifacts } from '@/lib/projectStore';
import { ARTIFACT_TEMPLATES } from '@/lib/templates';

export default async function HomePage() {
  const projects = await listArtifacts();
  const templates = ARTIFACT_TEMPLATES.map((t) => ({
    id: t.templateId,
    title: t.title,
    titleZh: t.titleZh,
    description: t.description,
    descriptionZh: t.descriptionZh,
  }));
  return <ProjectsDashboard projects={projects} templates={templates} />;
}
