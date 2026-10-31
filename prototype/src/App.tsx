import React, { useEffect, useRef, useState } from "react";
import {
  Cube,
  TrayArrowDown,
  Truck,
  ArrowsLeftRight,
  GearSix,
  Users,
  CaretDown,
  List,
  SignOut,
  ShieldCheck,
  Stack,
} from "@phosphor-icons/react";
import { initialState, MAIN } from "./fixtures";
import * as api from "./api";
import {
  Locale,
  useText,
  Button,
  Field,
  Notice,
  Modal,
  Summary,
  errorText,
} from "./ui.tsx";
import { screens } from "./catalog";
import { Auth, Workspace, Settings } from "./account.tsx";
import { Stock } from "./Stock.tsx";
import { Operations } from "./Operations.tsx";
import { Access, Master, Controls } from "./management.tsx";

const icons = {
  inventory: Cube,
  inbound: TrayArrowDown,
  outbound: Truck,
  operations: ArrowsLeftRight,
  control: Stack,
  admin: Users,
};
const authRoutes = ["signin", "register", "forgot", "reset"];
export function App() {
  const [locale, setLocale] = useState("en");
  return (
    <Locale.Provider value={locale}>
      <Application locale={locale} setLocale={setLocale} />
    </Locale.Provider>
  );
}
function Application({ locale, setLocale }) {
  const t = useText();
  const [data, replaceData] = useState<any>(initialState);
  const [user, replaceUser] = useState<api.SessionUser | null>(null);
  const dataRef = useRef<any>(data);
  dataRef.current = data;
  const userRef = useRef<api.SessionUser | null>(null);
  const lastEdit = useRef<Promise<boolean>>(Promise.resolve(true));
  const [authMode, setAuthMode] =
    useState<api.Session["mode"]>("development-demo");
  const [warehouse, setWarehouse] = useState(MAIN);
  const warehouseRef = useRef(warehouse);
  warehouseRef.current = warehouse;
  const [snapshotScope, setSnapshotScope] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [route, setRoute] = useState(() =>
    authRoutes.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "signin",
  );
  const [theme, setTheme] = useState("light");
  const [mode, setMode] = useState("normal");
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const go = (next) => {
    location.hash = next;
    setRoute(next);
    setMenu(false);
    setNotice(null);
  };
  const refresh = async (target = warehouse, owner = userRef.current?.id) => {
    if (!owner) return;
    try {
      const snapshot = await api.snapshot(target);
      const pending = await api.pending();
      if (userRef.current?.id === owner && warehouseRef.current === target) {
        const next = { ...snapshot, pending };
        dataRef.current = next;
        replaceData(next);
        setSnapshotScope(`${owner}|${target}`);
        setStale(false);
        if (
          snapshot.currentRole &&
          userRef.current.role !== snapshot.currentRole
        ) {
          userRef.current = { ...userRef.current, role: snapshot.currentRole };
          replaceUser(userRef.current);
        }
      }
    } catch (error) {
      setStale(true);
      throw error;
    }
  };
  const setData = (update: any) => {
    const before = dataRef.current;
    const next = typeof update === "function" ? update(before) : update;
    lastEdit.current = api
      .persistEdit(before, next, warehouse)
      .then(async () => {
        if (userRef.current) await refresh();
        else {
          dataRef.current = { ...before, users: next.users };
          replaceData(dataRef.current);
        }
        return true;
      })
      .catch((error) => {
        setNotice({ kind: "error", message: errorText(error.message, t) });
        return false;
      });
    return lastEdit.current;
  };
  const setUser = async (account: Pick<api.SessionUser, "id">) => {
    try {
      const current = await api.login(account.id, "demo123");
      userRef.current = current;
      replaceUser(current);
      const target = current.warehouses.includes(warehouse)
        ? warehouse
        : current.warehouses[0];
      setWarehouse(target);
      await refresh(target, current.id);
    } catch (error) {
      setNotice({ kind: "error", message: errorText(error.message, t) });
    }
  };
  const signIn = async (email: string, password: string) => {
    if (!/^(admin|operator|supervisor)@demo\.company$/.test(email))
      throw new api.ApiError("credentials", 401);
    const current = await api.login(email.split("@")[0], password);
    userRef.current = current;
    replaceUser(current);
    const target = current.warehouses[0];
    setWarehouse(target);
    await refresh(target, current.id);
    go("workspace");
  };
  useEffect(() => {
    api
      .session()
      .then(async (session) => {
        setAuthMode(session.mode);
        if (session.user?.status === "active") {
          userRef.current = session.user;
          replaceUser(session.user);
          const target = session.user.warehouses[0];
          setWarehouse(target);
          if (target) await refresh(target, session.user.id);
          go("workspace");
        } else if (session.user)
          setNotice({
            kind: session.user.status === "pending" ? "warning" : "error",
            message:
              session.user.status === "pending"
                ? t(
                    "Your SSO identity is signed in. Warehouse access is awaiting administrator approval.",
                    "Identitas SSO sudah masuk. Akses gudang menunggu persetujuan admin.",
                  )
                : errorText("account-unavailable", t),
          });
      })
      .catch(() =>
        setNotice({
          kind: "error",
          message: t(
            "Cannot reach the API. Start the .NET API and refresh this page.",
            "API belum terhubung. Jalankan API .NET lalu muat ulang halaman ini.",
          ),
        }),
      );
  }, []);
  useEffect(() => {
    if (userRef.current) {
      setLoading(true);
      refresh()
        .catch((error) => {
          setNotice({ kind: "error", message: errorText(error.message, t) });
          if (error.status === 401 || error.status === 403) {
            userRef.current = null;
            replaceUser(null);
            go("signin");
          }
        })
        .finally(() => setLoading(false));
      return api.subscribe(warehouse, () => {
        void refresh().catch(() => {});
      });
    }
  }, [user?.id, warehouse]);
  useEffect(() => {
    const handle = () => {
      const next = location.hash.slice(1);
      setRoute(user || authRoutes.includes(next) ? next : "signin");
      setMenu(false);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, [user]);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "id";
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu) {
        setMenu(false);
        (document.querySelector(".mobile-menu") as HTMLElement)?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const screen = screens.find((s) => s[0] === route);
  useEffect(() => {
    const titles: Record<string, [string, string]> = {
      workspace: ["Choose workspace", "Pilih ruang kerja"],
      settings: ["Settings", "Pengaturan"],
      signin: ["Sign in", "Masuk"],
      register: ["Request access", "Minta akses"],
      forgot: ["Forgot password", "Lupa password"],
      reset: ["Password recovery", "Pemulihan password"],
    };
    document.title = `${screen ? t(screen[2], screen[3]) : t(...(titles[route] || ["Page not found", "Halaman tidak ditemukan"]))} | Inventory / WMS`;
  }, [route, locale]);
  const flash = (message, kind = "success") => {
    void lastEdit.current.then((ok) => {
      if (ok) setNotice({ message, kind });
    });
  };
  const draftKey = `${user?.id}|${warehouse}|${route}`;
  const patchDraft = (patch) =>
    setDrafts((all) => ({
      ...all,
      [draftKey]: { ...all[draftKey], ...patch },
    }));
  const ask = (type, payload, details) => {
    const source = payload.document || payload.order || payload.task;
    const pending = data.pending.find(
      (p) =>
        p.request.user === user.id &&
        p.request.warehouse === warehouse &&
        p.request.type === type &&
        source &&
        (p.request.payload.document ||
          p.request.payload.order ||
          p.request.payload.task) === source,
    );
    if (pending) {
      setNotice({
        kind: "warning",
        message: (
          <>
            {t(
              "Resolve the original pending request before creating another confirmation for this document.",
              "Periksa permintaan tertunda asal sebelum membuat konfirmasi lain untuk dokumen ini.",
            )}{" "}
            <a href="#pending">
              {t("Open pending transactions", "Buka transaksi tertunda")}
            </a>
          </>
        ),
      });
      return;
    }
    setNotice(null);
    lastEdit.current = Promise.resolve(true);
    const request = {
      id: crypto.randomUUID(),
      type,
      payload,
      warehouse,
      user: user.id,
    };
    setReview({ request, body: api.businessCommand(request, data), details });
  };
  const confirm = () => {
    setBusy(true);
    setTimeout(async () => {
      try {
        const posted = await api.send(
          review.request.id,
          review.body,
          user.id,
          mode,
        );
        await refresh();
        const { message, id } = posted;
        if (message === "offline")
          flash(
            t(
              `Captured offline: ${id}. Stock is not confirmed. Open Pending transactions.`,
              `Tersimpan offline: ${id}. Stok belum dikonfirmasi. Buka Transaksi tertunda.`,
            ),
            "warning",
          );
        else if (message === "unknown")
          flash(
            t(
              `Transaction outcome unknown: ${id}. Check the same request in Pending transactions.`,
              `Hasil transaksi belum jelas: ${id}. Periksa permintaan yang sama di Transaksi tertunda.`,
            ),
            "warning",
          );
        else
          flash(
            t(
              `Recorded by the development API: ${id}. ERP is tracked separately.`,
              `Tercatat oleh API pengembangan: ${id}. Status ERP ditampilkan terpisah.`,
            ),
          );
        setReview(null);
        setDrafts((all) => ({
          ...all,
          [draftKey]: {
            document: review.request.payload.document,
            order: review.request.payload.order,
            task: review.request.payload.task,
            mode: all[draftKey]?.mode,
            view: all[draftKey]?.view,
          },
        }));
      } catch (error) {
        if (import.meta.env.DEV)
          console.warn("Confirmation rejected:", error.code || error.name);
        setReview(null);
        flash(errorText(error.message, t), "error");
      }
      setBusy(false);
    }, 250);
  };
  const checkPending = async (id) => {
    if (mode === "offline") {
      flash(
        t(
          "The demo is offline. Change connection behavior in Settings first.",
          "Demo sedang offline. Ubah perilaku koneksi di Pengaturan dulu.",
        ),
        "warning",
      );
      return;
    }
    try {
      const row = (await api.pending()).find((p) => p.id === id);
      const posted = await api.retryOriginal(row, user, warehouse);
      await refresh();
      if (posted.message === "unknown" || posted.message === "offline") {
        flash(
          t(
            "The original request is still pending. Keep its request ID and check again when the connection is restored.",
            "Permintaan asal masih tertunda. Pertahankan ID permintaan dan periksa lagi saat koneksi pulih.",
          ),
          "warning",
        );
        return;
      }
      flash(
        t(
          `Original request resolved: ${posted.id}.`,
          `Permintaan asal sudah jelas: ${posted.id}.`,
        ),
      );
    } catch (e) {
      flash(errorText(e.message, t), "error");
    }
  };
  const ctx = {
    data,
    setData,
    user,
    warehouse,
    go,
    ask,
    flash,
    draft: drafts[draftKey] || {},
    patchDraft,
    checkPending,
    locale,
    createUser: async (name: string, email: string, reason: string) => {
      await api.createUser(warehouse, name, email, reason);
      await refresh();
      setNotice({
        kind: "success",
        message: t(
          "User added to Pending approvals. Email verification and warehouse access approval are still required.",
          "User ditambahkan ke Menunggu persetujuan. Verifikasi email dan persetujuan akses gudang tetap diperlukan.",
        ),
      });
    },
    deleteUser: async (id: string, reason: string) => {
      await api.deleteUser(warehouse, id, reason);
      await refresh();
      setNotice({
        kind: "success",
        message: t(
          "User deleted and warehouse access removed. Transaction and audit history is retained.",
          "User dihapus dan akses gudang dicabut. Riwayat transaksi dan audit tetap tersimpan.",
        ),
      });
    },
    deleteItem: async (sku: string, version: number, reason: string) => {
      await api.deleteItem(warehouse, sku, version, reason);
      await refresh();
      setNotice({
        kind: "success",
        message: t(
          `Item ${sku} deleted. The audit record is retained.`,
          `Barang ${sku} dihapus. Catatan audit tetap tersimpan.`,
        ),
      });
    },
  };
  const lang = (
    <Field label={t("Language", "Bahasa")}>
      <select value={locale} onChange={(e) => setLocale(e.target.value)}>
        <option value="en">English</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
    </Field>
  );
  if (!user || authRoutes.includes(route))
    return (
      <Auth
        {...{
          route,
          go,
          data,
          setData,
          setUser,
          lang,
          signIn,
          authMode,
          notice,
        }}
      />
    );
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        {t("Skip to content", "Lewati ke isi")}
      </a>
      <div className={`app ${menu ? "menu-open" : ""}`}>
        <aside
          className="sidebar"
          aria-label={t("Main navigation", "Navigasi utama")}
        >
          <a className="brand" href="#stock" onClick={() => setMenu(false)}>
            Inventory / WMS
          </a>
          <nav>
            {[
              ["inventory", t("Inventory", "Persediaan")],
              ["inbound", t("Inbound", "Barang masuk")],
              ["outbound", t("Outbound", "Barang keluar")],
              ["operations", t("Warehouse", "Gudang")],
              ["control", t("Control", "Kontrol")],
              ["admin", t("Administration", "Administrasi")],
            ].map(([group, title]) => (
              <details
                key={group}
                open={screen?.[6] === group}
                name="workspace-navigation"
              >
                <summary>
                  {title}
                  <CaretDown size={13} aria-hidden="true" />
                </summary>
                {screens
                  .filter((s) => s[6] === group)
                  .map((s) => {
                    const Icon = icons[group];
                    return (
                      <a
                        key={s[0]}
                        href={`#${s[0]}`}
                        aria-current={route === s[0] ? "page" : undefined}
                        onClick={() => setMenu(false)}
                      >
                        <Icon size={19} aria-hidden="true" />
                        <span>{t(s[2], s[3])}</span>
                      </a>
                    );
                  })}
              </details>
            ))}
          </nav>
          <div className="sidebar-footer">
            <a
              href="#settings"
              aria-current={route === "settings" ? "page" : undefined}
            >
              <GearSix size={19} aria-hidden="true" />
              {t("Settings", "Pengaturan")}
            </a>
            {lang}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <Button
              className="mobile-menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <List size={20} />
              {t("Menu", "Menu")}
            </Button>
            <button className="scope-button" onClick={() => go("workspace")}>
              {t("Demo Company", "Perusahaan Demo")}
              <CaretDown size={13} />
            </button>
            <span className="scope-separator" />
            <button className="scope-button" onClick={() => go("workspace")}>
              {warehouse}
              <CaretDown size={13} />
            </button>
            <span className="simulation">
              <ShieldCheck size={17} aria-hidden="true" />
              {t("Simulation data", "Data simulasi")}
            </span>
            <div className="topbar-account">
              <span>
                {user.name}
                <small>{user.role}</small>
              </span>
              <button
                className="icon-button"
                aria-label={t("Sign out", "Keluar")}
                onClick={() => setReview({ logout: true })}
              >
                <SignOut size={20} />
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {(!online || stale) && (
              <Notice
                kind="warning"
                title={t("Cached data", "Data tersimpan sementara")}
              >
                {t(
                  "The connection is unavailable or the refresh failed. New captures stay pending until the server confirms them.",
                  "Koneksi tidak tersedia atau pemuatan ulang gagal. Catatan baru tetap tertunda sampai dikonfirmasi server.",
                )}
              </Notice>
            )}
            {mode !== "normal" && (
              <Notice
                kind="warning"
                title={t(
                  "Simulated connection behavior",
                  "Simulasi perilaku koneksi",
                )}
              >
                {mode}.{" "}
                <a href="#settings">
                  {t("Change in Settings", "Ubah di Pengaturan")}
                </a>
              </Notice>
            )}
            {notice && (
              <Notice kind={notice.kind} onClose={() => setNotice(null)}>
                {notice.message}
              </Notice>
            )}
            {route === "workspace" ? (
              <Workspace {...ctx} setWarehouse={setWarehouse} />
            ) : route === "settings" ? (
              <Settings
                {...{
                  user,
                  setUser,
                  data,
                  theme,
                  setTheme,
                  mode,
                  setMode,
                  lang,
                  setData,
                  authMode,
                }}
              />
            ) : !screen ? (
              <div className="empty">
                <h1>{t("Page not found", "Halaman tidak ditemukan")}</h1>
                <Button onClick={() => go("stock")}>
                  {t("Back to stock", "Kembali ke stok")}
                </Button>
              </div>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <h1>{t(screen[2], screen[3])}</h1>
                    <p>{t(screen[4], screen[5])}</p>
                  </div>
                </div>
                {loading || snapshotScope !== `${user.id}|${warehouse}` ? (
                  <Notice
                    title={
                      loading
                        ? t("Loading workspace…", "Lagi memuat ruang kerja…")
                        : t(
                            "Warehouse data is not loaded",
                            "Data gudang belum dimuat",
                          )
                    }
                  >
                    {t(
                      "Existing values are not current while loading.",
                      "Angka sebelumnya belum dianggap terbaru saat memuat.",
                    )}
                  </Notice>
                ) : route === "stock" ? (
                  <Stock {...ctx} />
                ) : route === "access" ? (
                  <Access {...ctx} />
                ) : route === "master" ? (
                  <Master {...ctx} />
                ) : [
                    "integration",
                    "movements",
                    "pending",
                    "monitoring",
                    "tracking",
                    "labels",
                    "rfid",
                  ].includes(route) ? (
                  <Controls {...ctx} route={route} key={route} />
                ) : (
                  <Operations {...ctx} route={route} key={route} />
                )}
              </>
            )}
            <footer className="workspace-footer">
              <span>
                {t(
                  "Development database · Drafts stay in this tab",
                  "Database pengembangan · Draf tetap di tab ini",
                )}
              </span>
              {data.asOf && snapshotScope === `${user.id}|${warehouse}` && (
                <span>
                  {t("Last loaded", "Terakhir dimuat")}:{" "}
                  {new Date(data.asOf).toLocaleString(
                    locale === "en" ? "en-GB" : "id-ID",
                    { timeZone: "Asia/Bangkok" },
                  )}{" "}
                  (UTC+7)
                </span>
              )}
              <button
                className="text-button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await refresh();
                    flash(
                      t(
                        "Latest development data loaded.",
                        "Data pengembangan terbaru dimuat.",
                      ),
                    );
                  } catch (error) {
                    setNotice({
                      kind: "error",
                      message: errorText(error.message, t),
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {t("Refresh view", "Muat ulang tampilan")}
              </button>
            </footer>
          </main>
        </div>
      </div>
      {review && (
        <Modal
          title={
            review.logout
              ? t("Sign out of this demo?", "Keluar dari demo ini?")
              : t("Review and confirm", "Tinjau dan konfirmasi")
          }
          onClose={() => !busy && setReview(null)}
          footer={
            <>
              <Button disabled={busy} onClick={() => setReview(null)}>
                {t("Cancel", "Batal")}
              </Button>
              <Button
                primary
                disabled={busy}
                onClick={
                  review.logout
                    ? async () => {
                        setBusy(true);
                        try {
                          await api.logout();
                          userRef.current = null;
                          replaceUser(null);
                          replaceData(initialState());
                          setSnapshotScope("");
                          setReview(null);
                          go("signin");
                        } catch (error) {
                          setReview(null);
                          setNotice({
                            kind: "error",
                            message: errorText(error.message, t),
                          });
                        } finally {
                          setBusy(false);
                        }
                      }
                    : confirm
                }
              >
                {busy
                  ? t("Recording…", "Lagi mencatat…")
                  : review.logout
                    ? t("Sign out", "Keluar")
                    : t("Confirm", "Konfirmasi")}
              </Button>
            </>
          }
        >
          {review.logout ? (
            <p>
              {t(
                "Pending requests and drafts stay attached to their original user and warehouse in this tab. They will not be sent automatically.",
                "Permintaan tertunda dan draf tetap terikat pengguna dan gudang asal di tab ini. Tidak akan dikirim otomatis.",
              )}
            </p>
          ) : (
            <>
              <Summary
                items={[
                  [
                    t("Company", "Perusahaan"),
                    t("Demo Company", "Perusahaan Demo"),
                  ],
                  [t("Warehouse", "Gudang"), warehouse],
                  ...review.details,
                ]}
              />
              <Notice>
                {t(
                  "The .NET API validates and records this confirmation in the development database.",
                  "API .NET memvalidasi dan mencatat konfirmasi ini di database pengembangan.",
                )}
              </Notice>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
