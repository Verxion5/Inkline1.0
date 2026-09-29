import { get } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toProject } from "@/lib/serialize";
import { notFound, redirect } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const user = currentUser();
  if (!user) redirect("/login");
  const row = get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ? AND user_id = ?", params.id, user.id);
  if (!row) notFound();
  const project = toProject(row);
  return (
    <div>
      <ProjectNav
        id={project.id}
        title={project.title}
        format={project.format}
        status={project.status}
        coverUrl={project.coverUrl}
        readingDirection={project.readingDirection}
      />
      {children}
    </div>
  );
}
