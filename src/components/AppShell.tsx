import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  FileCheck2,
  ShoppingBag,
  ShoppingCart,
  UserCog,
  Handshake,
  Package,
  Boxes,
  Target,
  Percent,
  Wallet,
  CalendarDays,
  ArrowLeftRight,
  LogOut,
  Menu,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Users2 } from "lucide-react";
import { EmpresaSelector } from "./EmpresaSelector";
import { OnboardingGuideButton } from "./OnboardingGuide";
import { useAuth } from "@/context/AuthContext";
import { useEmpresa } from "@/context/EmpresaContext";
import { can, canWrite, PAPEL_LABEL, type Capability } from "@/lib/rbac";
import { isPlataformaAdminEmail } from "@/lib/acesso";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Uma capacidade, ou qualquer uma da lista. */
  cap: Capability | Capability[];
}

function itemVisible(papel: Parameters<typeof can>[0], cap: Capability | Capability[]): boolean {
  if (!papel) return true;
  const caps = Array.isArray(cap) ? cap : [cap];
  return caps.some((c) => can(papel, c));
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Financeiro",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, cap: "dashboard" },
      { to: "/contas-pagar", label: "Contas a Pagar", icon: ArrowUpCircle, cap: "financeiro" },
      { to: "/transferencias", label: "Transferência entre contas", icon: ArrowLeftRight, cap: "financeiro" },
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
      { to: "/fiscal", label: "Emissão & SPED", icon: FileCheck2, cap: "fiscal" },
    ],
  },
  {
    title: "Vendas",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingBag, cap: "vendas" },
      { to: "/crm", label: "CRM", icon: Target, cap: "vendas" },
      { to: "/vendedores", label: "Vendedores", icon: UserCog, cap: "vendas" },
      { to: "/comissoes", label: "Comissões", icon: Percent, cap: "vendas" },
    ],
  },
  {
    title: "Compras",
    items: [
      { to: "/compras", label: "Compras", icon: ShoppingCart, cap: "compras" },
    ],
  },
  {
    title: "Parceiros",
    items: [
      { to: "/parceiros", label: "Parceiros", icon: Handshake, cap: ["vendas", "compras"] },
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
      { to: "/feriados", label: "Feriados", icon: CalendarDays, cap: "cadastros" },
      { to: "/contas-cartoes", label: "Contas e Cartões", icon: Wallet, cap: "cadastros" },
      { to: "/auditoria", label: "Auditoria", icon: ScrollText, cap: "auditoria" },
    ],
  },
];

function itemIsActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function sectionHasActive(items: NavItem[], pathname: string): boolean {
  return items.some((it) => itemIsActive(it.to, pathname));
}

function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: { title: string; items: NavItem[] }[];
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  /** undefined = automático (abre se rota ativa); true/false = escolha do usuário */
  const [manual, setManual] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setManual((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of sections) {
        if (sectionHasActive(s.items, pathname) && next[s.title] === false) {
          next[s.title] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // sections muda de referência a cada render; pathname basta para reabrir a seção ativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function isOpen(title: string, items: NavItem[]): boolean {
    if (manual[title] !== undefined) return manual[title];
    return sectionHasActive(items, pathname);
  }

  function toggle(title: string, items: NavItem[]) {
    setManual((prev) => ({
      ...prev,
      [title]: !isOpen(title, items),
    }));
  }

  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
      {sections.map((section) => {
        const open = isOpen(section.title, section.items);
        const active = sectionHasActive(section.items, pathname);
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => toggle(section.title, section.items)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider transition-colors",
                active
                  ? "text-muted-foreground"
                  : "text-muted-foreground/80 hover:text-muted-foreground"
              )}
            >
              <span>{section.title}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                  open ? "rotate-0" : "-rotate-90"
                )}
                aria-hidden
              />
            </button>
            {open && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors",
                        isActive
                          ? "border-[#C5DDD0] bg-[#E8F3EC] font-semibold text-primary"
                          : "border-transparent font-normal text-[#8A9690] hover:bg-[#E8F3EC]/60 hover:text-primary"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isActive
                              ? "stroke-[2] text-primary"
                              : "stroke-[1.5] text-[#8A9690]"
                          )}
                          aria-hidden
                        />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { papel } = useEmpresa();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("pj-sidebar-open") !== "0";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("pj-sidebar-open", sidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  const sections = [
    ...SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => itemVisible(papel, it.cap)),
    })).filter((s) => s.items.length > 0),
    ...(isPlataformaAdminEmail(user?.email)
      ? [
          {
            title: "Plataforma",
            items: [
              {
                to: "/admin-plataforma",
                label: "Admin plataforma",
                icon: Shield,
                cap: "dashboard" as Capability,
              },
            ],
          },
        ]
      : []),
  ];
  const readOnly = papel != null && !canWrite(papel);

  const userFooter = (
    <div className="border-t border-border/70 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground" title={user?.email ?? ""}>
            {user?.email ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">{papel ? PAPEL_LABEL[papel] : "—"}</p>
        </div>
        <button
          className="btn-ghost btn-sm shrink-0 text-muted-foreground"
          onClick={() => signOut()}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      {sidebarOpen && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-white md:flex">
          <div className="flex items-center gap-3 px-4 py-5">
            <img
              src="/logo-iafe.png"
              alt="IAFÉ PJ"
              className="h-11 w-auto max-w-[11.5rem] shrink object-contain object-left"
            />
            <button
              type="button"
              className="btn-ghost btn-sm ml-auto shrink-0 text-muted-foreground"
              title="Esconder menu"
              aria-label="Esconder menu"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <SidebarNav sections={sections} />
          {userFooter}
        </aside>
      )}

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <img
                src="/logo-iafe.png"
                alt="IAFÉ PJ"
                className="h-10 w-auto max-w-[11rem] object-contain object-left"
              />
              <button className="btn-ghost btn-sm text-muted-foreground" onClick={() => setDrawerOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
            {userFooter}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost btn-sm md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {!sidebarOpen && (
              <button
                type="button"
                className="btn-ghost btn-sm hidden md:inline-flex"
                title="Mostrar menu"
                aria-label="Mostrar menu"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            )}
            <img
              src="/logo-iafe.png"
              alt="IAFÉ PJ"
              className="h-8 w-auto max-w-[9.5rem] object-contain object-left md:hidden"
            />
            {!sidebarOpen && (
              <img
                src="/logo-iafe.png"
                alt="IAFÉ PJ"
                className="hidden h-9 w-auto max-w-[10.5rem] object-contain object-left md:inline"
              />
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <OnboardingGuideButton />
            <EmpresaSelector />
          </div>
        </header>

        {readOnly && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 md:px-8">
            Acesso somente leitura ({papel ? PAPEL_LABEL[papel] : ""}). Alterações estão desabilitadas.
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
