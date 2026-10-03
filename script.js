// ==========================================================
//  REGISTRO DE INVITADOS  ·  Supabase + Realtime
// ==========================================================
//
//  Ahorro de consultas:
//   - 1 SELECT al abrir la página (solo las columnas necesarias).
//   - Insertar / editar / borrar actualizan la pantalla localmente
//     con la respuesta de Supabase (sin volver a descargar la tabla).
//   - Realtime (un solo canal) sincroniza los cambios de OTROS
//     dispositivos.
//   - Solo si Realtime se cae se hace una consulta de respaldo
//     cada 60 segundos, y se detiene al reconectar.
// ==========================================================

const SUPABASE_URL = "https://peanftztnyfwirikxgsv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dHMDoQKSRW4LFNFhtZz_zg_qDe2yrvq";

const TABLA = "invitados";
const COLUMNAS = "id, nombre, regalo, estado, created_at";

const MAX_REINTENTOS_INICIALES = 5;
const INTERVALO_RESPALDO_MS = 60000;

const $ = (id) => document.getElementById(id);


// ===============================
// CLIENTE SUPABASE
// ===============================

let supabaseClient = null;

try {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: { persistSession: false, autoRefreshToken: false },
            realtime: { params: { eventsPerSecond: 5 } }
        }
    );
} catch (error) {
    console.error("No se pudo iniciar Supabase (¿se cargó la librería?):", error);
}


// ===============================
// ESTADO
// ===============================

let invitados = [];
let editandoId = null;
let canalRealtime = null;
let intentosIniciales = 0;
let temporizadorReintento = null;
let temporizadorRespaldo = null;
let realtimeActivo = false;
let yaSuscritoAntes = false;


// ===============================
// ELEMENTOS
// ===============================

const el = {
    form: $("guestForm"),
    nombre: $("nombre"),
    regalo: $("regalo"),
    estado: $("estado"),
    botonGuardar: $("saveButton"),

    tbody: $("guestTableBody"),
    vacio: $("emptyState"),
    buscador: $("searchInput"),
    conteoBusqueda: $("searchCount"),

    total: $("totalCount"),
    nuevos: $("newCount"),
    cancelados: $("cancelCount"),

    conexion: $("connectionStatus"),
    conexionTexto: $("connectionText"),
    reloj: $("liveDateTime"),

    modal: $("editModal"),
    formEditar: $("editForm"),
    editId: $("editId"),
    editNombre: $("editNombre"),
    editRegalo: $("editRegalo"),
    editEstado: $("editEstado"),
    botonGuardarEdicion: $("saveEdit"),

    toast: $("toast"),
    toastIcono: $("toastIcon"),
    toastMensaje: $("toastMessage")
};

const ICONO_EDITAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

const ICONO_BORRAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';


// ===============================
// INICIO
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    configurarEventos();
    iniciarReloj();
    renderizarTabla();
    actualizarEstadisticas();

    if (!supabaseClient) {
        mostrarConexion("error", "No se cargó Supabase");
        mostrarToast("No se pudo cargar la librería de Supabase. Revisa tu internet.", "error");
        return;
    }

    iniciarConexion();
});

async function iniciarConexion() {
    const ok = await cargarInvitados();

    // Realtime se activa aunque la carga falle: así puede recuperarse solo.
    activarRealtime();

    if (!ok) programarReintento();
}


// ===============================
// EVENTOS
// ===============================

function configurarEventos() {

    el.form.addEventListener("submit", (e) => {
        e.preventDefault();
        agregarInvitado();
    });

    el.formEditar.addEventListener("submit", (e) => {
        e.preventDefault();
        guardarEdicion();
    });

    el.buscador.addEventListener("input", renderizarTabla);

    $("closeModal").addEventListener("click", cerrarModal);
    $("cancelEdit").addEventListener("click", cerrarModal);

    el.modal.addEventListener("click", (e) => {
        if (e.target === el.modal) cerrarModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && el.modal.classList.contains("open")) cerrarModal();
    });

    $("exportExcel").addEventListener("click", exportarExcel);
    $("exportPDF").addEventListener("click", exportarPDF);
    $("deleteAll").addEventListener("click", eliminarTodos);

    // Botones de la tabla (delegación: funciona con ids numéricos o uuid)
    el.tbody.addEventListener("click", (e) => {
        const boton = e.target.closest("[data-accion]");
        if (!boton) return;

        const id = boton.dataset.id;

        if (boton.dataset.accion === "editar") abrirEdicion(id);
        if (boton.dataset.accion === "eliminar") eliminarInvitado(id);
    });

    // Tocar el indicador de conexión fuerza un reintento
    el.conexion.addEventListener("click", reintentarManual);

    window.addEventListener("online", reintentarManual);

    window.addEventListener("offline", () => {
        mostrarConexion("error", "Sin conexión a internet");
    });
}


// ===============================
// CARGA INICIAL (única consulta completa)
// ===============================

async function cargarInvitados() {

    mostrarConexion("connecting");

    try {
        const { data, error } = await supabaseClient
            .from(TABLA)
            .select(COLUMNAS)
            .order("created_at", { ascending: true });

        if (error) throw error;

        invitados = data || [];
        intentosIniciales = 0;

        renderizarTabla();
        actualizarEstadisticas();

        // Si Realtime ya está activo se verá "ok"; si no, se confirma al suscribirse.
        if (realtimeActivo) mostrarConexion("ok");
        else mostrarConexion("connecting", "Conectando en tiempo real...");

        return true;

    } catch (error) {
        console.error("Error cargando invitados:", error);
        mostrarConexion("error", "Error de conexión");

        mostrarToast(describirError(error, "No se pudieron cargar los registros"), "error");

        return false;
    }
}

function programarReintento() {

    clearTimeout(temporizadorReintento);

    if (intentosIniciales >= MAX_REINTENTOS_INICIALES) {
        mostrarConexion("error", "Sin conexión · toca para reintentar");
        return;
    }

    intentosIniciales++;

    temporizadorReintento = setTimeout(async () => {
        const ok = await cargarInvitados();
        if (!ok) programarReintento();
    }, 8000);
}

async function reintentarManual() {

    if (!supabaseClient) return;

    clearTimeout(temporizadorReintento);
    intentosIniciales = 0;

    const ok = await cargarInvitados();

    activarRealtime();

    if (!ok) programarReintento();
}


// ===============================
// REALTIME (un solo canal)
// ===============================

function activarRealtime() {

    if (canalRealtime) {
        supabaseClient.removeChannel(canalRealtime);
        canalRealtime = null;
    }

    canalRealtime = supabaseClient
        .channel("invitados-tiempo-real")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: TABLA },
            manejarCambioRealtime
        )
        .subscribe((status, error) => {

            console.log("Estado Realtime:", status, error || "");

            if (status === "SUBSCRIBED") {

                realtimeActivo = true;
                detenerRespaldo();
                mostrarConexion("ok");

                // Tras una RE-conexión, una sola consulta para no perder cambios.
                if (yaSuscritoAntes) cargarInvitados();
                yaSuscritoAntes = true;

                return;
            }

            if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {

                realtimeActivo = false;
                mostrarConexion("error", "Reconectando...");
                iniciarRespaldo();
            }
        });
}

function manejarCambioRealtime(payload) {

    const tipo = payload.eventType;

    if (tipo === "INSERT" || tipo === "UPDATE") {
        guardarLocal(payload.new);
    }

    if (tipo === "DELETE") {
        quitarLocal(payload.old?.id);
    }

    renderizarTabla();
    actualizarEstadisticas();
}

// Respaldo: solo corre mientras Realtime está caído.
function iniciarRespaldo() {

    if (temporizadorRespaldo) return;

    temporizadorRespaldo = setInterval(() => {
        if (!realtimeActivo) cargarInvitados();
    }, INTERVALO_RESPALDO_MS);
}

function detenerRespaldo() {
    clearInterval(temporizadorRespaldo);
    temporizadorRespaldo = null;
}


// ===============================
// DATOS LOCALES
// ===============================

function guardarLocal(registro) {

    if (!registro || registro.id === undefined) return;

    const indice = invitados.findIndex((i) => String(i.id) === String(registro.id));

    if (indice === -1) invitados.push(registro);
    else invitados[indice] = { ...invitados[indice], ...registro };

    invitados.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

function quitarLocal(id) {
    if (id === undefined || id === null) return;
    invitados = invitados.filter((i) => String(i.id) !== String(id));
}


// ===============================
// AGREGAR
// ===============================

async function agregarInvitado() {

    const nombre = el.nombre.value.trim();
    const regalo = el.regalo.value.trim();
    const estado = el.estado.value;

    if (!nombre) {
        mostrarToast("Escribe el nombre completo", "error");
        el.nombre.focus();
        return;
    }

    if (!regalo) {
        mostrarToast("Escribe el obsequio", "error");
        el.regalo.focus();
        return;
    }

    if (!supabaseClient) {
        mostrarToast("Sin conexión con la base de datos", "error");
        return;
    }

    bloquearBoton(el.botonGuardar, "Guardando...");

    try {
        const { data, error } = await supabaseClient
            .from(TABLA)
            .insert([{ nombre, regalo, estado }])
            .select(COLUMNAS)
            .single();

        if (error) throw error;

        // Se muestra al instante. Si Realtime envía el mismo registro, no se duplica.
        guardarLocal(data);
        renderizarTabla();
        actualizarEstadisticas();

        el.form.reset();
        el.estado.value = "Nuevo";
        el.nombre.focus();

        mostrarToast("Invitado registrado", "success");

    } catch (error) {
        console.error("Error agregando invitado:", error);
        mostrarToast(describirError(error, "No se pudo guardar el registro"), "error");

    } finally {
        liberarBoton(el.botonGuardar);
    }
}


// ===============================
// TABLA
// ===============================

function renderizarTabla() {

    const busqueda = el.buscador.value.toLowerCase().trim();

    const filtrados = invitados.filter((i) =>
        `${i.nombre || ""} ${i.regalo || ""} ${i.estado || ""}`
            .toLowerCase()
            .includes(busqueda)
    );

    // Conteo de búsqueda
    el.conteoBusqueda.textContent =
        busqueda ? `${filtrados.length} de ${invitados.length}` : "";

    // Estado vacío
    const sinRegistros = filtrados.length === 0;
    el.vacio.classList.toggle("visible", sinRegistros);

    if (sinRegistros) {
        const titulo = el.vacio.querySelector("h3");
        const texto = el.vacio.querySelector("p");

        if (invitados.length === 0) {
            titulo.textContent = "Aún no hay invitados";
            texto.textContent = "Completa el formulario de arriba para registrar al primero.";
        } else {
            titulo.textContent = "Sin resultados";
            texto.textContent = "Ningún invitado coincide con la búsqueda.";
        }

        el.tbody.innerHTML = "";
        return;
    }

    el.tbody.innerHTML = filtrados.map((invitado) => {

        const numero = invitados.indexOf(invitado) + 1;
        const estado = invitado.estado || "Nuevo";
        const clase = estado === "Cancelado" ? "cancelado" : "nuevo";
        const id = escaparHTML(invitado.id);

        return `
            <tr>
                <td class="col-num">${numero}</td>
                <td class="cell-name">${escaparHTML(invitado.nombre)}</td>
                <td>${escaparHTML(invitado.regalo)}</td>
                <td><span class="badge ${clase}">${escaparHTML(estado)}</span></td>
                <td class="cell-muted">${formatearFecha(invitado.created_at)}</td>
                <td class="cell-muted">${formatearHora(invitado.created_at)}</td>
                <td class="col-actions">
                    <div class="row-actions">
                        <button type="button" class="btn-icon" title="Editar"
                            aria-label="Editar" data-accion="editar" data-id="${id}">${ICONO_EDITAR}</button>
                        <button type="button" class="btn-icon danger" title="Eliminar"
                            aria-label="Eliminar" data-accion="eliminar" data-id="${id}">${ICONO_BORRAR}</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


// ===============================
// ESTADÍSTICAS
// ===============================

function actualizarEstadisticas() {
    el.total.textContent = invitados.length;
    el.nuevos.textContent = invitados.filter((i) => i.estado === "Nuevo").length;
    el.cancelados.textContent = invitados.filter((i) => i.estado === "Cancelado").length;
}


// ===============================
// EDITAR
// ===============================

function abrirEdicion(id) {

    const invitado = invitados.find((i) => String(i.id) === String(id));
    if (!invitado) return;

    editandoId = invitado.id;

    el.editId.value = invitado.id;
    el.editNombre.value = invitado.nombre || "";
    el.editRegalo.value = invitado.regalo || "";
    el.editEstado.value = invitado.estado || "Nuevo";

    el.modal.classList.add("open");
    el.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(() => el.editNombre.focus(), 50);
}

function cerrarModal() {
    el.modal.classList.remove("open");
    el.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    editandoId = null;
}

async function guardarEdicion() {

    if (editandoId === null) return;

    const nombre = el.editNombre.value.trim();
    const regalo = el.editRegalo.value.trim();
    const estado = el.editEstado.value;

    if (!nombre || !regalo) {
        mostrarToast("Completa todos los campos", "error");
        return;
    }

    bloquearBoton(el.botonGuardarEdicion, "Guardando...");

    try {
        const { data, error } = await supabaseClient
            .from(TABLA)
            .update({ nombre, regalo, estado })
            .eq("id", editandoId)
            .select(COLUMNAS)
            .single();

        if (error) throw error;

        guardarLocal(data);
        renderizarTabla();
        actualizarEstadisticas();

        cerrarModal();
        mostrarToast("Registro actualizado", "success");

    } catch (error) {
        console.error("Error actualizando:", error);
        mostrarToast(describirError(error, "No se pudo actualizar"), "error");

    } finally {
        liberarBoton(el.botonGuardarEdicion);
    }
}


// ===============================
// ELIMINAR
// ===============================

async function eliminarInvitado(id) {

    const invitado = invitados.find((i) => String(i.id) === String(id));
    if (!invitado) return;

    if (!confirm(`¿Eliminar el registro de "${invitado.nombre}"?`)) return;

    try {
        const { data, error } = await supabaseClient
            .from(TABLA)
            .delete()
            .eq("id", invitado.id)
            .select("id");

        if (error) throw error;

        // Si no se borró nada, normalmente es una política (RLS) que lo impide.
        if (!data || data.length === 0) {
            throw new Error("Supabase no permitió borrar el registro (revisa las políticas RLS).");
        }

        quitarLocal(invitado.id);
        renderizarTabla();
        actualizarEstadisticas();

        mostrarToast("Registro eliminado", "success");

    } catch (error) {
        console.error("Error eliminando:", error);
        mostrarToast(describirError(error, "No se pudo eliminar"), "error");
    }
}

async function eliminarTodos() {

    if (invitados.length === 0) {
        mostrarToast("No hay registros para eliminar", "error");
        return;
    }

    const confirmar = confirm(
        "¿Seguro que quieres eliminar TODOS los registros? Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    try {
        const { data, error } = await supabaseClient
            .from(TABLA)
            .delete()
            .not("id", "is", null)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("Supabase no permitió borrar los registros (revisa las políticas RLS).");
        }

        invitados = [];
        renderizarTabla();
        actualizarEstadisticas();

        mostrarToast("Todos los registros fueron eliminados", "success");

    } catch (error) {
        console.error("Error eliminando todos:", error);
        mostrarToast(describirError(error, "No se pudieron eliminar los registros"), "error");
    }
}


// ===============================
// EXCEL
// ===============================

function exportarExcel() {

    if (typeof XLSX === "undefined") {
        mostrarToast("No se pudo cargar el módulo de Excel", "error");
        return;
    }

    if (invitados.length === 0) {
        mostrarToast("No hay registros para exportar", "error");
        return;
    }

    const datos = invitados.map((i, n) => ({
        "N.º": n + 1,
        "Nombre completo": i.nombre,
        "Obsequio": i.regalo,
        "Estado": i.estado,
        "Fecha": formatearFecha(i.created_at),
        "Hora": formatearHora(i.created_at)
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);

    hoja["!cols"] = [
        { wch: 6 }, { wch: 32 }, { wch: 32 },
        { wch: 14 }, { wch: 14 }, { wch: 10 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Invitados");
    XLSX.writeFile(libro, "registro-invitados.xlsx");

    mostrarToast("Excel descargado", "success");
}


// ===============================
// PDF
// ===============================

function exportarPDF() {

    if (!window.jspdf) {
        mostrarToast("No se pudo cargar el módulo PDF", "error");
        return;
    }

    if (invitados.length === 0) {
        mostrarToast("No hay registros para exportar", "error");
        return;
    }

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    pdf.setFont("times", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(30, 58, 52);
    pdf.text("Registro de Invitados", 14, 18);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100);

    const nuevos = invitados.filter((i) => i.estado === "Nuevo").length;
    const cancelados = invitados.filter((i) => i.estado === "Cancelado").length;

    pdf.text(
        `Total: ${invitados.length}   ·   Nuevos: ${nuevos}   ·   Cancelados: ${cancelados}`,
        14, 25
    );

    pdf.autoTable({
        startY: 31,
        head: [["N.º", "Invitado", "Obsequio", "Estado", "Fecha", "Hora"]],
        body: invitados.map((i, n) => [
            n + 1, i.nombre, i.regalo, i.estado,
            formatearFecha(i.created_at), formatearHora(i.created_at)
        ]),
        styles: { fontSize: 9, cellPadding: 3, textColor: [31, 41, 38] },
        headStyles: { fillColor: [30, 58, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 245, 241] },
        columnStyles: { 0: { cellWidth: 14 } }
    });

    pdf.save("registro-invitados.pdf");

    mostrarToast("PDF descargado", "success");
}


// ===============================
// FECHA Y HORA
// ===============================

function formatearFecha(valor) {
    const fecha = new Date(valor);
    if (!valor || Number.isNaN(fecha.getTime())) return "—";

    return fecha.toLocaleDateString("es-BO", {
        day: "2-digit", month: "2-digit", year: "numeric"
    });
}

function formatearHora(valor) {
    const fecha = new Date(valor);
    if (!valor || Number.isNaN(fecha.getTime())) return "—";

    return fecha.toLocaleTimeString("es-BO", {
        hour: "2-digit", minute: "2-digit", hour12: false
    });
}

function iniciarReloj() {

    const pintar = () => {
        const ahora = new Date();

        const fecha = ahora.toLocaleDateString("es-BO", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        });

        const hora = ahora.toLocaleTimeString("es-BO", {
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        });

        el.reloj.textContent = `${fecha} · ${hora}`;
    };

    pintar();
    setInterval(pintar, 1000);
}


// ===============================
// INDICADOR DE CONEXIÓN
// ===============================

function mostrarConexion(estado, texto) {

    el.conexion.classList.remove("ok", "error", "connecting");
    el.conexion.classList.add(estado);

    const textos = {
        ok: "Sincronizado en tiempo real",
        error: "Problema de conexión",
        connecting: "Conectando..."
    };

    el.conexionTexto.textContent = texto || textos[estado];
}


// ===============================
// AVISOS (TOAST)
// ===============================

let temporizadorToast = null;

function mostrarToast(mensaje, tipo = "success") {

    el.toast.classList.remove("success", "error", "show");

    // reinicia la animación si llega otro aviso seguido
    void el.toast.offsetWidth;

    el.toastIcono.textContent = tipo === "success" ? "✓" : "!";
    el.toastMensaje.textContent = mensaje;

    el.toast.classList.add(tipo, "show");

    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => el.toast.classList.remove("show"), 3500);
}


// ===============================
// UTILIDADES
// ===============================

function bloquearBoton(boton, texto) {
    boton.disabled = true;
    boton.dataset.original = boton.innerHTML;
    boton.textContent = texto;
}

function liberarBoton(boton) {
    boton.disabled = false;
    if (boton.dataset.original) boton.innerHTML = boton.dataset.original;
}

function describirError(error, mensajeBase) {

    const detalle = String(error?.message || "");

    if (/row-level security|rls|permission denied/i.test(detalle)) {
        return `${mensajeBase}: permisos de Supabase (RLS)`;
    }

    if (/failed to fetch|networkerror|load failed/i.test(detalle)) {
        return `${mensajeBase}: sin conexión con Supabase`;
    }

    if (/jwt|api key|apikey|invalid/i.test(detalle)) {
        return `${mensajeBase}: revisa la clave de Supabase`;
    }

    return mensajeBase;
}

function escaparHTML(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}