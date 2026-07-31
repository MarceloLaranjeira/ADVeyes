interface AreaDistributionProps {
  areas: Array<{ name: string; count: number }>;
}

const areaColors = [
  "bg-destructive",
  "bg-warning",
  "bg-accent",
  "bg-info",
  "bg-success",
];

export const AreaDistribution = ({ areas }: AreaDistributionProps) => {
  const total = areas.reduce((sum, area) => sum + area.count, 0);
  const distribution = areas
    .filter((area) => area.count > 0)
    .sort((left, right) => right.count - left.count)
    .map((area, index) => ({
      ...area,
      percentage: total > 0 ? Math.round((area.count / total) * 100) : 0,
      color: areaColors[index % areaColors.length],
    }));

  return (
    <div className="bg-card rounded-lg border p-5">
      <h3 className="font-serif text-lg font-semibold">Distribuição por Área</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-5">
        {total === 1 ? "1 processo cadastrado" : `${total} processos cadastrados`}
      </p>
      {distribution.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum processo cadastrado neste escritório.
        </p>
      ) : (
        <div className="space-y-4">
          {distribution.map((area) => (
            <div key={area.name}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">{area.name}</span>
                <span className="text-muted-foreground text-xs">{area.count} ({area.percentage}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${area.color} transition-all duration-500`}
                  style={{ width: `${area.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
