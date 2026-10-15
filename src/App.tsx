import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { EmpresaProvider } from "@/context/EmpresaContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmpresasPage } from "@/pages/EmpresasPage";
import { CategoriasPage } from "@/pages/CategoriasPage";
import { CentrosCustoPage } from "@/pages/CentrosCustoPage";
import { ContasCartoesPage } from "@/pages/ContasCartoesPage";
import { ContasPagarPage } from "@/pages/ContasPagarPage";
import { TransferenciasPage } from "@/pages/TransferenciasPage";
import { ContasReceberPage } from "@/pages/ContasReceberPage";
import { FluxoCaixaPage } from "@/pages/FluxoCaixaPage";
import { RelatoriosPage } from "@/pages/RelatoriosPage";
import { DREPage } from "@/pages/DREPage";
import { ConciliacaoPage } from "@/pages/ConciliacaoPage";
import { RegrasPage } from "@/pages/RegrasPage";
import { DocumentosPage } from "@/pages/DocumentosPage";
import { ExportacaoContabilPage } from "@/pages/ExportacaoContabilPage";
import { CertificadosPage } from "@/pages/CertificadosPage";
import { FiscalPage } from "@/pages/FiscalPage";
import { FornecedoresPage } from "@/pages/FornecedoresPage";
import { ClientesPage } from "@/pages/ClientesPage";
import { ParceirosPage } from "@/pages/ParceirosPage";
import { VendedoresPage } from "@/pages/VendedoresPage";
import { ProdutosPage } from "@/pages/ProdutosPage";
import { EstoquePage } from "@/pages/EstoquePage";
import { ComprasPage } from "@/pages/ComprasPage";
import { VendasPage } from "@/pages/VendasPage";
import { CrmPage } from "@/pages/CrmPage";
import { ComissoesPage } from "@/pages/ComissoesPage";
import { MembrosPage } from "@/pages/MembrosPage";
import { AuditoriaPage } from "@/pages/AuditoriaPage";
import { RequireCapability } from "@/components/RequireCapability";

function Gate() {
  const { session, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || passwordRecovery) return <LoginPage />;

  return (
    <EmpresaProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="contas-pagar" element={<ContasPagarPage />} />
          <Route path="transferencias" element={<TransferenciasPage />} />
          <Route path="contas-receber" element={<ContasReceberPage />} />
          <Route path="fluxo-caixa" element={<FluxoCaixaPage />} />
          <Route path="conciliacao" element={<ConciliacaoPage />} />
          <Route path="regras-conciliacao" element={<RegrasPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="dre" element={<DREPage />} />
          <Route path="documentos" element={<DocumentosPage />} />
          <Route path="exportacao-contabil" element={<ExportacaoContabilPage />} />
          <Route path="certificados" element={<CertificadosPage />} />
          <Route path="fiscal" element={<FiscalPage />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="parceiros" element={<ParceirosPage />} />
          <Route path="vendedores" element={<VendedoresPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="estoque" element={<EstoquePage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="vendas" element={<VendasPage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="comissoes" element={<ComissoesPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          <Route path="equipe" element={<RequireCapability cap="admin"><MembrosPage /></RequireCapability>} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="centros-custo" element={<CentrosCustoPage />} />
          <Route path="contas-cartoes" element={<ContasCartoesPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </EmpresaProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}
