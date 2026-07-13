import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { EmpresaProvider } from "@/context/EmpresaContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/AppShell";
import { RequireCapability } from "@/components/RequireCapability";
import type { Capability } from "@/lib/rbac";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmpresasPage } from "@/pages/EmpresasPage";
import { CategoriasPage } from "@/pages/CategoriasPage";
import { CentrosCustoPage } from "@/pages/CentrosCustoPage";
import { ContasPagarPage } from "@/pages/ContasPagarPage";
import { ContasReceberPage } from "@/pages/ContasReceberPage";
import { FluxoCaixaPage } from "@/pages/FluxoCaixaPage";
import { RelatoriosPage } from "@/pages/RelatoriosPage";
import { DREPage } from "@/pages/DREPage";
import { ConciliacaoPage } from "@/pages/ConciliacaoPage";
import { RegrasPage } from "@/pages/RegrasPage";
import { DocumentosPage } from "@/pages/DocumentosPage";
import { ExportacaoContabilPage } from "@/pages/ExportacaoContabilPage";
import { CertificadosPage } from "@/pages/CertificadosPage";
import { FornecedoresPage } from "@/pages/FornecedoresPage";
import { ClientesPage } from "@/pages/ClientesPage";
import { VendedoresPage } from "@/pages/VendedoresPage";
import { ProdutosPage } from "@/pages/ProdutosPage";
import { EstoquePage } from "@/pages/EstoquePage";
import { ComprasPage } from "@/pages/ComprasPage";
import { VendasPage } from "@/pages/VendasPage";
import { CrmPage } from "@/pages/CrmPage";
import { ComissoesPage } from "@/pages/ComissoesPage";
import { MembrosPage } from "@/pages/MembrosPage";
import { AuditoriaPage } from "@/pages/AuditoriaPage";

function CapRoute({ cap, children }: { cap: Capability; children: ReactNode }) {
  return <RequireCapability cap={cap} redirect>{children}</RequireCapability>;
}

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <EmpresaProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="contas-pagar" element={<CapRoute cap="financeiro"><ContasPagarPage /></CapRoute>} />
          <Route path="contas-receber" element={<CapRoute cap="financeiro"><ContasReceberPage /></CapRoute>} />
          <Route path="fluxo-caixa" element={<CapRoute cap="financeiro"><FluxoCaixaPage /></CapRoute>} />
          <Route path="conciliacao" element={<CapRoute cap="conciliacao"><ConciliacaoPage /></CapRoute>} />
          <Route path="regras-conciliacao" element={<CapRoute cap="conciliacao"><RegrasPage /></CapRoute>} />
          <Route path="relatorios" element={<CapRoute cap="financeiro"><RelatoriosPage /></CapRoute>} />
          <Route path="dre" element={<CapRoute cap="financeiro"><DREPage /></CapRoute>} />
          <Route path="documentos" element={<CapRoute cap="documentos"><DocumentosPage /></CapRoute>} />
          <Route path="exportacao-contabil" element={<CapRoute cap="fiscal"><ExportacaoContabilPage /></CapRoute>} />
          <Route path="certificados" element={<CapRoute cap="fiscal"><CertificadosPage /></CapRoute>} />
          <Route path="fornecedores" element={<CapRoute cap="compras"><FornecedoresPage /></CapRoute>} />
          <Route path="clientes" element={<CapRoute cap="vendas"><ClientesPage /></CapRoute>} />
          <Route path="vendedores" element={<CapRoute cap="vendas"><VendedoresPage /></CapRoute>} />
          <Route path="produtos" element={<CapRoute cap="estoque"><ProdutosPage /></CapRoute>} />
          <Route path="estoque" element={<CapRoute cap="estoque"><EstoquePage /></CapRoute>} />
          <Route path="compras" element={<CapRoute cap="compras"><ComprasPage /></CapRoute>} />
          <Route path="vendas" element={<CapRoute cap="vendas"><VendasPage /></CapRoute>} />
          <Route path="crm" element={<CapRoute cap="vendas"><CrmPage /></CapRoute>} />
          <Route path="comissoes" element={<CapRoute cap="vendas"><ComissoesPage /></CapRoute>} />
          <Route path="empresas" element={<EmpresasPage />} />
          <Route path="equipe" element={<CapRoute cap="admin"><MembrosPage /></CapRoute>} />
          <Route path="categorias" element={<CapRoute cap="cadastros"><CategoriasPage /></CapRoute>} />
          <Route path="centros-custo" element={<CapRoute cap="cadastros"><CentrosCustoPage /></CapRoute>} />
          <Route path="auditoria" element={<CapRoute cap="auditoria"><AuditoriaPage /></CapRoute>} />
          <Route path="open-finance" element={<Navigate to="/" replace />} />
          <Route path="fiscal" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </EmpresaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
