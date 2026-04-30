import { useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">项目详情</h1>
      <p className="mt-2 text-muted-foreground">
        项目 ID: {projectId} — 将在 M1 实现
      </p>
    </div>
  );
}
