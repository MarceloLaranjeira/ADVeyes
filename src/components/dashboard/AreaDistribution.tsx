export const AreaDistribution = () => {
  const areas = [
    { name: "Penal", count: 45, percentage: 35, color: "bg-destructive" },
    { name: "Execução Penal", count: 28, percentage: 22, color: "bg-warning" },
    { name: "Recursos", count: 25, percentage: 20, color: "bg-accent" },
    { name: "Cível", count: 18, percentage: 14, color: "bg-info" },
    { name: "Família", count: 12, percentage: 9, color: "bg-success" },
  ];

  return (
    <div className="bg-card rounded-lg border p-5">
      <h3 className="font-serif text-lg font-semibold">Distribuição por Área</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-5">Total de 128 processos ativos</p>
      <div className="space-y-4">
        {areas.map((area) => (
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
    </div>
  );
};
