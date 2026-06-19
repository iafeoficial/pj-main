import { NavLink, Outlet, Link } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Tags,
  Layers,
  FileBarChart,
  Building2,
  ScrollText,
  Landmark,
  Filter,
  Receipt,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Package,
  Boxes,
  Target,
  Percent,
  LogOut,
  Mail,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Users2 } from "lucide-react";
import { EmpresaSelector } from "./EmpresaSelector";
import { useAuth } from "@/context/AuthContext";
import { useEmpresa } from "@/context/EmpresaContext";
import { conviteService } from "@/data/membros";
import { useAsyncData } from "@/hooks/useAsyncData";
import { can, canWrite, PAPEL_LABEL, type Capability } from "@/lib/rbac";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  cap: Capability;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Financeiro",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, cap: "dashboard" },
      { to: "/contas-pagar", label: "Contas a Pagar", icon: ArrowUpCircle, cap: "financeiro" },
      { to: "/contas-receber", label: "Contas a Receber", icon: ArrowDownCircle, cap: "financeiro" },
      { to: "/fluxo-caixa", label: "Fluxo de Caixa", icon: TrendingUp, cap: "financeiro" },
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart, cap: "financeiro" },
      { to: "/dre", label: "DRE", icon: Receipt, cap: "financeiro" },
    ],
  },
  {
    title: "Conciliação",
    items: [
      { to: "/conciliacao", label: "Conciliação Bancária", icon: Landmark, cap: "conciliacao" },
      { to: "/regras-conciliacao", label: "Regras", icon: Filter, cap: "conciliacao" },
    ],
  },
  {
    title: "Documentos",
    items: [
      { to: "/documentos", label: "Documentos (NF-e/Boleto)", icon: FileText, cap: "documentos" },
    ],
  },
  {
    title: "Fiscal",
    items: [
      { to: "/exportacao-contabil", label: "Exportação Contábil", icon: FileSpreadsheet, cap: "fiscal" },
      { to: "/certificados", label: "Certificados", icon: ShieldCheck, cap: "fiscal" },
    ],
  },
  {
    title: "Vendas",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingBag, cap: "vendas" },
      { to: "/crm", label: "CRM", icon: Target, cap: "vendas" },
      { to: "/clientes", label: "Clientes", icon: Users, cap: "vendas" },
      { to: "/vendedores", label: "Vendedores", icon: UserCog, cap: "vendas" },
      { to: "/comissoes", label: "Comissões", icon: Percent, cap: "vendas" },
    ],
  },
  {
    title: "Compras",
    items: [
      { to: "/compras", label: "Compras", icon: ShoppingCart, cap: "compras" },
      { to: "/fornecedores", label: "Fornecedores", icon: Truck, cap: "compras" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { to: "/produtos", label: "Produtos", icon: Package, cap: "estoque" },
      { to: "/estoque", label: "Movimentações", icon: Boxes, cap: "estoque" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { to: "/empresas", label: "Empresas", icon: Building2, cap: "dashboard" },
      { to: "/equipe", label: "Equipe", icon: Users2, cap: "admin" },
      { to: "/categorias", label: "Categorias", icon: Tags, cap: "cadastros" },
      { to: "/centros-custo", label: "Centros de Custo", icon: Layers, cap: "cadastros" },
      { to: "/auditoria", label: "Auditoria", icon: ScrollText, cap: "auditoria" },
    ],
  },
];

function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: { title: string; items: NavItem[] }[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({
  userEmail,
  papel,
  onSignOut,
}: {
  userEmail?: string;
  papel: ReturnType<typeof useEmpresa>["papel"];
  onSignOut: () => void;
}) {
  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={userEmail ?? ""}>
            {userEmail ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {papel ? PAPEL_LABEL[papel] : "—"}
          </p>
        </div>
        <button className="btn-ghost btn-sm shrink-0" onClick={onSignOut} title="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { papel, version } = useEmpresa();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: convitesPendentes } = useAsyncData(
    () => (user?.email ? conviteService.meusPendentes(user.email) : Promise.resolve([])),
    [user?.email, version],
    []
  );
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((it) => !papel || can(papel, it.cap)),
  })).filter((s) => s.items.length > 0);
  const readOnly = papel != null && !canWrite(papel);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">PJ</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Finanças PJ</p>
            <p className="text-xs text-muted-foreground">Gestão financeira</p>
          </div>
        </div>

        <SidebarNav sections={sections} />
        <SidebarFooter userEmail={user?.email} papel={papel} onSignOut={() => signOut()} />
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={closeMobileMenu}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">PJ</span>
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Finanças PJ</p>
                  <p className="text-xs text-muted-foreground">Menu</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={closeMobileMenu}
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <SidebarNav sections={sections} onNavigate={closeMobileMenu} />
            <SidebarFooter userEmail={user?.email} papel={papel} onSignOut={() => signOut()} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <button
              type="button"
              className="btn-ghost btn-sm shrink-0"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-semibold">Finanças PJ</span>
          </div>
          <div className="ml-auto">
            <EmpresaSelector />
          </div>
        </header>

        {readOnly && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 md:px-8">
            Acesso somente leitura ({papel ? PAPEL_LABEL[papel] : ""}). Alterações estão desabilitadas.
          </div>
        )}
        {convitesPendentes.length > 0 && (
          <div className="border-b border-primary/30 bg-accent/50 px-4 py-2 text-center text-sm md:px-8">
            <span className="inline-flex flex-wrap items-center justify-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Você tem {convitesPendentes.length} convite(s) pendente(s).
              <Link to="/empresas" className="font-medium text-primary underline-offset-2 hover:underline">
                Ver convites
              </Link>
            </span>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
