export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-label="Carregando painel" role="status">
      <div className="h-20 rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-96 rounded-xl bg-muted xl:col-span-2" />
        <div className="h-96 rounded-xl bg-muted" />
      </div>
      <span className="sr-only">Carregando dados operacionais do escritório</span>
    </div>
  );
}

