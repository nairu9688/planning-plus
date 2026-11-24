import { Skeleton, Spinner } from "@/components/ui/spinner";

/** Affiché instantanément pendant le chargement d'une page de l'app. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-center gap-3">
        <Spinner className="text-primary" label="Chargement…" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
