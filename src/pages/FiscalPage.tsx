import { FileCheck2, ShieldCheck, Server, FileText, Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export function FiscalPage() {
  return (
    <>
      <PageHeader
        title="Emissão Fiscal & SPED"
        subtitle="Emissão de NFS-e/NF-e e geração de SPED."
      />

      <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Planejado.</strong> A emissão fiscal e o SPED reais exigem <strong>certificado digital
        A1</strong> usado no servidor, integração com SEFAZ/prefeituras (ou um <strong>provedor
        homologado</strong>) e uma camada fiscal completa. Por segurança, isso não roda no navegador.
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold">Emissão de NFS-e / NF-e</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card icon={FileCheck2} titulo="Provedor homologado" texto="Integrar um emissor (Focus NFe, PlugNotas, eNotas, NFe.io) que abstrai SEFAZ e prefeituras." />
        <Card icon={ShieldCheck} titulo="Certificado A1 (server-side)" texto="A assinatura do XML usa a chave privada — sempre no backend, nunca no cliente. Veja o cadastro em Certificados." />
        <Card icon={Server} titulo="Backend de emissão" texto="Endpoints para emitir, cancelar e consultar notas, com fila e tratamento de contingência." />
        <Card icon={FileText} titulo="Armazenamento" texto="Guardar XML/DANFE e vincular às contas a pagar/receber (reuso do módulo Documentos)." />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">SPED</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card icon={Landmark} titulo="EFD ICMS/IPI, Contribuições, ECD, ECF" texto="Cada bloco exige dados fiscais/contábeis completos (NF-e, itens, CFOP, plano de contas oficial)." />
        <Card icon={FileText} titulo="Geração de arquivos" texto="Os arquivos SPED são layouts de texto posicionais validados pelo PVA. Requer a camada fiscal modelada." />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Hoje, para o contador, use a <strong>Exportação Contábil</strong> (lançamentos a débito/crédito
        em CSV). Requisitos detalhados em <code>docs/FISCAL.md</code> e <code>docs/SPED.md</code>.
      </p>
    </>
  );
}

function Card({ icon: Icon, titulo, texto }: { icon: typeof FileText; titulo: string; texto: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 text-primary" /> {titulo}
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
