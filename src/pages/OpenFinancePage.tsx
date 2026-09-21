import { Banknote, ShieldCheck, FileText, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function OpenFinanceInner() {
  return (
    <>
      <PageHeader
        title="Open Finance"
        subtitle="Importação automática de extratos via Open Finance."
      />

      <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Planejado.</strong> O Open Finance exige um <strong>provedor certificado</strong> pelo
        Banco Central e fluxo de consentimento do cliente. Por isso esta integração não é construída
        diretamente no app — depende de contratar um agregador/initiator homologado.
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Requisito
          icon={ShieldCheck}
          titulo="Provedor certificado"
          texto="Contratar um agregador homologado (ex.: Pluggy, Belvo, Klavi) ou habilitar-se como instituição participante."
        />
        <Requisito
          icon={Link2}
          titulo="Consentimento"
          texto="Implementar o fluxo de consentimento do cliente (escopo, prazo e revogação) conforme as regras do Open Finance Brasil."
        />
        <Requisito
          icon={Banknote}
          titulo="Sincronização"
          texto="Receber contas e transações via API do provedor e alimentar a Conciliação Bancária automaticamente."
        />
        <Requisito
          icon={FileText}
          titulo="Governança"
          texto="Auditoria de acessos, segurança de tokens e LGPD (consentimento, exportação e exclusão de dados)."
        />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Enquanto isso, use a <strong>Conciliação Bancária</strong> com importação de <strong>OFX</strong>,
        que cobre o mesmo objetivo de forma manual. Detalhes técnicos em{" "}
        <code>docs/OPEN_FINANCE.md</code>.
      </p>
    </>
  );
}

export function OpenFinancePage() {
  return <RequireEmpresa>{() => <OpenFinanceInner />}</RequireEmpresa>;
}

function Requisito({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: typeof Banknote;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 text-primary" /> {titulo}
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
