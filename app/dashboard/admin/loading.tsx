export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-1/3 rounded-md bg-muted animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
