export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-1/3 rounded-md bg-muted animate-pulse" />
      <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
