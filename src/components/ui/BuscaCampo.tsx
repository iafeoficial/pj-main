import { Search } from "lucide-react";

export function BuscaCampo({
  value,
  onChange,
  placeholder = "Buscar por nome, CPF, CNPJ, valor ou data",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-[16rem] flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        className="input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar"
        type="search"
      />
    </div>
  );
}

export function BuscaVazia() {
  return (
    <p className="card px-4 py-8 text-center text-sm text-muted-foreground">
      Nenhum resultado para esta busca.
    </p>
  );
}
