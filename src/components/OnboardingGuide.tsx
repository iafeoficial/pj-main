import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CircleHelp, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEmpresa } from "@/context/EmpresaContext";
import { isPlataformaAdminEmail } from "@/lib/acesso";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "financas_pj:guia_visto_v2";

type ModoGuia = "sem-empresa" | "admin" | "membro";

function modoGuia(temEmpresa: boolean, isOwnerLike: boolean): ModoGuia {
  if (!temEmpresa) return "sem-empresa";
  if (isOwnerLike) return "admin";
  return "membro";
}

const MAPA_MENU: { secao: string; pagina: string; texto: string }[] = [
  {
    secao: "Financeiro",
    pagina: "Dashboard",
    texto: "visão geral dos saldos e do período. Vá em Financeiro e clique em Dashboard.",
  },
  {
    secao: "Financeiro",
    pagina: "Contas a Pagar",
    texto:
      "contas que a empresa precisa pagar. Vá em Financeiro, Contas a Pagar, e use Novo lançamento ou Importar planilha ou XML.",
  },
  {
    secao: "Financeiro",
    pagina: "Transferência entre contas",
    texto:
      "mover dinheiro de uma conta para outra sem contar como gasto. Vá em Financeiro e clique em Transferência entre contas.",
  },
  {
    secao: "Financeiro",
    pagina: "Contas a Receber",
    texto:
      "valores que clientes devem pagar a você. Vá em Financeiro, Contas a Receber, e use Novo lançamento ou Importar.",
  },
  {
    secao: "Financeiro",
    pagina: "Fluxo de Caixa",
    texto:
      "entradas e saídas no tempo e saldo das contas. Vá em Financeiro e clique em Fluxo de Caixa.",
  },
  {
    secao: "Financeiro",
    pagina: "Relatórios",
    texto: "listas e resumos para acompanhar o financeiro. Vá em Financeiro e clique em Relatórios.",
  },
  {
    secao: "Financeiro",
    pagina: "DRE",
    texto:
      "resultado do período (receita, custos, lucro). Vá em Financeiro e clique em DRE. Ajuste Início e Fim no topo da tela.",
  },
  {
    secao: "Conciliação",
    pagina: "Conciliação Bancária",
    texto:
      "bater o extrato do banco com os lançamentos. Vá em Conciliação e clique em Conciliação Bancária.",
  },
  {
    secao: "Conciliação",
    pagina: "Regras",
    texto:
      "regras automáticas para sugerir combinações no extrato. Vá em Conciliação e clique em Regras.",
  },
  {
    secao: "Documentos",
    pagina: "Documentos (NF-e/Boleto)",
    texto:
      "importar notas e boletos para virar conta a pagar. Vá em Documentos no menu esquerdo.",
  },
  {
    secao: "Fiscal",
    pagina: "Exportação Contábil",
    texto: "baixar lançamentos em CSV para o contador. Vá em Fiscal e clique em Exportação Contábil.",
  },
  {
    secao: "Fiscal",
    pagina: "Certificados",
    texto: "cadastrar certificado digital da empresa. Vá em Fiscal e clique em Certificados.",
  },
  {
    secao: "Fiscal",
    pagina: "Emissão e SPED",
    texto: "área de emissão fiscal e SPED (conforme o que estiver liberado). Vá em Fiscal.",
  },
  {
    secao: "Vendas",
    pagina: "Vendas",
    texto: "registrar vendas e gerar conta a receber. Vá em Vendas no menu.",
  },
  {
    secao: "Vendas",
    pagina: "CRM",
    texto: "acompanhar oportunidades e clientes em potencial. Vá em Vendas e clique em CRM.",
  },
  {
    secao: "Vendas",
    pagina: "Vendedores",
    texto: "cadastrar quem vende. Vá em Vendas e clique em Vendedores.",
  },
  {
    secao: "Vendas",
    pagina: "Comissões",
    texto: "ver comissões geradas pelas vendas. Vá em Vendas e clique em Comissões.",
  },
  {
    secao: "Compras",
    pagina: "Compras",
    texto: "registrar compras e gerar conta a pagar. Vá em Compras no menu.",
  },
  {
    secao: "Parceiros",
    pagina: "Parceiros",
    texto: "clientes e fornecedores juntos. Vá em Parceiros no menu.",
  },
  {
    secao: "Estoque",
    pagina: "Produtos",
    texto: "cadastrar produtos. Vá em Estoque e clique em Produtos.",
  },
  {
    secao: "Estoque",
    pagina: "Movimentações",
    texto: "entradas e saídas de estoque. Vá em Estoque e clique em Movimentações.",
  },
  {
    secao: "Cadastros",
    pagina: "Empresas",
    texto: "criar ou escolher a empresa. Vá em Cadastros e clique em Empresas.",
  },
  {
    secao: "Cadastros",
    pagina: "Equipe",
    texto: "convidar pessoas e definir papéis. Vá em Cadastros e clique em Equipe.",
  },
  {
    secao: "Cadastros",
    pagina: "Categorias",
    texto: "tipos de receita e despesa. Vá em Cadastros, Categorias, e use o botão de nova categoria.",
  },
  {
    secao: "Cadastros",
    pagina: "Centros de Custo",
    texto: "organizar gastos por área. Vá em Cadastros e clique em Centros de Custo.",
  },
  {
    secao: "Cadastros",
    pagina: "Feriados",
    texto: "dias sem vencimento útil. Vá em Cadastros e clique em Feriados.",
  },
  {
    secao: "Cadastros",
    pagina: "Contas e Cartões",
    texto: "bancos, caixa e cartões. Vá em Cadastros e clique em Contas e Cartões.",
  },
  {
    secao: "Cadastros",
    pagina: "Auditoria",
    texto: "histórico do que foi alterado. Vá em Cadastros e clique em Auditoria.",
  },
];

export function OnboardingGuideButton() {
  const { user } = useAuth();
  const { empresas, empresaAtiva, papel } = useEmpresa();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const temEmpresa = empresas.length > 0;
  const isOwnerLike =
    papel === "administrador" || papel === "financeiro" || papel === "gestor";
  const modo = modoGuia(temEmpresa, !!empresaAtiva && isOwnerLike);
  const showAdminMap = isPlataformaAdminEmail(user?.email);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const key = `${STORAGE_KEY}:${user.id}`;
      if (localStorage.getItem(key) === "1") return;
      setOpen(true);
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm relative text-muted-foreground"
        title="Como começar"
        aria-label="Como começar"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          ?
        </span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-stretch justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Fechar guia"
              onClick={() => setOpen(false)}
            />
            <aside
              className={cn(
                "relative z-[101] flex h-full w-full max-w-md flex-col bg-white shadow-xl",
                "max-sm:max-w-none sm:max-w-md"
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="guia-titulo"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2
                    id="guia-titulo"
                    className="font-display text-lg font-semibold tracking-tight"
                  >
                    Como começar
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Siga na ordem. Em cada passo dizemos a página e onde clicar no menu.
                  </p>
                </div>
                <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-sm leading-relaxed text-foreground sm:space-y-5 sm:px-5">
                <Passo n={1} titulo="Sua conta (já feito)">
                  Você já entrou com e-mail e senha. No rodapé da barra lateral aparece o seu e-mail:
                  isso é só o login, ainda não é a empresa.
                </Passo>

                {modo === "sem-empresa" && (
                  <Passo n={2} titulo="Cadastrar a empresa" destaque>
                    Sem empresa o sistema não guarda as contas. No menu esquerdo, abra a seção{" "}
                    <strong>Cadastros</strong> e clique em <strong>Empresas</strong>. Na tela, use{" "}
                    <strong>Nova empresa</strong>, preencha nome e CNPJ e salve. Se quiser só
                    testar, clique em <strong>Carregar demonstração</strong>. Se alguém te
                    convidou, aceite o convite nessa mesma página.
                  </Passo>
                )}

                {modo === "membro" && (
                  <Passo n={2} titulo="Sua empresa já está pronta" destaque>
                    Você entrou como convidado, então não precisa cadastrar CNPJ. A empresa já
                    existe. No topo da tela, use o seletor de empresa se tiver mais de uma. Se
                    faltar permissão, peça ao administrador (página{" "}
                    <strong>Cadastros</strong> → <strong>Equipe</strong> no lado dele).
                  </Passo>
                )}

                {modo === "admin" && (
                  <Passo n={2} titulo="Escolher ou criar empresa" destaque>
                    A empresa ativa fica no seletor do topo. Para criar outra: menu{" "}
                    <strong>Cadastros</strong> → <strong>Empresas</strong> → botão{" "}
                    <strong>Nova empresa</strong>. Sem empresa selecionada, as telas financeiras
                    ficam vazias.
                  </Passo>
                )}

                <Passo n={3} titulo="Organizar categorias e contas">
                  Ainda em <strong>Cadastros</strong>:
                  <ul className="mt-2 list-disc space-y-1.5 pl-4">
                    <li>
                      <strong>Categorias</strong>: tipos de gasto e receita. Clique em Nova
                      categoria.
                    </li>
                    <li>
                      <strong>Centros de Custo</strong>: se quiser separar por área (ex.: loja,
                      escritório).
                    </li>
                    <li>
                      <strong>Contas e Cartões</strong>: banco, caixa ou cartão onde o dinheiro
                      entra e sai. Cadastre pelo menos uma conta.
                    </li>
                  </ul>
                </Passo>

                <Passo n={4} titulo="Registrar o dia a dia">
                  No menu <strong>Financeiro</strong>:
                  <ul className="mt-2 list-disc space-y-1.5 pl-4">
                    <li>
                      <strong>Contas a Pagar</strong>: o que a empresa deve pagar. Use Novo
                      lançamento ou Importar planilha ou XML.
                    </li>
                    <li>
                      <strong>Contas a Receber</strong>: o que clientes devem pagar a você. Mesmos
                      botões de novo ou importar.
                    </li>
                    <li>
                      Depois abra <strong>Dashboard</strong> e <strong>Fluxo de Caixa</strong> para
                      ver os números.
                    </li>
                  </ul>
                </Passo>

                <Passo n={5} titulo="Convidar a equipe">
                  Se outras pessoas forem usar: menu <strong>Cadastros</strong> →{" "}
                  <strong>Equipe</strong>. Convide pelo e-mail e escolha o papel (só ver,
                  financeiro, administrador, etc.).
                </Passo>

                <Passo n={6} titulo="Mapa do menu (o que cada página faz)">
                  Use o menu da esquerda. Em cada item: abra a seção e clique no nome da página.
                  <ul className="mt-3 space-y-2.5">
                    {MAPA_MENU.map((item) => (
                      <li key={`${item.secao}-${item.pagina}`}>
                        <strong>{item.pagina}</strong>
                        <span className="text-muted-foreground"> (menu {item.secao})</span>
                        {": "}
                        <span className="text-muted-foreground">{item.texto}</span>
                      </li>
                    ))}
                    {showAdminMap && (
                      <li>
                        <strong>Admin plataforma</strong>
                        <span className="text-muted-foreground"> (menu Plataforma)</span>
                        {": definir período de uso e bloquear empresa ou usuário. Vá em Plataforma e clique em Admin plataforma."}
                      </li>
                    )}
                  </ul>
                </Passo>

                <Passo n={7} titulo="Em dúvida?">
                  Este botão de ajuda (<strong>?</strong>) fica sempre no topo, ao lado do seletor
                  de empresa. Se a tela pedir para selecionar uma empresa, volte em{" "}
                  <strong>Cadastros</strong> → <strong>Empresas</strong> e escolha uma.
                </Passo>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-4 sm:px-5">
                {!temEmpresa && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setOpen(false);
                      navigate("/empresas");
                    }}
                  >
                    Ir para Empresas
                  </button>
                )}
                <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
                  Entendi
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}

function Passo({
  n,
  titulo,
  children,
  destaque,
}: {
  n: number;
  titulo: string;
  children: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 px-3.5 py-3",
        destaque && "border-[#C5DDD0] bg-[#E8F3EC]"
      )}
    >
      <p className="mb-1.5 flex items-center gap-2 font-medium">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {n}
        </span>
        {titulo}
      </p>
      <div className="pl-8 text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </div>
  );
}
