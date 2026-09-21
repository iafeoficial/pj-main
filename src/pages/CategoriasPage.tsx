import { useMemo, useState } from "react";
import { Tags, Pencil, Plus, Trash2 } from "lucide-react";
import type { Categoria, CategoriaGrupo, CategoriaTipo } from "@/types/domain";
import { categoriaGrupoService, categoriaService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

type ModalKind = "categoria" | "grupo" | null;

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: categorias } = useAsyncData(
    () => categoriaService.list(empresaId),
    [empresaId, version],
    [] as Categoria[]
  );
  const { data: grupos } = useAsyncData(
    () => categoriaGrupoService.list(empresaId),
    [empresaId, version],
    [] as CategoriaGrupo[]
  );

  const grupoMap = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);

  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [editingGrupo, setEditingGrupo] = useState<CategoriaGrupo | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CategoriaTipo>("despesa");
  const [ativo, setAtivo] = useState(true);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toDeleteCat, setToDeleteCat] = useState<Categoria | null>(null);
  const [toDeleteGrupo, setToDeleteGrupo] = useState<CategoriaGrupo | null>(null);

  const gruposDoTipo = useMemo(
    () => grupos.filter((g) => g.tipo === tipo && g.ativo),
    [grupos, tipo]
  );

  function openCreateCat() {
    setEditingCat(null);
    setNome("");
    setTipo("despesa");
    setAtivo(true);
    setGrupoId(null);
    setError("");
    setModalKind("categoria");
  }

  function openEditCat(c: Categoria) {
    setEditingCat(c);
    setNome(c.nome);
    setTipo(c.tipo);
    setAtivo(c.ativo);
    setGrupoId(c.grupoId ?? null);
    setError("");
    setModalKind("categoria");
  }

  function openCreateGrupo() {
    setEditingGrupo(null);
    setNome("");
    setTipo("despesa");
    setAtivo(true);
    setError("");
    setModalKind("grupo");
  }

  function openEditGrupo(g: CategoriaGrupo) {
    setEditingGrupo(g);
    setNome(g.nome);
    setTipo(g.tipo);
    setAtivo(g.ativo);
    setError("");
    setModalKind("grupo");
  }

  async function save() {
    if (!nome.trim()) {
      setError("Informe o nome.");
      return;
    }
    try {
      if (modalKind === "grupo") {
        if (editingGrupo) {
          await categoriaGrupoService.update(empresaId, editingGrupo.id, { nome, tipo, ativo });
          notify("Grupo atualizado.");
        } else {
          await categoriaGrupoService.create(empresaId, { nome, tipo, ativo });
          notify("Grupo criado.");
        }
      } else {
        // Se o grupo selecionado for de outro tipo, limpa.
        const gOk = grupoId && gruposDoTipo.some((g) => g.id === grupoId) ? grupoId : null;
        if (editingCat) {
          await categoriaService.update(empresaId, editingCat.id, {
            nome,
            tipo,
            ativo,
            grupoId: gOk,
          });
          notify("Categoria atualizada.");
        } else {
          await categoriaService.create(empresaId, { nome, tipo, ativo, grupoId: gOk });
          notify("Categoria criada.");
        }
      }
      bumpData();
      setModalKind(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmDeleteCat() {
    if (!toDeleteCat) return;
    try {
      await categoriaService.remove(empresaId, toDeleteCat.id);
      bumpData();
      notify("Categoria excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDeleteCat(null);
  }

  async function confirmDeleteGrupo() {
    if (!toDeleteGrupo) return;
    try {
      await categoriaGrupoService.remove(empresaId, toDeleteGrupo.id);
      bumpData();
      notify("Grupo excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDeleteGrupo(null);
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Categorias-folha e grupos para a DRE hierárquica."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={openCreateGrupo}>
              <Plus className="h-4 w-4" /> Novo grupo
            </button>
            <button className="btn-primary" onClick={openCreateCat}>
              <Plus className="h-4 w-4" /> Nova categoria
            </button>
          </div>
        }
      />

      {grupos.length > 0 && (
        <div className="card mb-5 overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grupos (DRE)
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grupos.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{g.nome}</td>
                  <td className="px-4 py-2.5">
                    <TipoBadge tipo={g.tipo} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {g.ativo ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEditGrupo(g)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-destructive"
                        onClick={() => setToDeleteGrupo(g)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {categorias.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria"
          description="Crie categorias-folha para organizar seus lançamentos. Opcionalmente, agrupe-as para a DRE."
          action={
            <button className="btn-primary" onClick={openCreateCat}>
              <Plus className="h-4 w-4" /> Nova categoria
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias (lançamentos)
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Grupo</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categorias.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(c.grupoId && grupoMap.get(c.grupoId)?.nome) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TipoBadge tipo={c.tipo} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ativo ? "Ativa" : "Inativa"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEditCat(c)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-destructive"
                        onClick={() => setToDeleteCat(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalKind !== null}
        title={
          modalKind === "grupo"
            ? editingGrupo
              ? "Editar grupo"
              : "Novo grupo"
            : editingCat
              ? "Editar categoria"
              : "Nova categoria"
        }
        onClose={() => setModalKind(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalKind(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" required error={error}>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Tipo" required>
            <Select
              value={tipo}
              onChange={(v) => {
                setTipo(v as CategoriaTipo);
                setGrupoId(null);
              }}
              options={[
                { value: "despesa", label: "Despesa" },
                { value: "receita", label: "Receita" },
              ]}
            />
          </Field>
          {modalKind === "categoria" && (
            <Field
              label="Grupo (DRE)"
              hint="Opcional. Só categorias entram em lançamentos; o grupo organiza a DRE."
            >
              <Select
                value={grupoId ?? ""}
                onChange={(v) => setGrupoId(v || null)}
                options={[
                  { value: "", label: "— sem grupo —" },
                  ...gruposDoTipo.map((g) => ({ value: g.id, label: g.nome })),
                ]}
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Ativo
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteCat}
        title="Excluir categoria"
        message={`Excluir "${toDeleteCat?.nome}"? Lançamentos existentes ficam sem categoria.`}
        confirmLabel="Excluir"
        onConfirm={confirmDeleteCat}
        onCancel={() => setToDeleteCat(null)}
      />
      <ConfirmDialog
        open={!!toDeleteGrupo}
        title="Excluir grupo"
        message={`Excluir o grupo "${toDeleteGrupo?.nome}"? Categorias vinculadas ficam sem grupo.`}
        confirmLabel="Excluir"
        onConfirm={confirmDeleteGrupo}
        onCancel={() => setToDeleteGrupo(null)}
      />
    </>
  );
}

function TipoBadge({ tipo }: { tipo: CategoriaTipo }) {
  return (
    <span
      className={`badge ${
        tipo === "receita" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {tipo === "receita" ? "Receita" : "Despesa"}
    </span>
  );
}

export function CategoriasPage() {
  return (
    <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>
  );
}
