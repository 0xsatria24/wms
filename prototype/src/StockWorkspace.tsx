import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, X, Plus, ArrowLeft } from "@phosphor-icons/react";
import { Stock } from "./Stock";
import { WorkQueue } from "./WorkQueue";
import { ExportPanel, type ExportOption } from "./ExportPanel";
import { DocumentDates } from "./DateTime";
import { canOrderAction } from "./bulk-model";
import { Button, Field, Notice, Tag, useText, errorText } from "./ui";
import { TableTimestamp } from "./DateTime";
import {
  workflowRead,
  workflowDrafts,
  workflowDraft,
  saveWorkflowDraft,
  proposeItem,
  reviewItemProposal,
} from "./workflow-api";
import {
  allocationPlan,
  balance,
  sumQuantity,
  acceptsDraftSave,
  receiptIdentity,
  quantity,
  referenceId,
  relocationSources,
  resolveItem,
  type WorkflowData,
  type WorkspaceContext,
} from "./workflow-model";

export function StockWorkspace(props: any) {
  const {
    warehouse,
    user,
    route = "stock",
    workspaceContext,
    consumeWorkspaceContext,
    dispatchWorkflow,
    editRecord,
    refresh,
    setWorkflowDirty,
  } = props;
  const t = useText();
  const [context, setContext] = useState<WorkspaceContext | null>(
    workspaceContext || null,
  );
  const [form, setForm] = useState<any>({});
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState(referenceId);
  const [draftVersion, setDraftVersion] = useState(0);
  const [completedDraft, setCompletedDraft] = useState(false);
  const [read, setRead] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [catalogue, setCatalogue] = useState<WorkflowData | null>(null);
  const [catalogueBusy, setCatalogueBusy] = useState(false);
  const [generation, reload] = useState(0);
  const [newItem, setNewItem] = useState<any>(null);
  const [catalogueTab, setCatalogueTab] = useState("manual");
  const [draftList, setDraftList] = useState<any>(null);
  const [draftPage, setDraftPage] = useState(1);
  const [proposalSearch, setProposalSearch] = useState("");
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 1100);
  const itemReads = useRef(
    new Map<
      number,
      { controller: AbortController; timer: ReturnType<typeof setTimeout> }
    >(),
  );
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth <= 1100);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      for (const read of itemReads.current.values()) {
        read.controller.abort();
        clearTimeout(read.timer);
      }
    };
  }, []);
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!context || narrow) return;
    const update = () => {
      if (panel.current)
        panel.current.style.setProperty(
          "--workflow-top",
          `${Math.max(16, panel.current.getBoundingClientRect().top)}px`,
        );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [!!context, narrow]);
  const trigger = useRef<HTMLElement | null>(null);
  const activeScope = useRef(`${user.id}|${warehouse}`);
  const scope = `${user.id}|${warehouse}`;
  const liveDraft = useRef({
    id: draftId,
    scope,
    snapshot: JSON.stringify({ context, form }),
  });
  liveDraft.current = {
    id: draftId,
    scope,
    snapshot: JSON.stringify({ context, form }),
  };
  useEffect(() => {
    activeScope.current = scope;
    return () => {
      activeScope.current = "";
      setWorkflowDirty?.(false);
    };
  }, [scope]);
  useEffect(() => {
    setWorkflowDirty?.(dirty);
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const initialize = (next: WorkspaceContext) => {
    for (const read of itemReads.current.values()) {
      read.controller.abort();
      clearTimeout(read.timer);
    }
    itemReads.current.clear();
    setRead(null);
    setLoading(true);
    setContext(next);
    setForm({
      sourceType: next.document && next.action === "receive" ? "po" : "manual",
      document: referenceId(),
      lines: [{ id: referenceId(), sku: next.sku || "", qty: "", scan: "" }],
      ...next,
    });
    setDirty(false);
    setCompletedDraft(false);
    setDraftId(referenceId());
    setDraftVersion(0);
    setReview(null);
    setResult(null);
    setError("");
    setMessage("");
    setNewItem(null);
    setDraftList(null);
  };
  const open = (next: WorkspaceContext) => {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard unsaved changes? Save the draft first to keep them.",
          "Buang perubahan yang belum disimpan? Simpan draf dahulu untuk mempertahankannya.",
        ),
      )
    )
      return;
    trigger.current = document.activeElement as HTMLElement;
    initialize(next);
  };
  useEffect(() => {
    if (workspaceContext) {
      open(workspaceContext);
      consumeWorkspaceContext?.();
    }
  }, [workspaceContext]);
  const close = () => {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Close and discard unsaved changes?",
          "Tutup dan buang perubahan yang belum disimpan?",
        ),
      )
    )
      return;
    setContext(null);
    setReview(null);
    setDirty(false);
    requestAnimationFrame(() => {
      trigger.current?.focus();
      trigger.current = null;
    });
  };
  useEffect(() => {
    if (context)
      panel.current?.querySelector<HTMLElement>("button,input")?.focus();
  }, [context?.action, context?.document]);
  useEffect(() => {
    if (!context) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    workflowRead(
      warehouse,
      {
        view: "stock",
        sku: context.sku || "",
        selectedItems: JSON.stringify(
          (form.lines || []).map((line: any) => line.sku).filter(Boolean),
        ),
        proposal:
          (form.lines || []).find((line: any) => line.proposalId)?.proposalId ||
          "",
        document:
          context.document ||
          (form.action === "receive" ? form.document : "") ||
          "",
      },
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setRead(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRead(null);
          setError(errorText(e.code || e.message, t));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    !!context,
    context?.sku,
    context?.document,
    form.document,
    form.action,
    warehouse,
    user.id,
    user.role,
    generation,
  ]);
  useEffect(() => {
    if (route === "stock") return;
    const controller = new AbortController();
    setCatalogueBusy(true);
    const timer = setTimeout(() => {
      workflowRead(
        warehouse,
        { view: route, query: search, status, page },
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) setCatalogue(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(errorText(e.code || e.message, t));
        })
        .finally(() => {
          if (!controller.signal.aborted) setCatalogueBusy(false);
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [route, warehouse, user.id, user.role, search, status, page, generation]);
  const patch = (value: any) => {
    setForm((old: any) => ({ ...old, ...value }));
    setDirty(true);
    setMessage("");
    setResult(null);
    setReview(null);
  };
  const linePatch = (index: number, value: any) =>
    patch({
      lines: form.lines.map((line: any, i: number) =>
        i === index ? { ...line, ...value } : line,
      ),
    });
  const safe = async (work: () => Promise<void>) => {
    const owner = scope;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e: any) {
      if (activeScope.current === owner)
        setError(errorText(e.code || e.message, t));
    } finally {
      if (activeScope.current === owner) setBusy(false);
    }
  };
  const saved = async () => {
    const capture = { ...liveDraft.current };
    const draft = await saveWorkflowDraft(warehouse, draftId, draftVersion, {
      context,
      form,
    });
    if (
      liveDraft.current.id !== capture.id ||
      liveDraft.current.scope !== capture.scope
    )
      return;
    setDraftVersion(draft.version);
    if (!acceptsDraftSave(capture, liveDraft.current)) {
      setDirty(true);
      setMessage(
        t(
          "The previous revision was saved. Your current changes are still unsaved.",
          "Versi sebelumnya tersimpan. Perubahan saat ini belum tersimpan.",
        ),
      );
      return;
    }
    setDirty(false);
    setMessage(
      t(
        "Draft saved. No stock has changed.",
        "Draf tersimpan. Belum ada perubahan stok.",
      ),
    );
  };
  const showDrafts = (nextPage = 1) =>
    safe(async () => {
      const list = await workflowDrafts(warehouse, nextPage);
      setDraftList(list);
      setDraftPage(nextPage);
    });
  const loadDraft = (id: string) =>
    safe(async () => {
      if (
        dirty &&
        !window.confirm(
          t(
            "Discard current unsaved changes?",
            "Buang perubahan saat ini yang belum disimpan?",
          ),
        )
      )
        return;
      const draft = await workflowDraft(warehouse, id);
      setContext(draft.data.context);
      setForm(draft.data.form);
      setDraftId(draft.id);
      setDraftVersion(draft.version);
      setCompletedDraft(draft.status === "confirmed");
      setDirty(false);
      setReview(null);
      setRead(null);
      setLoading(true);
      setResult(draft.result || null);
      setDraftList(null);
      reload((n) => n + 1);
      setMessage(
        draft.status === "confirmed"
          ? ""
          : t(
              "Saved draft reopened. Check current items and quantities before confirming.",
              "Draf tersimpan dibuka. Periksa barang dan jumlah terkini sebelum konfirmasi.",
            ),
      );
    });
  const item = read?.items.find((i) => i.sku === context?.sku);
  const doc = read?.documents.find((d) => d.id === context?.document);
  const positions = read?.positions.filter((p) => p.sku === context?.sku) || [];
  const sources = relocationSources(positions);
  const source = sources.find((p) => p.id === form.position);
  const storage = (read?.locations || []).filter(
    (l) =>
      l.pickable &&
      !l.frozen &&
      !["Receiving", "QC", "Staging"].includes(l.code),
  );
  const action = form.action || context?.action || "detail";
  const field = (label: string, key: string, extra: any = {}) => (
    <Field
      label={label}
      value={form[key] ?? ""}
      onChange={(e) => patch({ [key]: e.target.value })}
      {...extra}
    />
  );
  const qtyField = (unit: string) =>
    field(t(`Actual quantity (${unit})`, `Jumlah aktual (${unit})`), "qty", {
      inputMode: "decimal",
      required: true,
      placeholder: t("Enter physical quantity", "Isi jumlah fisik"),
    });
  const scanField = () =>
    field(t("Scan item barcode / SKU", "Pindai barcode / SKU barang"), "scan", {
      autoComplete: "off",
      required: true,
    });
  const destinationField = (
    <>
      {field(t("Destination rack", "Rak tujuan"), "destination", {
        list: "workflow-storage",
      })}
      <datalist id="workflow-storage">
        {storage.map((l) => (
          <option key={l.id} value={l.code} />
        ))}
      </datalist>
      {field(t("Scan destination rack", "Pindai rak tujuan"), "locationScan", {
        autoComplete: "off",
        required: true,
      })}
    </>
  );
  const operationAllowed =
    !!read?.capabilities.operate &&
    !busy &&
    !completedDraft &&
    !loading &&
    !["unknown", "offline"].includes(result?.message) &&
    !read?.items.some((i) => i.sku === context?.sku && i.restricted);
  const prepare = (
    type: string,
    payload: any,
    version: number | null,
    details: string,
    edit = false,
  ) => {
    setError("");
    if (completedDraft) return;
    setReview({
      type,
      payload: edit
        ? payload
        : { ...payload, workflowDraft: draftId, draftVersion },
      version,
      details,
      edit,
    });
  };
  const changeAction = (next: string) => {
    setReview(null);
    setResult(null);
    patch({
      action: next,
      qty: "",
      scan: "",
      good: "",
      bad: "",
      reason: "",
      destination: "",
      locationScan: "",
      position: "",
      sourceScan: "",
      packed: false,
    });
  };
  const confirm = () =>
    safe(async () => {
      if (!review) return;
      const intent = review;
      if (intent.edit) {
        await editRecord(intent.type, intent.payload);
        setResult({ message: "recorded", id: intent.payload.id });
      } else {
        const posted = await dispatchWorkflow(
          intent.type,
          intent.payload,
          intent.version,
        );
        setResult(posted);
        if (posted.message === "unknown" || posted.message === "offline") {
          setReview(null);
          return;
        }
      }
      setReview(null);
      setForm((old: any) => ({
        ...old,
        document: intent.type === "relocate" ? referenceId() : old.document,
        action:
          intent.type === "manual-receive" || intent.type === "create-order"
            ? "detail"
            : old.action,
        qty: "",
        scan: "",
        good: "",
        bad: "",
        reason: "",
        locationScan: "",
        sourceScan: "",
        packed: false,
      }));
      setRead(null);
      setLoading(true);
      setDirty(false);
      setDraftId(referenceId());
      setDraftVersion(0);
      setMessage("");
      reload((n) => n + 1);
      void refresh().catch(() => {});
      if (intent.type === "manual-receive")
        setContext({ action: "detail", document: intent.payload.document });
      if (intent.type === "create-order")
        setContext({
          action: "detail",
          document: intent.payload.id,
          sku: intent.payload.sku,
        });
    });
  const receiptItem = (line: any) =>
    receiptIdentity(line.sku, read?.items || []);
  const receiptValid =
    !read?.headers.some((h) => h.id === form.document) &&
    (form.sourceType === "po"
      ? !!doc &&
        doc.kind === "po" &&
        !!quantity(form.qty || "") &&
        Number(quantity(form.qty || "")) <=
          Number(doc.qty) - Number(doc.actual) &&
        !!form.scan
      : form.lines?.length > 0 &&
        form.lines.every(
          (line: any) => receiptItem(line) && quantity(line.qty) && line.scan,
        ) &&
        !!form.origin?.trim() &&
        !!form.reason?.trim());
  const receiveReview = () => {
    if (form.sourceType === "po" && doc)
      prepare(
        "receive",
        { document: doc.id, qty: quantity(form.qty), scan: form.scan },
        doc.version,
        t(
          "Receive the entered actual quantity in Receiving. Available stays zero until QC and putaway.",
          "Terima jumlah aktual di Receiving. Tersedia tetap nol sampai QC dan simpan ke rak.",
        ),
      );
    else
      prepare(
        "manual-receive",
        {
          document: form.document,
          sourceType: "manual",
          origin: form.origin,
          reference: form.reference || "",
          reason: form.reason,
          lines: form.lines.map((line: any) => ({
            ...line,
            qty: quantity(line.qty),
            unit: receiptItem(line)!.unit,
            version: receiptItem(line)!.version,
          })),
        },
        null,
        t(
          "All lines post together to Receiving, awaiting QC. No purchase order is created.",
          "Semua baris dicatat bersama ke Receiving, menunggu QC. Tidak membuat PO.",
        ),
      );
  };
  const timeline = (read?.documents || []).filter(
    (d) =>
      read?.lineageIds?.includes(d.id) ||
      d.id === context?.document ||
      d.source === context?.document ||
      read?.documents.some(
        (parent) =>
          parent.source === context?.document && d.source === parent.id,
      ),
  );
  const documentLabel = (kind: string) =>
    ({
      po: t("Purchase order", "PO"),
      "receipt-line": t("Received line", "Baris penerimaan"),
      inspection: "QC",
      putaway: t("Putaway", "Simpan ke rak"),
      order: t("Order", "Permintaan keluar"),
    })[kind] || kind;
  const statusLabel = (s: string) =>
    ({
      draft: t("Draft", "Draf"),
      "pending-approval": t("Awaiting review", "Menunggu review"),
      rejected: t("Needs revision", "Perlu revisi"),
      approved: t("Approved · release next", "Disetujui · lanjut release"),
      released: t("Released", "Dirilis"),
      "awaiting-qc": t("Awaiting QC", "Menunggu QC"),
      complete: t("Complete", "Selesai"),
      partial: t("Partially processed", "Diproses sebagian"),
      ready: t("Ready", "Siap"),
      cancelled: t("Cancelled", "Dibatalkan"),
      good: t("Good", "Bagus"),
      "not-good": t("Not good", "Tidak bagus"),
      unassessed: t("Not assessed", "Belum dicek"),
      "quality-rejected": t("Quality hold", "Ditahan karena hasil QC"),
    })[s] || s;
  const chooseDoc = (d: any) =>
    open({
      document: d.id,
      sku: d.sku,
      action:
        d.kind === "po"
          ? "receive"
          : d.kind === "inspection"
            ? "qc"
            : d.kind === "putaway"
              ? "putaway"
              : "detail",
    });
  const setLineSku = async (index: number, value: string) => {
    linePatch(index, { sku: value, scan: "" });
    const prior = itemReads.current.get(index);
    prior?.controller.abort();
    clearTimeout(prior?.timer);
    const controller = new AbortController();
    const owner = scope;
    const lineId = form.lines[index].id;
    const timer = setTimeout(async () => {
      try {
        const match = await workflowRead(
          warehouse,
          { view: "items", query: value },
          controller.signal,
        );
        if (controller.signal.aborted || activeScope.current !== owner) return;
        setRead((old) =>
          old
            ? {
                ...old,
                items: [
                  ...old.items.filter(
                    (i) => !match.items.some((m) => m.sku === i.sku),
                  ),
                  ...match.items,
                ],
              }
            : old,
        );
        const resolved = resolveItem(value, match.items);
        if (resolved.status === "known" && resolved.item.sku !== value)
          setForm((old: any) => ({
            ...old,
            lines: old.lines.map((line: any) =>
              line.id === lineId
                ? { ...line, sku: resolved.item.sku, scan: "" }
                : line,
            ),
          }));
      } catch (e: any) {
        if (!controller.signal.aborted && activeScope.current === owner)
          setError(errorText(e.code || e.message, t));
      }
    }, 220);
    itemReads.current.set(index, { controller, timer });
  };
  const makeItem = () =>
    safe(async () => {
      const { index, ...values } = newItem;
      const sku = values.sku.trim();
      const barcode = values.internal
        ? "IW-" + referenceId()
        : values.barcode.trim();
      if (read?.capabilities.master) {
        await editRecord("master", {
          sku,
          name: values.name.trim(),
          unit: values.unit.trim(),
          barcode,
          category: "General goods",
          factor: 1,
          active: true,
          version: 0,
          dimensions: "",
          weight: "",
          reason: "",
        });
        const fresh = await workflowRead(warehouse, { view: "items", sku });
        setRead((old) =>
          old
            ? {
                ...old,
                items: [
                  ...old.items.filter((i) => i.sku !== sku),
                  ...fresh.items,
                ],
              }
            : old,
        );
        linePatch(index, { sku, scan: "" });
        setMessage(
          t(
            "Item saved and selected. Enter the actual scan before receiving.",
            "Barang tersimpan dan dipilih. Isi hasil pindai aktual sebelum menerima.",
          ),
        );
      } else {
        const proposalId = form.lines[index].proposalId || referenceId();
        await saved();
        const existing = read?.proposals.find(
          (row: any) => row.proposal.id === proposalId,
        );
        await proposeItem(warehouse, proposalId, {
          ...(existing?.proposal.status === "needs-revision"
            ? { version: existing.version }
            : {}),
          name: values.name,
          sku,
          unit: values.unit,
          barcode: values.internal ? "" : barcode,
          receiptDraft: draftId,
          lineId: form.lines[index].id,
        });
        linePatch(index, { proposalId, sku });
        setMessage(
          t(
            "Item proposed. Save this receipt draft while waiting for review; stock has not changed.",
            "Barang diajukan. Simpan draf penerimaan sambil menunggu review; stok belum berubah.",
          ),
        );
      }
      setNewItem(null);
      reload((n) => n + 1);
    });
  const loadProposals = (nextPage: number, exact = "") =>
    safe(async () => {
      const next = await workflowRead(warehouse, {
        proposalPage: nextPage,
        proposal: exact,
      });
      setRead((old) =>
        old
          ? {
              ...old,
              proposals: next.proposals,
              proposalPage: next.proposalPage,
            }
          : old,
      );
    });
  const panelTitle = newItem
    ? t(
        read?.capabilities.master ? "Add item" : "Propose item",
        read?.capabilities.master ? "Tambah barang" : "Ajukan barang",
      )
    : action === "receive"
      ? t("Receive goods", "Terima barang")
      : action === "relocate"
        ? t("Move between racks", "Pindah rak")
        : action === "new-order"
          ? t("New outbound request", "Permintaan keluar baru")
          : doc
            ? documentLabel(doc.kind)
            : item?.name || t("Item actions", "Proses barang");
  const rows = catalogue?.documents || [];
  const receiptHeader = read?.headers.find((h) => h.id === context?.document);
  const legacyRows = props.data[
    (
      {
        receiving: "receipts",
        quality: "inspections",
        putaway: "putaways",
      } as any
    )[route] || "orders"
  ].filter((d: any) => d.warehouse === warehouse);
  const exportOptions: ExportOption[] =
    doc?.kind === "po"
      ? [
          {
            type: "receive",
            events: "receive",
            label: t("Receipt transaction", "Transaksi penerimaan"),
          },
          {
            type: "receive-summary",
            label: t("Receipt summary", "Rekap penerimaan"),
          },
        ]
      : doc?.kind === "order"
        ? [
            {
              type: "packing",
              label: t(
                "Packing plan · not shipment evidence",
                "Rencana packing · bukan bukti kirim",
              ),
            },
            {
              type: "ship",
              events: "ship",
              label: t("Shipment transaction", "Transaksi pengiriman"),
            },
          ]
        : doc?.kind === "receipt-line"
          ? [
              {
                type: "manual-receive",
                label: t("Manual receipt evidence", "Bukti penerimaan manual"),
              },
            ]
          : [];
  const [orderItemSearch, setOrderItemSearch] = useState("");
  useEffect(() => {
    if (!context || action !== "new-order" || !orderItemSearch) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      workflowRead(
        warehouse,
        { view: "items", query: orderItemSearch },
        c.signal,
      )
        .then((value) => {
          if (!c.signal.aborted)
            setRead((old) => (old ? { ...old, items: value.items } : old));
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [orderItemSearch, action]);
  return (
    <div className={`stock-workspace ${context ? "has-workflow-panel" : ""}`}>
      <div className="workflow-main" inert={narrow && !!context}>
        {route === "stock" ? (
          <Stock
            {...props}
            onProcess={(sku: string) => open({ sku, action: "detail" })}
            onReceive={() => open({ action: "receive" })}
          />
        ) : (
          <>
            {route === "receiving" && (
              <div className="form-actions">
                <Button
                  primary={catalogueTab === "manual"}
                  onClick={() => setCatalogueTab("manual")}
                >
                  {t("All receipts", "Semua penerimaan")}
                </Button>
                <Button
                  primary={catalogueTab === "po"}
                  onClick={() => setCatalogueTab("po")}
                >
                  {t("Purchase orders", "PO")}
                </Button>
              </div>
            )}
            {route !== "receiving" || catalogueTab === "po" ? (
              <>
                <Button
                  primary
                  disabled={user.role === "viewer"}
                  onClick={() =>
                    open({
                      action: ["receiving", "quality", "putaway"].includes(
                        route,
                      )
                        ? "receive"
                        : "new-order",
                    })
                  }
                >
                  {["receiving", "quality", "putaway"].includes(route)
                    ? t("Receive goods", "Terima barang")
                    : t("New request", "Permintaan baru")}
                </Button>
                <WorkQueue
                  items={legacyRows}
                  products={props.data.products}
                  data={props.data}
                  setCatalogueQuery={props.setCatalogueQuery}
                  kind={route}
                  title={t("Documents", "Dokumen")}
                  selected={context?.document}
                  onSelect={(id) => {
                    const d = legacyRows.find((r: any) => r.id === id);
                    if (d)
                      open({
                        document: id,
                        sku: d.sku,
                        action:
                          route === "receiving"
                            ? "receive"
                            : route === "quality"
                              ? "qc"
                              : route === "putaway"
                                ? "putaway"
                                : "detail",
                      });
                  }}
                  bulkScope={JSON.stringify([user.id, user.role, warehouse])}
                  bulkActions={
                    route === "orders"
                      ? [
                          [
                            "submit-order",
                            t(
                              "Submit selected orders",
                              "Ajukan order terpilih",
                            ),
                          ],
                          [
                            "approve-order",
                            t(
                              "Approve selected orders",
                              "Setujui order terpilih",
                            ),
                          ],
                          [
                            "reject-order",
                            t("Request revision", "Minta revisi"),
                          ],
                          [
                            "release-order",
                            t(
                              "Release selected orders",
                              "Release order terpilih",
                            ),
                          ],
                        ].map(([action, label]) => ({
                          id: action,
                          label,
                          reason: action === "reject-order",
                          danger: action === "reject-order",
                          allowed: (row) =>
                            canOrderAction(
                              action,
                              row,
                              user,
                              props.data.approvalPolicy?.orderReview,
                            ),
                          description: t(
                            "Review and release stay separate. Stock does not move.",
                            "Review dan release tetap terpisah. Stok belum berpindah.",
                          ),
                          perform: async (row, reason) =>
                            action === "submit-order"
                              ? editRecord(action, {
                                  id: row.id,
                                  version: row.version,
                                })
                              : props.bulkCommand(
                                  action,
                                  {
                                    order: row.id,
                                    ...(reason ? { reason } : {}),
                                  },
                                  row.version,
                                ),
                          after: async () => {
                            await refresh();
                            reload((n) => n + 1);
                          },
                        }))
                      : undefined
                  }
                />
              </>
            ) : (
              <>
                <div className="workflow-catalogue-toolbar">
                  <Field
                    label={t(
                      "Search documents or items",
                      "Cari dokumen atau barang",
                    )}
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <Field label={t("Status", "Status")}>
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">
                        {t("All statuses", "Semua status")}
                      </option>
                      {[
                        "draft",
                        "pending-approval",
                        "rejected",
                        "approved",
                        "released",
                        "awaiting-qc",
                        "ready",
                        "partial",
                        "complete",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    primary
                    disabled={user.role === "viewer"}
                    onClick={() =>
                      open({
                        action: ["receiving", "quality", "putaway"].includes(
                          route,
                        )
                          ? "receive"
                          : "new-order",
                      })
                    }
                  >
                    <Plus size={18} />
                    {["receiving", "quality", "putaway"].includes(route)
                      ? t("Receive goods", "Terima barang")
                      : t("New request", "Permintaan baru")}
                  </Button>
                </div>
                <p className="muted">
                  {t(
                    "Open a document to see its current stage and continue in the side panel.",
                    "Buka dokumen untuk melihat tahap saat ini dan lanjutkan dari panel samping.",
                  )}
                </p>
                <div
                  className="workflow-table"
                  role="region"
                  tabIndex={0}
                  aria-label={t(
                    "Goods documents; scroll horizontally",
                    "Dokumen barang; gulir horizontal",
                  )}
                  aria-busy={catalogueBusy}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Document / source", "Dokumen / sumber")}</th>
                        <th>{t("Item", "Barang")}</th>
                        <th className="number">{t("Quantity", "Jumlah")}</th>
                        <th>{t("Status", "Status")}</th>
                        <th>{t("Recorded", "Tercatat")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <button
                              className="row-select"
                              onClick={() => chooseDoc(d)}
                            >
                              {d.id}
                            </button>
                            <small>
                              {documentLabel(d.kind)}
                              {d.source && ` · ${d.source}`}
                            </small>
                          </td>
                          <td>
                            {d.name}
                            <small>{d.sku}</small>
                          </td>
                          <td className="number">
                            {d.qty} {d.unit}
                          </td>
                          <td>{statusLabel(d.status)}</td>
                          <td>
                            <TableTimestamp
                              value={d.updatedAt || d.createdAt}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && !catalogueBusy && (
                    <div className="workflow-empty">
                      {t(
                        "No documents match. Start a receipt or change the search.",
                        "Belum ada dokumen yang sesuai. Mulai penerimaan atau ubah pencarian.",
                      )}
                    </div>
                  )}
                </div>
                <div className="form-actions">
                  <Button
                    disabled={page <= 1 || catalogueBusy}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t("Previous", "Sebelumnya")}
                  </Button>
                  <span>
                    {page} / {catalogue?.documentPage.pages || 1} ·{" "}
                    {catalogue?.documentPage.total || 0}{" "}
                    {t("documents", "dokumen")}
                  </span>
                  <Button
                    disabled={
                      page >= (catalogue?.documentPage.pages || 1) ||
                      catalogueBusy
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("Next", "Berikutnya")}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        <Button
          hidden={!!context}
          onClick={() => {
            open({ action: "receive" });
            void showDrafts();
          }}
        >
          {t("Open my saved drafts", "Buka draf tersimpan saya")}
        </Button>
      </div>
      {context && (
        <aside
          className="workflow-panel"
          ref={panel}
          aria-labelledby="workflow-title"
          role={narrow ? "dialog" : undefined}
          aria-modal={narrow ? true : undefined}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (narrow && e.key === "Tab") {
              const items = Array.from(
                panel.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
                ) || [],
              ).filter((el) => el.getClientRects().length > 0);
              const first = items[0],
                last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              if (newItem) setNewItem(null);
              else close();
            }
          }}
        >
          <header>
            <div>
              <span className="workflow-eyebrow">{warehouse}</span>
              <h2 id="workflow-title">{panelTitle}</h2>
              {context.sku && (
                <p>
                  {context.sku} · {item?.unit || doc?.unit}
                </p>
              )}
              {context.document && (
                <p className="workflow-reference">{context.document}</p>
              )}
            </div>
            <Button
              disabled={busy}
              onClick={close}
              aria-label={t("Close panel", "Tutup panel")}
            >
              <X size={20} />
            </Button>
          </header>
          <fieldset
            className="workflow-body"
            disabled={busy}
            aria-busy={loading || busy}
          >
            {error && (
              <Notice kind="error">
                {error}
                <Button
                  disabled={busy || loading}
                  onClick={() => {
                    setReview(null);
                    reload((n) => n + 1);
                  }}
                >
                  {t("Review current data", "Tinjau data terkini")}
                </Button>
              </Notice>
            )}
            {message && <Notice kind="success">{message}</Notice>}
            {loading && (
              <p role="status">
                {t(
                  "Checking current document and stock…",
                  "Memeriksa dokumen dan stok terkini…",
                )}
              </p>
            )}
            {result && (
              <Notice
                kind={
                  ["unknown", "offline"].includes(result.message)
                    ? "warning"
                    : "success"
                }
              >
                <strong>
                  {result.message === "unknown"
                    ? t("Outcome unknown", "Hasil belum diketahui")
                    : result.message === "offline"
                      ? t("Not sent · offline", "Belum dikirim · offline")
                      : t("Recorded", "Tercatat")}
                </strong>
                <p className="workflow-reference">{result.id}</p>
                {["unknown", "offline"].includes(result.message) ? (
                  <>
                    <p>
                      {t(
                        "Keep the original request. Check its result before retrying.",
                        "Pertahankan permintaan asli. Periksa hasil sebelum mengirim ulang.",
                      )}
                    </p>
                    <Button onClick={() => props.go("pending")}>
                      {t(
                        "Open pending transactions",
                        "Buka transaksi tertunda",
                      )}
                    </Button>
                  </>
                ) : (
                  <p>
                    {t(
                      "Stock follows the server result. ERP delivery is tracked separately.",
                      "Stok mengikuti hasil server. Pengiriman ERP dipantau terpisah.",
                    )}
                  </p>
                )}
              </Notice>
            )}
            {!read && !draftList ? (
              <div>
                <p>
                  {loading
                    ? t("Loading this document…", "Memuat dokumen ini…")
                    : t(
                        "This document could not be loaded. Your entries are still here.",
                        "Dokumen belum dapat dimuat. Isian tetap tersedia.",
                      )}
                </p>
                <Button
                  disabled={loading || busy}
                  onClick={() => reload((n) => n + 1)}
                >
                  {t("Try loading again", "Muat ulang")}
                </Button>
              </div>
            ) : draftList ? (
              <>
                <h3>{t("My drafts", "Draf saya")}</h3>
                <p>
                  {user.name} · {warehouse}
                </p>
                {draftList.rows.map((d: any) => (
                  <div className="workflow-task" key={d.id}>
                    <div>
                      <strong>
                        {d.data.context?.sku ||
                          (d.data.form?.lines || [])
                            .slice(0, 3)
                            .map(
                              (line: any) =>
                                `${line.sku || t("Unselected item", "Barang belum dipilih")} ${line.qty || ""}`,
                            )
                            .join(" · ") ||
                          t("Receipt", "Penerimaan")}
                      </strong>
                      <small className="workflow-reference">{d.id}</small>
                      {d.data.form?.origin && <p>{d.data.form.origin}</p>}
                      <TableTimestamp value={d.updatedAt} />
                      <p>
                        {d.data.context?.sku || t("Receipt", "Penerimaan")} · v
                        {d.version} ·{" "}
                        {d.status === "confirmed"
                          ? t("Recorded", "Tercatat")
                          : t("Draft", "Draf")}
                      </p>
                    </div>
                    <Button onClick={() => loadDraft(d.id)}>
                      {t("Open", "Buka")}
                    </Button>
                  </div>
                ))}
                {!draftList.total && (
                  <p>
                    {t("No saved drafts yet.", "Belum ada draf tersimpan.")}
                  </p>
                )}
                <div className="form-actions">
                  <Button
                    disabled={draftPage <= 1}
                    onClick={() => showDrafts(draftPage - 1)}
                  >
                    {t("Previous", "Sebelumnya")}
                  </Button>
                  <span>
                    {draftPage} / {draftList.pages}
                  </span>
                  <Button
                    disabled={draftPage >= draftList.pages}
                    onClick={() => showDrafts(draftPage + 1)}
                  >
                    {t("Next", "Berikutnya")}
                  </Button>
                </div>
                <Button onClick={() => setDraftList(null)}>
                  {t("Back to form", "Kembali ke form")}
                </Button>
              </>
            ) : completedDraft ? (
              <>
                <p>
                  {t(
                    "This saved work has already been recorded. Its original scans and quantities cannot be submitted again.",
                    "Pekerjaan tersimpan ini sudah dicatat. Pindaian dan jumlah aslinya tidak dapat dikirim ulang.",
                  )}
                </p>
                <Button
                  onClick={() =>
                    initialize({
                      sku: context.sku,
                      document: context.document,
                      action: "detail",
                    })
                  }
                >
                  {t(
                    "Open current state / start another action",
                    "Buka keadaan terkini / mulai tindakan lain",
                  )}
                </Button>
              </>
            ) : newItem ? (
              <>
                <Button onClick={() => setNewItem(null)}>
                  <ArrowLeft />
                  {t("Back to receipt", "Kembali ke penerimaan")}
                </Button>
                <p>
                  {t(
                    "Registering an item does not add physical stock.",
                    "Mendaftarkan barang belum menambah stok fisik.",
                  )}
                </p>
                {[
                  ["name", t("Item name", "Nama barang")],
                  ["sku", "SKU"],
                  ["unit", t("Base unit", "Satuan dasar")],
                  ["barcode", "Barcode"],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={newItem[key] || ""}
                    disabled={key === "barcode" && newItem.internal}
                    onChange={(e) => {
                      setNewItem({ ...newItem, [key]: e.target.value });
                      setDirty(true);
                    }}
                  />
                ))}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!newItem.internal}
                    onChange={(e) => {
                      setNewItem({ ...newItem, internal: e.target.checked });
                      setDirty(true);
                    }}
                  />
                  {t("Generate an internal barcode", "Buat barcode internal")}
                </label>
                <Button
                  primary
                  disabled={
                    busy ||
                    !newItem.name?.trim() ||
                    !newItem.sku?.trim() ||
                    !newItem.unit?.trim() ||
                    (!newItem.barcode?.trim() && !newItem.internal)
                  }
                  onClick={makeItem}
                >
                  {read?.capabilities.master
                    ? t("Save item and return", "Simpan barang dan kembali")
                    : t("Submit item proposal", "Ajukan barang")}
                </Button>
              </>
            ) : review ? (
              <>
                <h3>
                  {t("Review before confirming", "Tinjau sebelum konfirmasi")}
                </h3>
                <p>{review.details}</p>
                <dl className="workflow-review">
                  {Object.entries(review.payload)
                    .filter(
                      ([key]) =>
                        ![
                          "lines",
                          "allocations",
                          "workflowDraft",
                          "draftVersion",
                        ].includes(key) &&
                        !key.toLowerCase().includes("scan") &&
                        key !== "positionVersion",
                    )
                    .map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt>
                          {(
                            {
                              document: t("Document", "Dokumen"),
                              sourceType: t("Source", "Sumber"),
                              origin: t("Origin", "Asal barang"),
                              reference: t("Reference", "Referensi"),
                              reason: t("Reason", "Alasan"),
                              task: t("Task", "Tugas"),
                              order: t("Order", "Order"),
                              good: t("Good", "Bagus"),
                              bad: t("Not good", "Tidak bagus"),
                              sku: "SKU",
                              qty: t("Quantity", "Jumlah"),
                              destination: t("Destination rack", "Rak tujuan"),
                              position: t("Source position", "Posisi asal"),
                              id: t("Document", "Dokumen"),
                              version: t("Version", "Versi"),
                              packingVerified: t(
                                "Package checked",
                                "Paket diperiksa",
                              ),
                            } as any
                          )[key] || key}
                        </dt>
                        <dd>
                          {key === "position"
                            ? read?.positions.find((p) => p.id === value)
                                ?.location || String(value)
                            : key === "qty"
                              ? `${value} ${doc?.unit || item?.unit || ""}`
                              : String(value) ||
                                t("Not provided", "Tidak diisi")}
                        </dd>
                      </React.Fragment>
                    ))}
                </dl>
                {(review.payload.lines || review.payload.allocations)?.map(
                  (line: any) => (
                    <div
                      className="workflow-task"
                      key={line.id || line.position}
                    >
                      <strong>
                        {line.sku ||
                          read?.positions.find((p) => p.id === line.position)
                            ?.location ||
                          line.position}
                      </strong>
                      <span>
                        {line.qty} {line.unit || doc?.unit}
                      </span>
                    </div>
                  ),
                )}
                <Notice>
                  {t(
                    "This action is validated again by the server at confirmation.",
                    "Tindakan ini diperiksa ulang server saat konfirmasi.",
                  )}
                </Notice>
              </>
            ) : action === "receive" ? (
              <>
                <div className="workflow-steps">
                  <strong>1 · {t("Receive", "Terima")}</strong>
                  <span>2 · QC</span>
                  <span>3 · {t("Put away", "Simpan ke rak")}</span>
                </div>
                <Field label={t("Receipt source", "Sumber penerimaan")}>
                  <select
                    value={form.sourceType || "manual"}
                    onChange={(e) => patch({ sourceType: e.target.value })}
                  >
                    <option value="manual">
                      {t("Manual · without PO", "Manual · tanpa PO")}
                    </option>
                    <option value="po">
                      {t("From purchase order", "Dari PO")}
                    </option>
                  </select>
                </Field>
                {form.sourceType === "po" ? (
                  <>
                    <p>
                      {t(
                        "Choose a purchase order from Goods in to keep its exact remaining quantity.",
                        "Pilih PO dari Barang masuk agar sisa dokumennya tepat.",
                      )}
                    </p>
                    {doc?.kind === "po" ? (
                      <>
                        <p>
                          {doc.id} · {doc.name} · {t("Remaining", "Sisa")}{" "}
                          {balance(doc.qty, doc.actual, "0")} {doc.unit}
                        </p>
                        {qtyField(doc.unit)}
                        {scanField()}
                      </>
                    ) : (
                      <Button onClick={() => props.go("receiving")}>
                        {t("Choose purchase order", "Pilih PO")}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {field(t("Goods origin", "Asal barang"), "origin", {
                      maxLength: 300,
                      required: true,
                      placeholder: t(
                        "Sender / business source",
                        "Pengirim / sumber barang",
                      ),
                    })}
                    {field(
                      t(
                        "Delivery reference (optional)",
                        "Referensi surat jalan (opsional)",
                      ),
                      "reference",
                      { maxLength: 200 },
                    )}
                    {field(
                      t(
                        "Reason for receiving without PO",
                        "Alasan menerima tanpa PO",
                      ),
                      "reason",
                      { maxLength: 2000, required: true },
                    )}
                    {(form.lines || []).map((line: any, index: number) => (
                      <section className="workflow-receipt-line" key={line.id}>
                        <div className="workflow-line-heading">
                          <h3>
                            {t("Line", "Baris")} {index + 1}
                          </h3>
                          {form.lines.length > 1 && (
                            <Button
                              onClick={() =>
                                patch({
                                  lines: form.lines.filter(
                                    (_: any, i: number) => i !== index,
                                  ),
                                })
                              }
                            >
                              {t("Remove", "Hapus")}
                            </Button>
                          )}
                        </div>
                        <Field
                          label={t(
                            "Find item: SKU / barcode / name",
                            "Cari barang: SKU / barcode / nama",
                          )}
                          value={line.sku}
                          onChange={(e) =>
                            void setLineSku(index, e.target.value)
                          }
                          list={`workflow-items-${index}`}
                        />
                        <datalist id={`workflow-items-${index}`}>
                          {read?.items
                            .filter((i) => i.active)
                            .map((i) => (
                              <option key={i.sku} value={i.sku}>
                                {i.name} · {i.barcode}
                              </option>
                            ))}
                        </datalist>
                        {receiptItem(line) ? (
                          <p>
                            <strong>{receiptItem(line)!.name}</strong> ·{" "}
                            {receiptItem(line)!.unit}
                          </p>
                        ) : (
                          <Notice kind={line.sku ? "warning" : "info"}>
                            {line.sku
                              ? t(
                                  `Item “${line.sku || "…"}” is not selected yet. Search an existing master or register it here.`,
                                  `Barang “${line.sku || "…"}” belum dipilih. Cari master yang ada atau daftarkan di sini.`,
                                )
                              : t(
                                  "Find an existing item above or register a new item here.",
                                  "Cari barang yang sudah ada di atas atau daftarkan barang baru di sini.",
                                )}
                            {line.proposalId && (
                              <p>
                                {t(
                                  "Awaiting item review",
                                  "Menunggu review barang",
                                )}{" "}
                                · {line.proposalId}
                              </p>
                            )}
                            <Button
                              disabled={!read?.capabilities.operate}
                              onClick={() =>
                                setNewItem({
                                  index,
                                  sku: line.sku,
                                  name: "",
                                  unit: "",
                                  barcode: "",
                                  internal: false,
                                })
                              }
                            >
                              {read?.capabilities.master
                                ? t("Add new item", "Tambah barang baru")
                                : t("Propose new item", "Ajukan barang baru")}
                            </Button>
                          </Notice>
                        )}
                        <Field
                          label={t(
                            `Actual quantity (${receiptItem(line)?.unit || t("base unit", "satuan dasar")})`,
                            `Jumlah aktual (${receiptItem(line)?.unit || "satuan dasar"})`,
                          )}
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) =>
                            linePatch(index, { qty: e.target.value })
                          }
                        />
                        <Field
                          label={t(
                            "Scan item barcode / SKU",
                            "Pindai barcode / SKU barang",
                          )}
                          value={line.scan}
                          onChange={(e) =>
                            linePatch(index, { scan: e.target.value })
                          }
                          autoComplete="off"
                        />
                      </section>
                    ))}
                    <Button
                      disabled={form.lines?.length >= 50}
                      onClick={() =>
                        patch({
                          lines: [
                            ...form.lines,
                            { id: referenceId(), sku: "", qty: "", scan: "" },
                          ],
                        })
                      }
                    >
                      <Plus size={18} />
                      {t("Add receipt line", "Tambah baris penerimaan")}
                    </Button>
                  </>
                )}
                <Notice>
                  {t(
                    "After confirmation: goods are in Receiving and awaiting QC. Available remains zero.",
                    "Setelah konfirmasi: barang berada di Receiving, menunggu QC. Jumlah tersedia tetap nol.",
                  )}
                </Notice>
              </>
            ) : action === "relocate" ? (
              <>
                <p>
                  {t(
                    "Only good, unreserved stock can move between active storage racks.",
                    "Hanya stok bagus yang belum dipesan dapat dipindahkan antar rak aktif.",
                  )}
                </p>
                <Field label={t("Choose source position", "Pilih posisi asal")}>
                  <select
                    value={form.position || ""}
                    onChange={(e) =>
                      patch({ position: e.target.value, sourceScan: "" })
                    }
                  >
                    <option value="">
                      {t(
                        "Select the physical source",
                        "Pilih asal fisik barang",
                      )}
                    </option>
                    {sources.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.location} · {p.available} {p.unit}{" "}
                        {t("free", "bebas")}
                      </option>
                    ))}
                  </select>
                </Field>
                {field(t("Scan source rack", "Pindai rak asal"), "sourceScan")}
                {destinationField}
                {qtyField(item?.unit || "")}
                {scanField()}
                {source && quantity(form.qty || "") && (
                  <p>
                    {source.location}: {source.qty} →{" "}
                    {Number(source.qty) - Number(quantity(form.qty))}{" "}
                    {item?.unit}.{" "}
                    {t("Warehouse total is unchanged.", "Total gudang tetap.")}
                  </p>
                )}
              </>
            ) : action === "new-order" ? (
              <>
                <Field
                  label={t("Search item", "Cari barang")}
                  value={orderItemSearch}
                  onChange={(e) => setOrderItemSearch(e.target.value)}
                />
                <Field label={t("Choose item", "Pilih barang")}>
                  <select
                    value={form.sku || ""}
                    onChange={(e) => patch({ sku: e.target.value })}
                  >
                    <option value="">
                      {t("Choose an active item", "Pilih barang aktif")}
                    </option>
                    {read?.items
                      .filter((i) => i.active && !i.restricted)
                      .map((i) => (
                        <option key={i.sku} value={i.sku}>
                          {i.sku} · {i.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {qtyField(
                  read?.items.find((i) => i.sku === form.sku)?.unit || "",
                )}
                <p>
                  {t(
                    "Creates a draft request. Review, release and allocation remain separate steps.",
                    "Membuat draf permintaan. Review, release dan alokasi tetap langkah terpisah.",
                  )}
                </p>
              </>
            ) : receiptHeader ? (
              <>
                <h3>
                  {t(
                    "Receipt confirmed · awaiting QC / storage",
                    "Penerimaan tercatat · lanjut QC / simpan",
                  )}
                </h3>
                <p>
                  {receiptHeader.origin} ·{" "}
                  {receiptHeader.reference ||
                    t("No delivery reference", "Tanpa referensi surat jalan")}
                </p>
                {receiptHeader.lines.map((line: any) => (
                  <p key={line.id}>
                    {line.sku}: {line.qty} {line.unit}
                  </p>
                ))}
                <p>{receiptHeader.reason}</p>
              </>
            ) : doc?.kind === "inspection" &&
              Number(doc.actual) >= Number(doc.qty) ? (
              <Notice kind="success">
                {t(
                  `QC complete: ${doc.qcGood ?? "—"} ${doc.unit} good, ${doc.qcBad ?? "—"} ${doc.unit} not good. Continue with the linked putaway task. Not good goods remain held at QC.`,
                  `QC selesai: ${doc.qcGood ?? "—"} ${doc.unit} bagus, ${doc.qcBad ?? "—"} ${doc.unit} tidak bagus. Lanjutkan tugas simpan ke rak terkait. Barang tidak bagus tetap ditahan di QC.`,
                )}
              </Notice>
            ) : doc?.kind === "inspection" ? (
              <>
                <p>
                  {t("Quantity to classify", "Jumlah yang harus diklasifikasi")}
                  :{" "}
                  <strong>
                    {balance(doc.qty, doc.actual, "0")} {doc.unit}
                  </strong>
                </p>
                {read?.capabilities.qc ? (
                  <>
                    {field(
                      t(`Good (${doc.unit})`, `Bagus (${doc.unit})`),
                      "good",
                      { inputMode: "decimal" },
                    )}
                    {field(
                      t(`Not good (${doc.unit})`, `Tidak bagus (${doc.unit})`),
                      "bad",
                      { inputMode: "decimal" },
                    )}
                    <p role="status">
                      {t("Unclassified", "Belum diklasifikasi")}:{" "}
                      <strong>
                        {balance(
                          balance(doc.qty, doc.actual, "0")!,
                          form.good || "",
                          form.bad || "",
                        ) ?? "—"}{" "}
                        {doc.unit}
                      </strong>
                    </p>
                    {field(
                      t(
                        "Reason for not good results",
                        "Alasan hasil tidak bagus",
                      ),
                      "reason",
                    )}
                    <Notice>
                      {t(
                        "Confirming QC classifies the entire remainder. Save a draft if your inspection is unfinished.",
                        "Konfirmasi QC mengklasifikasi seluruh sisa. Simpan draf jika pemeriksaan belum selesai.",
                      )}
                    </Notice>
                  </>
                ) : (
                  <Notice>
                    {t(
                      "Waiting for inspection by a supervisor or administrator.",
                      "Menunggu pemeriksaan oleh supervisor atau admin.",
                    )}
                  </Notice>
                )}
              </>
            ) : doc?.kind === "putaway" &&
              Number(doc.actual) >= Number(doc.qty) ? (
              <Notice kind="success">
                {t(
                  "Storage step complete. Check stock positions for current availability.",
                  "Tahap simpan ke rak selesai. Lihat posisi stok untuk ketersediaan terkini.",
                )}
                : {doc.actual} {doc.unit}
              </Notice>
            ) : doc?.kind === "putaway" ? (
              <>
                <p>
                  {t("Ready to store", "Siap disimpan")}:{" "}
                  {balance(doc.qty, doc.actual, "0")} {doc.unit}
                </p>
                {destinationField}
                {qtyField(doc.unit)}
                {scanField()}
              </>
            ) : doc?.kind === "order" ? (
              <>
                <div className="workflow-order-state">
                  <Tag>{statusLabel(doc.status)}</Tag>
                  <p>
                    {t("Requested", "Diminta")}: {doc.qty} ·{" "}
                    {t("Picked", "Diambil")}: {doc.picked} ·{" "}
                    {t("Shipped", "Dikirim")}: {doc.shipped} {doc.unit}
                  </p>
                </div>
                {doc.reason && <Notice kind="warning">{doc.reason}</Notice>}
                {["draft", "rejected"].includes(doc.status) && (
                  <>
                    {qtyField(doc.unit)}
                    {field(t("Revision reason", "Alasan revisi"), "reason")}
                    <Button
                      disabled={
                        !operationAllowed ||
                        !quantity(form.qty || "") ||
                        !form.reason?.trim()
                      }
                      onClick={() =>
                        prepare(
                          "revise-order",
                          {
                            id: doc.id,
                            version: doc.version,
                            qty: quantity(form.qty),
                            reason: form.reason,
                          },
                          doc.version,
                          t(
                            "Save the revised request. It must be submitted for independent review again.",
                            "Simpan revisi permintaan. Tetap harus diajukan untuk review independen.",
                          ),
                          true,
                        )
                      }
                    >
                      {t("Review revision", "Tinjau revisi")}
                    </Button>
                    {doc.status === "draft" && (
                      <Button
                        primary
                        disabled={!operationAllowed}
                        onClick={() =>
                          prepare(
                            "submit-order",
                            { id: doc.id, version: doc.version },
                            doc.version,
                            t(
                              "Submit this request for an independent review.",
                              "Ajukan permintaan ini untuk review independen.",
                            ),
                            true,
                          )
                        }
                      >
                        {t("Submit for review", "Ajukan untuk review")}
                      </Button>
                    )}
                  </>
                )}
                {doc.status === "pending-approval" &&
                  (read?.capabilities.orderReview && doc.creator !== user.id ? (
                    <>
                      {field(
                        t(
                          "Reason if revision is needed",
                          "Alasan jika perlu revisi",
                        ),
                        "reason",
                      )}
                      <div className="form-actions">
                        <Button
                          primary
                          onClick={() =>
                            prepare(
                              "approve-order",
                              { order: doc.id },
                              doc.version,
                              t(
                                "Approve this request. Release remains a separate action.",
                                "Setujui permintaan ini. Release tetap tindakan terpisah.",
                              ),
                            )
                          }
                        >
                          {t("Review approval", "Tinjau persetujuan")}
                        </Button>
                        <Button
                          disabled={!form.reason?.trim()}
                          onClick={() =>
                            prepare(
                              "reject-order",
                              { order: doc.id, reason: form.reason },
                              doc.version,
                              t(
                                "Return this request to its creator for revision.",
                                "Kembalikan permintaan kepada pembuat untuk revisi.",
                              ),
                            )
                          }
                        >
                          {t("Request revision", "Minta revisi")}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Notice>
                      {t(
                        "Awaiting an authorized reviewer. The creator cannot approve their own request.",
                        "Menunggu reviewer berwenang. Pembuat tidak dapat menyetujui permintaan sendiri.",
                      )}
                    </Notice>
                  ))}
                {doc.status === "approved" && (
                  <Button
                    primary
                    disabled={!read?.capabilities.qc}
                    onClick={() =>
                      prepare(
                        "release-order",
                        { order: doc.id },
                        doc.version,
                        t(
                          "Release the approved request for allocation.",
                          "Rilis permintaan yang disetujui agar dapat dialokasikan.",
                        ),
                      )
                    }
                  >
                    {t("Review release", "Tinjau release")}
                  </Button>
                )}
                {doc.status === "released" && (
                  <OrderWork
                    doc={doc}
                    read={read!}
                    form={form}
                    field={field}
                    patch={patch}
                    qtyField={qtyField}
                    scanField={scanField}
                    prepare={prepare}
                    allowed={operationAllowed}
                  />
                )}
                {Number(doc.shipped) > 0 && (
                  <Button
                    onClick={() =>
                      props.go("returns", {
                        sku: doc.sku,
                        mode: "customer",
                        source: "",
                        sourceSearch: doc.id,
                        sourcePage: 1,
                      })
                    }
                  >
                    {t(
                      "Customer return from this shipment",
                      "Retur pelanggan dari pengiriman ini",
                    )}
                  </Button>
                )}
                {!["cancelled"].includes(doc.status) &&
                  read?.capabilities.qc && (
                    <Button onClick={() => props.go("cancellation", doc.id)}>
                      {t(
                        "Open cancellation / return to rack",
                        "Buka pembatalan / kembali ke rak",
                      )}
                    </Button>
                  )}
              </>
            ) : (
              <>
                <p>{item?.name}</p>
                {item?.restricted ? (
                  <Notice kind="warning">
                    {t(
                      "Stock actions and balances are hidden during a blind count.",
                      "Aksi dan saldo stok disembunyikan selama opname blind count.",
                    )}
                  </Notice>
                ) : (
                  <>
                    <div className="workflow-action-list">
                      <Button
                        primary
                        disabled={!operationAllowed || item?.active === false}
                        onClick={() => changeAction("receive")}
                      >
                        {t("Receive this item", "Terima barang ini")}
                        <ArrowRight />
                      </Button>
                      <Button
                        disabled={!operationAllowed || !sources.length}
                        onClick={() => changeAction("relocate")}
                      >
                        {t("Move between racks", "Pindah rak")}
                        <ArrowRight />
                      </Button>
                      {!sources.length && (
                        <p>
                          {t(
                            "There is no free, good stock in an active storage rack. Check QC, reservations or putaway below.",
                            "Belum ada stok bagus yang bebas di rak aktif. Periksa QC, pesanan atau simpan ke rak di bawah.",
                          )}
                        </p>
                      )}
                      <Button
                        disabled={!operationAllowed}
                        onClick={() => {
                          setForm({
                            action: "new-order",
                            sku: context.sku,
                            qty: "",
                          });
                          setDirty(false);
                        }}
                      >
                        {t("Create outbound request", "Buat permintaan keluar")}
                        <ArrowRight />
                      </Button>
                      <Button
                        onClick={() =>
                          props.go("transfers", {
                            sku: context.sku,
                            location: "",
                          })
                        }
                      >
                        {t("Warehouse transfer", "Transfer gudang")}
                      </Button>
                      <Button onClick={() => props.go("tracking")}>
                        {t("Complete stock history", "Riwayat stok lengkap")}
                      </Button>
                    </div>
                    {positions
                      .filter((p) => Number(p.qty) > 0)
                      .map((p) => (
                        <div className="workflow-task" key={p.id}>
                          <div>
                            <strong>{p.location}</strong>
                            <p>
                              {statusLabel(p.condition)}{" "}
                              {p.hold && `· ${statusLabel(p.hold)}`}{" "}
                              {p.frozen && `· ${t("Frozen", "Dibekukan")}`}
                            </p>
                          </div>
                          <span>
                            {t("Physical", "Fisik")}: {p.qty} {p.unit}
                            <small>
                              {t("Free", "Bebas")}: {p.available}
                            </small>
                          </span>
                        </div>
                      ))}
                  </>
                )}
              </>
            )}
            {!draftList && !newItem && !review && (
              <>
                {doc && (
                  <>
                    <ExportPanel
                      warehouse={warehouse}
                      user={user}
                      options={exportOptions}
                      request={{ documentId: doc.id, version: doc.version }}
                      context={JSON.stringify([context, doc.version])}
                    />
                    <DocumentDates
                      row={doc}
                      warehouse={warehouse}
                      user={user}
                      onSaved={() => {
                        reload((n) => n + 1);
                        void refresh();
                      }}
                    />
                  </>
                )}
                {timeline.length > 0 && (
                  <section className="workflow-timeline">
                    <h3>
                      {t(
                        "Related stages and history",
                        "Tahap terkait dan riwayat",
                      )}
                    </h3>
                    {timeline.map((d) => (
                      <div className="workflow-task" key={d.id}>
                        <div>
                          <strong>
                            {documentLabel(d.kind)} · {d.sku}
                          </strong>
                          <p className="workflow-reference">{d.id}</p>
                          <p>
                            {statusLabel(d.status)} · {d.actual} / {d.qty}{" "}
                            {d.unit}
                          </p>
                        </div>
                        <Button onClick={() => chooseDoc(d)}>
                          {t("Open", "Buka")}
                        </Button>
                      </div>
                    ))}
                  </section>
                )}
                {context.sku && read?.history.length > 0 && (
                  <details>
                    <summary>{t("Recent movements", "Mutasi terbaru")}</summary>
                    {read.history.map((h) => (
                      <p key={h.id}>
                        {h.type} · {h.qty} {h.unit} · {h.location}
                        <small className="workflow-reference">
                          {h.transaction}
                        </small>
                      </p>
                    ))}
                  </details>
                )}
                {!!read?.proposals.length && (
                  <details>
                    <summary>{t("Item proposals", "Pengajuan barang")}</summary>
                    <Field
                      label={t(
                        "Find proposal by full ID",
                        "Cari pengajuan dengan ID lengkap",
                      )}
                      value={proposalSearch}
                      onChange={(e) => setProposalSearch(e.target.value)}
                    />
                    <Button
                      onClick={() => loadProposals(1, proposalSearch.trim())}
                    >
                      {t("Find proposal", "Cari pengajuan")}
                    </Button>
                    {read.proposals.map((row: any) => (
                      <div className="workflow-proposal" key={row.proposal.id}>
                        <strong>
                          {row.proposal.data.name} · {row.proposal.data.sku}
                        </strong>
                        {row.proposal.owner === user.id &&
                          row.proposal.data.receiptDraft && (
                            <Button
                              onClick={() =>
                                loadDraft(row.proposal.data.receiptDraft)
                              }
                            >
                              {t(
                                "Open original receipt draft",
                                "Buka draf penerimaan asal",
                              )}
                            </Button>
                          )}
                        <p>
                          {row.proposal.status} · {row.proposal.id}
                        </p>
                        {row.proposal.status === "approved" && (
                          <Button
                            onClick={() =>
                              safe(async () => {
                                const fresh = await workflowRead(warehouse, {
                                  view: "items",
                                  sku: row.proposal.sku,
                                });
                                setRead((old) =>
                                  old
                                    ? {
                                        ...old,
                                        items: [
                                          ...old.items.filter(
                                            (i) => i.sku !== row.proposal.sku,
                                          ),
                                          ...fresh.items,
                                        ],
                                      }
                                    : old,
                                );
                                setMessage(
                                  t(
                                    "Master is available. Select its SKU on the receipt line and verify the scan.",
                                    "Master sudah tersedia. Pilih SKU di baris penerimaan dan periksa hasil pindai.",
                                  ),
                                );
                              })
                            }
                          >
                            {t("Load approved item", "Muat barang disetujui")}
                          </Button>
                        )}
                        {read.capabilities.master &&
                          row.proposal.status === "pending" && (
                            <>
                              <Field
                                label={t(
                                  "Canonical SKU (existing or new)",
                                  "SKU canonical (yang ada atau baru)",
                                )}
                                value={
                                  form[`proposal-${row.proposal.id}`] ||
                                  row.proposal.data.sku
                                }
                                onChange={(e) =>
                                  patch({
                                    [`proposal-${row.proposal.id}`]:
                                      e.target.value,
                                  })
                                }
                              />
                              <Button
                                onClick={() =>
                                  safe(async () => {
                                    await reviewItemProposal(
                                      warehouse,
                                      row.proposal.id,
                                      row.version,
                                      {
                                        action: "approve",
                                        sku:
                                          form[`proposal-${row.proposal.id}`] ||
                                          row.proposal.data.sku,
                                        generateBarcode:
                                          !row.proposal.data.barcode,
                                      },
                                    );
                                    reload((n) => n + 1);
                                    setMessage(
                                      t(
                                        "Proposal approved. No stock has been posted.",
                                        "Pengajuan disetujui. Belum ada stok yang diposting.",
                                      ),
                                    );
                                  })
                                }
                              >
                                {t(
                                  "Approve item mapping",
                                  "Setujui identitas barang",
                                )}
                              </Button>
                              <Field
                                label={t("Revision reason", "Alasan revisi")}
                                value={
                                  form[`proposal-reason-${row.proposal.id}`] ||
                                  ""
                                }
                                onChange={(e) =>
                                  patch({
                                    [`proposal-reason-${row.proposal.id}`]:
                                      e.target.value,
                                  })
                                }
                              />
                              <Button
                                disabled={
                                  !form[`proposal-reason-${row.proposal.id}`]
                                }
                                onClick={() =>
                                  safe(async () => {
                                    await reviewItemProposal(
                                      warehouse,
                                      row.proposal.id,
                                      row.version,
                                      {
                                        action: "revise",
                                        reason:
                                          form[
                                            `proposal-reason-${row.proposal.id}`
                                          ],
                                      },
                                    );
                                    reload((n) => n + 1);
                                  })
                                }
                              >
                                {t("Request revision", "Minta revisi")}
                              </Button>
                            </>
                          )}
                      </div>
                    ))}
                    <div className="form-actions">
                      <Button
                        disabled={read.proposalPage.page <= 1}
                        onClick={() =>
                          loadProposals(read.proposalPage.page - 1)
                        }
                      >
                        {t("Previous proposals", "Pengajuan sebelumnya")}
                      </Button>
                      <span>
                        {read.proposalPage.page} / {read.proposalPage.pages} ·{" "}
                        {read.proposalPage.total}
                      </span>
                      <Button
                        disabled={
                          read.proposalPage.page >= read.proposalPage.pages
                        }
                        onClick={() =>
                          loadProposals(read.proposalPage.page + 1)
                        }
                      >
                        {t("Next proposals", "Pengajuan berikutnya")}
                      </Button>
                    </div>
                  </details>
                )}
              </>
            )}
          </fieldset>
          {!newItem && !draftList && !completedDraft && (
            <footer className="workflow-footer">
              {review ? (
                <>
                  <Button disabled={busy} onClick={() => setReview(null)}>
                    {t("Back to edit", "Kembali edit")}
                  </Button>
                  <Button
                    primary
                    disabled={busy || loading || !operationAllowed}
                    onClick={confirm}
                  >
                    {busy
                      ? t("Confirming…", "Mengonfirmasi…")
                      : t("Confirm this action", "Konfirmasi tindakan ini")}
                  </Button>
                </>
              ) : (
                <>
                  <span className="workflow-draft-status">
                    {dirty
                      ? t("Unsaved changes", "Perubahan belum tersimpan")
                      : draftVersion
                        ? t(
                            `Saved draft · v${draftVersion}`,
                            `Draf tersimpan · v${draftVersion}`,
                          )
                        : result?.message === "recorded" ||
                            receiptHeader ||
                            doc?.status === "complete"
                          ? t("Recorded document", "Dokumen tercatat")
                          : t("Not confirmed", "Belum dikonfirmasi")}
                  </span>
                  <Button
                    disabled={
                      busy || completedDraft || !read?.capabilities.operate
                    }
                    onClick={() => safe(saved)}
                  >
                    {t("Save draft", "Simpan draf")}
                  </Button>
                  {action === "receive" && (
                    <Button
                      primary
                      disabled={
                        !operationAllowed ||
                        !receiptValid ||
                        ["unknown", "offline"].includes(result?.message)
                      }
                      onClick={receiveReview}
                    >
                      {t("Review receipt", "Tinjau penerimaan")}
                    </Button>
                  )}
                  {action === "relocate" && (
                    <Button
                      primary
                      disabled={
                        !operationAllowed ||
                        !source ||
                        !quantity(form.qty || "") ||
                        Number(quantity(form.qty || "")) >
                          Number(source.available) ||
                        !storage.some(
                          (l) =>
                            l.code === form.destination &&
                            l.code !== source.location,
                        ) ||
                        !form.sourceScan ||
                        !form.locationScan ||
                        !form.scan
                      }
                      onClick={() =>
                        prepare(
                          "relocate",
                          {
                            document: form.document,
                            sku: context.sku,
                            position: source.id,
                            positionVersion: source.version,
                            qty: quantity(form.qty),
                            sourceScan: form.sourceScan,
                            destination: form.destination,
                            locationScan: form.locationScan,
                            scan: form.scan,
                          },
                          null,
                          t(
                            "Move free stock between the selected racks. Warehouse physical and available totals stay unchanged.",
                            "Pindahkan stok bebas antar rak terpilih. Total fisik dan tersedia gudang tetap.",
                          ),
                        )
                      }
                    >
                      {t("Review move", "Tinjau perpindahan")}
                    </Button>
                  )}
                  {action === "new-order" && (
                    <Button
                      primary
                      disabled={
                        !operationAllowed ||
                        !form.sku ||
                        !quantity(form.qty || "")
                      }
                      onClick={() =>
                        prepare(
                          "create-order",
                          {
                            id: form.document || draftId,
                            sku: form.sku,
                            qty: quantity(form.qty),
                          },
                          null,
                          t(
                            "Create a draft request with this item and quantity.",
                            "Buat draf permintaan dengan barang dan jumlah ini.",
                          ),
                          true,
                        )
                      }
                    >
                      {t("Review request", "Tinjau permintaan")}
                    </Button>
                  )}
                  {doc?.kind === "inspection" &&
                    Number(doc.actual) < Number(doc.qty) && (
                      <Button
                        primary
                        disabled={
                          !operationAllowed ||
                          !read?.capabilities.qc ||
                          balance(
                            balance(doc.qty, doc.actual, "0")!,
                            form.good || "",
                            form.bad || "",
                          ) !== "0" ||
                          (Number(quantity(form.bad || "", true)) > 0 &&
                            !form.reason?.trim())
                        }
                        onClick={() =>
                          prepare(
                            "qc",
                            {
                              task: doc.id,
                              good: quantity(form.good, true),
                              bad: quantity(form.bad, true),
                              reason: form.reason || "",
                            },
                            doc.version,
                            t(
                              `Classify all remaining goods. Good: ${quantity(form.good, true)} ${doc.unit}; not good: ${quantity(form.bad, true)} ${doc.unit}.`,
                              `Klasifikasi seluruh sisa barang. Bagus: ${quantity(form.good, true)} ${doc.unit}; tidak bagus: ${quantity(form.bad, true)} ${doc.unit}.`,
                            ),
                          )
                        }
                      >
                        {t("Review QC", "Tinjau QC")}
                      </Button>
                    )}
                  {doc?.kind === "putaway" &&
                    Number(doc.actual) < Number(doc.qty) && (
                      <Button
                        primary
                        disabled={
                          !operationAllowed ||
                          !quantity(form.qty || "") ||
                          Number(quantity(form.qty || "")) >
                            Number(doc.qty) - Number(doc.actual) ||
                          !storage.some((l) => l.code === form.destination) ||
                          !form.scan ||
                          !form.locationScan
                        }
                        onClick={() =>
                          prepare(
                            "putaway",
                            {
                              task: doc.id,
                              qty: quantity(form.qty),
                              destination: form.destination,
                              locationScan: form.locationScan,
                              scan: form.scan,
                            },
                            doc.version,
                            t(
                              "Store the actual good quantity in the scanned rack. It becomes available if the rack remains eligible.",
                              "Simpan jumlah aktual yang bagus di rak terpindai. Stok tersedia jika rak tetap memenuhi syarat.",
                            ),
                          )
                        }
                      >
                        {t("Review putaway", "Tinjau simpan ke rak")}
                      </Button>
                    )}
                </>
              )}
            </footer>
          )}
        </aside>
      )}
    </div>
  );
}

function OrderWork({
  doc,
  read,
  form,
  field,
  patch,
  qtyField,
  scanField,
  prepare,
  allowed,
}: any) {
  const t = useText();
  const allocated = sumQuantity(doc.allocations.map((a: any) => a.qty));
  const need = balance(doc.qty, doc.shipped, allocated)!;
  const plan = allocationPlan(
    Number(need) > 0 ? need : "0",
    read.positions.filter((p: any) => p.sku === doc.sku),
    read.partialAllowed,
  );
  const pickSources = doc.allocations.filter(
    (a: any) => a.location !== "Staging" && Number(a.qty) > 0,
  );
  const picked = pickSources.find((a: any) => a.position === form.pickPosition);
  const staged = doc.allocations
    .filter((a: any) => a.location === "Staging")
    .reduce((n: number, a: any) => n + Number(a.qty), 0);
  return (
    <>
      {Number(need) > 0 && (
        <section>
          <h3>{t("Allocate from racks", "Alokasikan dari rak")}</h3>
          <p>
            {t("Outstanding need", "Kebutuhan belum dialokasikan")}: {need}{" "}
            {doc.unit}
          </p>
          {plan.allocations.map((a: any) => (
            <p key={a.position}>
              {read.positions.find((p: any) => p.id === a.position)?.location}:{" "}
              {a.qty} {doc.unit}
            </p>
          ))}
          {Number(plan.shortage) > 0 && (
            <Notice kind="warning">
              {doc.name}: {t("short by", "kurang")} {plan.shortage} {doc.unit}.{" "}
              {read.partialAllowed
                ? t(
                    "Partial fulfilment is permitted. Review the exact allocated quantity.",
                    "Pemenuhan sebagian diizinkan. Tinjau jumlah yang benar-benar dialokasikan.",
                  )
                : t(
                    "Full allocation is required. Receive stock or wait for stock to become available.",
                    "Alokasi penuh diwajibkan. Terima stok atau tunggu stok tersedia.",
                  )}
            </Notice>
          )}
          <Button
            primary
            disabled={!allowed || !plan.allowed}
            onClick={() =>
              prepare(
                "reserve-plan",
                { order: doc.id, allocations: plan.allocations },
                doc.version,
                t(
                  "Reserve the reviewed quantities atomically across these racks. This does not move physical goods.",
                  "Pesan jumlah yang ditinjau secara atomik dari rak-rak ini. Belum memindahkan fisik barang.",
                ),
              )
            }
          >
            {t("Review allocation", "Tinjau alokasi")}
          </Button>
        </section>
      )}
      {pickSources.length > 0 && (
        <section>
          <h3>{t("Pick to Staging", "Ambil ke Staging")}</h3>
          <Field label={t("Source allocation", "Alokasi asal")}>
            <select
              value={form.pickPosition || ""}
              onChange={(e) =>
                patch({
                  pickPosition: e.target.value,
                  locationScan: "",
                  qty: "",
                  scan: "",
                })
              }
            >
              <option value="">
                {t("Select source rack", "Pilih rak asal")}
              </option>
              {pickSources.map((a: any) => (
                <option key={a.position} value={a.position}>
                  {a.location} · {a.qty} {doc.unit}
                </option>
              ))}
            </select>
          </Field>
          {qtyField(doc.unit)}
          {scanField()}
          {field(t("Scan source rack", "Pindai rak asal"), "locationScan")}
          {field(
            t(
              "Short pick reason (required for less than allocation)",
              "Alasan ambil kurang (wajib jika kurang dari alokasi)",
            ),
            "reason",
          )}
          <Button
            primary
            disabled={
              !allowed ||
              !picked ||
              !quantity(form.qty || "") ||
              Number(quantity(form.qty || "")) > Number(picked.qty) ||
              !form.scan ||
              !form.locationScan ||
              (Number(quantity(form.qty || "")) < Number(picked?.qty) &&
                !form.reason?.trim())
            }
            onClick={() =>
              prepare(
                "pick",
                {
                  order: doc.id,
                  location: picked.location,
                  locationScan: form.locationScan,
                  scan: form.scan,
                  qty: quantity(form.qty),
                  reason: form.reason || "",
                },
                doc.version,
                t(
                  "Move this actual quantity to Staging. A short pick keeps the remaining stock and reservation.",
                  "Pindahkan jumlah aktual ke Staging. Ambil kurang mempertahankan sisa stok dan pesanan.",
                ),
              )
            }
          >
            {t("Review picking", "Tinjau pengambilan")}
          </Button>
        </section>
      )}
      {staged > 0 && (
        <section>
          <h3>{t("Check package and ship", "Periksa paket dan kirim")}</h3>
          <p>
            {t("In Staging", "Di Staging")}: {staged} {doc.unit}
          </p>
          {doc.allocations
            .filter((a: any) => a.location === "Staging" && Number(a.qty) > 0)
            .map((a: any) => (
              <p key={a.position}>
                {doc.name} · {a.qty} {doc.unit}
              </p>
            ))}
          {qtyField(doc.unit)}
          {scanField()}
          <label className="check">
            <input
              type="checkbox"
              checked={!!form.packed}
              onChange={(e) => patch({ packed: e.target.checked })}
            />
            {t(
              "I checked the package contents and the goods are physically leaving.",
              "Saya sudah memeriksa isi paket dan barang benar-benar berangkat.",
            )}
          </label>
          <Button
            primary
            disabled={
              !allowed ||
              !form.packed ||
              !form.scan ||
              !quantity(form.qty || "") ||
              Number(quantity(form.qty || "")) > staged ||
              (!read.partialAllowed &&
                Number(quantity(form.qty || "")) !==
                  Number(doc.qty) - Number(doc.shipped))
            }
            onClick={() =>
              prepare(
                "ship",
                {
                  order: doc.id,
                  qty: quantity(form.qty),
                  scan: form.scan,
                  packingVerified: true,
                },
                doc.version,
                t(
                  "Confirm that the reviewed goods have physically departed.",
                  "Konfirmasi bahwa barang yang ditinjau sudah benar-benar berangkat.",
                ),
              )
            }
          >
            {t("Review shipment", "Tinjau pengiriman")}
          </Button>
        </section>
      )}
    </>
  );
}
