
const SUPABASE_URL = "https://peanftztnyfwirikxgsv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_dHMDoQKSRW4LFNFhtZz_zg_qDe2yrvq";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let invitados = [];
let editandoId = null;
let canalRealtime = null;


// ===============================
// ELEMENTOS
// ===============================

const form = document.getElementById("formInvitado");
const nombreInput = document.getElementById("nombre");
const regaloInput = document.getElementById("regalo");
const estadoInput = document.getElementById("estado");
const tablaBody = document.getElementById("tablaInvitados");
const buscador = document.getElementById("buscador");

const modal = document.getElementById("modalEditar");
const editNombre = document.getElementById("editNombre");
const editRegalo = document.getElementById("editRegalo");
const editEstado = document.getElementById("editEstado");

const btnCancelarModal = document.getElementById("btnCancelarModal");
const btnGuardarEdicion = document.getElementById("btnGuardarEdicion");

const btnExportExcel = document.getElementById("btnExportExcel");
const btnExportPDF = document.getElementById("btnExportPDF");
const btnEliminarTodos = document.getElementById("btnEliminarTodos");

const totalElement = document.getElementById("totalInvitados");
const nuevosElement = document.getElementById("totalNuevos");
const canceladosElement = document.getElementById("totalCancelados");

const conexionElement = document.getElementById("estadoConexion");
const conexionTexto = document.getElementById("textoConexion");


// ===============================
// INICIO
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
    configurarEventos();

    // Solo aquí hacemos una descarga completa
    // para cargar el estado inicial.
    await cargarInvitadosInicial();

    // Después de esto, Realtime trabaja
    // únicamente con INSERT / UPDATE / DELETE.
    activarRealtime();
});


// ===============================
// EVENTOS
// ===============================

function configurarEventos() {

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await agregarInvitado();
    });

    buscador?.addEventListener("input", renderizarTabla);

    btnCancelarModal?.addEventListener("click", cerrarModal);

    btnGuardarEdicion?.addEventListener(
        "click",
        guardarEdicion
    );

    btnExportExcel?.addEventListener(
        "click",
        exportarExcel
    );

    btnExportPDF?.addEventListener(
        "click",
        exportarPDF
    );

    btnEliminarTodos?.addEventListener(
        "click",
        eliminarTodos
    );

    modal?.addEventListener("click", (event) => {

        if (event.target === modal) {
            cerrarModal();
        }

    });
}


// ===============================
// CARGA INICIAL
// ===============================

async function cargarInvitadosInicial() {

    mostrarConexion("conectando");

    const { data, error } =
        await supabaseClient
            .from("invitados")
            .select("*")
            .order("created_at", {
                ascending: true
            });

    if (error) {

        console.error(
            "Error cargando invitados:",
            error
        );

        invitados = [];

        mostrarConexion("error");

        mostrarToast(
            "No se pudieron cargar los registros",
            "error"
        );

        renderizarTabla();

        return;
    }

    invitados = data || [];

    mostrarConexion("ok");

    renderizarTabla();
    actualizarEstadisticas();
}


// ===============================
// REALTIME OPTIMIZADO
// ===============================
//
// IMPORTANTE:
//
// Antes:
//
// INSERT
//   ↓
// SELECT * FROM invitados
//   ↓
// Descargar toda la tabla
//
// Ahora:
//
// INSERT
//   ↓
// Recibir solamente NEW
//   ↓
// Agregar una fila localmente
//
// UPDATE
//   ↓
// Recibir NEW
//   ↓
// Reemplazar solamente esa fila
//
// DELETE
//   ↓
// Recibir OLD
//   ↓
// Eliminar solamente esa fila
// ===============================

function activarRealtime() {

    if (canalRealtime) {

        supabaseClient.removeChannel(
            canalRealtime
        );
    }

    canalRealtime =
        supabaseClient
            .channel("invitados-tiempo-real")

            // ==========================
            // NUEVO INVITADO
            // ==========================

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "invitados"
                },
                (payload) => {

                    console.log(
                        "Realtime INSERT:",
                        payload.new
                    );

                    const existe =
                        invitados.some(
                            item =>
                                item.id ===
                                payload.new.id
                        );

                    // Evitamos duplicar el registro.
                    if (!existe) {

                        invitados.push(
                            payload.new
                        );

                        ordenarInvitados();
                        renderizarTabla();
                        actualizarEstadisticas();
                    }

                    mostrarConexion("ok");
                }
            )

            // ==========================
            // INVITADO MODIFICADO
            // ==========================

            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "invitados"
                },
                (payload) => {

                    console.log(
                        "Realtime UPDATE:",
                        payload.new
                    );

                    const indice =
                        invitados.findIndex(
                            item =>
                                item.id ===
                                payload.new.id
                        );

                    if (indice !== -1) {

                        // Reemplazamos únicamente
                        // el registro modificado.
                        invitados[indice] =
                            payload.new;

                    } else {

                        // Si por alguna razón el
                        // registro no estaba cargado,
                        // lo incorporamos.
                        invitados.push(
                            payload.new
                        );
                    }

                    ordenarInvitados();
                    renderizarTabla();
                    actualizarEstadisticas();

                    mostrarConexion("ok");
                }
            )

            // ==========================
            // INVITADO ELIMINADO
            // ==========================

            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "invitados"
                },
                (payload) => {

                    console.log(
                        "Realtime DELETE:",
                        payload.old
                    );

                    invitados =
                        invitados.filter(
                            item =>
                                item.id !==
                                payload.old.id
                        );

                    renderizarTabla();
                    actualizarEstadisticas();

                    mostrarConexion("ok");
                }
            )

            .subscribe((status) => {

                console.log(
                    "Estado Realtime:",
                    status
                );

                if (status === "SUBSCRIBED") {

                    mostrarConexion("ok");

                    console.log(
                        "Realtime conectado correctamente"
                    );
                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT"
                ) {

                    mostrarConexion("error");

                    console.error(
                        "Error en conexión Realtime"
                    );
                }

                if (
                    status === "CLOSED"
                ) {

                    mostrarConexion("error");
                }
            });
}


// ===============================
// ORDENAR
// ===============================

function ordenarInvitados() {

    invitados.sort((a, b) => {

        const fechaA =
            new Date(a.created_at).getTime();

        const fechaB =
            new Date(b.created_at).getTime();

        return fechaA - fechaB;
    });
}


// ===============================
// AGREGAR
// ===============================

async function agregarInvitado() {

    const nombre =
        nombreInput.value.trim();

    const regalo =
        regaloInput.value.trim();

    const estado =
        estadoInput.value;

    if (!nombre) {

        mostrarToast(
            "Escribe el nombre completo",
            "error"
        );

        nombreInput.focus();

        return;
    }

    if (!regalo) {

        mostrarToast(
            "Escribe el tipo de regalo",
            "error"
        );

        regaloInput.focus();

        return;
    }

    const boton =
        form.querySelector(
            'button[type="submit"]'
        );

    if (boton) {

        boton.disabled = true;

        boton.dataset.textoOriginal =
            boton.innerHTML;

        boton.innerHTML =
            "Guardando...";
    }

    const { data, error } =
        await supabaseClient
            .from("invitados")
            .insert([
                {
                    nombre,
                    regalo,
                    estado
                }
            ])
            .select()
            .single();

    if (error) {

        console.error(
            "Error agregando invitado:",
            error
        );

        mostrarToast(
            "No se pudo guardar el registro",
            "error"
        );

    } else {

        mostrarToast(
            "Invitado registrado correctamente",
            "success"
        );

        form.reset();

        estadoInput.value = "Nuevo";

        /*
         * NO agregamos manualmente el registro
         * a "invitados" aquí.
         *
         * Realtime recibirá el INSERT y lo
         * incorporará automáticamente.
         *
         * Esto evita duplicados.
         */
    }

    if (boton) {

        boton.disabled = false;

        boton.innerHTML =
            boton.dataset.textoOriginal ||
            "Registrar invitado";
    }
}


// ===============================
// TABLA
// ===============================

function renderizarTabla() {

    if (!tablaBody) return;

    const busqueda =
        (buscador?.value || "")
            .toLowerCase()
            .trim();

    const filtrados =
        invitados.filter((invitado) => {

            const nombre =
                String(
                    invitado.nombre || ""
                ).toLowerCase();

            const regalo =
                String(
                    invitado.regalo || ""
                ).toLowerCase();

            const estado =
                String(
                    invitado.estado || ""
                ).toLowerCase();

            return (
                nombre.includes(busqueda) ||
                regalo.includes(busqueda) ||
                estado.includes(busqueda)
            );
        });

    if (filtrados.length === 0) {

        tablaBody.innerHTML = `
            <tr>
                <td colspan="6" class="tabla-vacia">
                    <div class="empty-state">
                        <div class="empty-icon">
                            📋
                        </div>

                        <strong>
                            No hay registros
                        </strong>

                        <span>
                            Los invitados aparecerán aquí.
                        </span>
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    tablaBody.innerHTML =
        filtrados
            .map((invitado, index) => {

                const fecha =
                    formatearFecha(
                        invitado.created_at
                    );

                const estado =
                    invitado.estado ||
                    "Nuevo";

                const claseEstado =
                    estado === "Cancelado"
                        ? "cancelado"
                        : "nuevo";

                return `
                    <tr
                        class="fila-aparece"
                        style="animation-delay:${index * 0.03}s"
                    >

                        <td>
                            <strong>
                                ${escaparHTML(
                                    invitado.nombre
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escaparHTML(
                                invitado.regalo
                            )}
                        </td>

                        <td>
                            ${fecha}
                        </td>

                        <td>
                            <span
                                class="badge-estado ${claseEstado}"
                            >
                                ${escaparHTML(
                                    estado
                                )}
                            </span>
                        </td>

                        <td>
                            <div class="acciones-tabla">

                                <button
                                    class="btn-icon editar"
                                    title="Editar"
                                    onclick="abrirEdicion(${invitado.id})"
                                >
                                    ✏️
                                </button>

                                <button
                                    class="btn-icon eliminar"
                                    title="Eliminar"
                                    onclick="eliminarInvitado(${invitado.id})"
                                >
                                    🗑️
                                </button>

                            </div>
                        </td>

                    </tr>
                `;
            })
            .join("");
}


// ===============================
// ESTADÍSTICAS
// ===============================

function actualizarEstadisticas() {

    const total =
        invitados.length;

    const nuevos =
        invitados.filter(
            item =>
                item.estado === "Nuevo"
        ).length;

    const cancelados =
        invitados.filter(
            item =>
                item.estado === "Cancelado"
        ).length;

    if (totalElement) {
        totalElement.textContent =
            total;
    }

    if (nuevosElement) {
        nuevosElement.textContent =
            nuevos;
    }

    if (canceladosElement) {
        canceladosElement.textContent =
            cancelados;
    }
}


// ===============================
// EDITAR
// ===============================

function abrirEdicion(id) {

    const invitado =
        invitados.find(
            item =>
                item.id === id
        );

    if (!invitado) return;

    editandoId = id;

    editNombre.value =
        invitado.nombre || "";

    editRegalo.value =
        invitado.regalo || "";

    editEstado.value =
        invitado.estado || "Nuevo";

    modal.classList.add(
        "mostrar"
    );

    document.body.classList.add(
        "modal-abierto"
    );
}


function cerrarModal() {

    modal.classList.remove(
        "mostrar"
    );

    document.body.classList.remove(
        "modal-abierto"
    );

    editandoId = null;
}


async function guardarEdicion() {

    if (!editandoId) return;

    const nombre =
        editNombre.value.trim();

    const regalo =
        editRegalo.value.trim();

    const estado =
        editEstado.value;

    if (!nombre || !regalo) {

        mostrarToast(
            "Completa todos los campos",
            "error"
        );

        return;
    }

    const { error } =
        await supabaseClient
            .from("invitados")
            .update({
                nombre,
                regalo,
                estado
            })
            .eq(
                "id",
                editandoId
            );

    if (error) {

        console.error(
            "Error actualizando:",
            error
        );

        mostrarToast(
            "No se pudo actualizar",
            "error"
        );

        return;
    }

    mostrarToast(
        "Registro actualizado",
        "success"
    );

    cerrarModal();

    /*
     * NO hacemos cargarInvitadosInicial().
     *
     * Realtime recibirá el UPDATE y modificará
     * únicamente la fila correspondiente.
     */
}


// ===============================
// ELIMINAR
// ===============================

async function eliminarInvitado(id) {

    const invitado =
        invitados.find(
            item =>
                item.id === id
        );

    if (!invitado) return;

    const confirmar =
        confirm(
            `¿Eliminar el registro de "${invitado.nombre}"?`
        );

    if (!confirmar) return;

    const { error } =
        await supabaseClient
            .from("invitados")
            .delete()
            .eq("id", id);

    if (error) {

        console.error(
            "Error eliminando:",
            error
        );

        mostrarToast(
            "No se pudo eliminar",
            "error"
        );

        return;
    }

    mostrarToast(
        "Registro eliminado",
        "success"
    );

    /*
     * Realtime recibirá DELETE y eliminará
     * solamente esa fila del arreglo local.
     */
}


async function eliminarTodos() {

    if (invitados.length === 0) {

        mostrarToast(
            "No hay registros para eliminar",
            "error"
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Seguro que quieres eliminar TODOS los registros? Esta acción no se puede deshacer."
        );

    if (!confirmar) return;

    const { error } =
        await supabaseClient
            .from("invitados")
            .delete()
            .not(
                "id",
                "is",
                null
            );

    if (error) {

        console.error(
            "Error eliminando todos:",
            error
        );

        mostrarToast(
            "No se pudieron eliminar los registros",
            "error"
        );

        return;
    }

    mostrarToast(
        "Todos los registros fueron eliminados",
        "success"
    );

    /*
     * Cada DELETE llegará por Realtime.
     *
     * Si hay muchos registros, esto genera
     * eventos individuales, pero no descarga
     * nuevamente toda la tabla.
     */
}


// ===============================
// EXCEL
// ===============================

function exportarExcel() {

    if (typeof XLSX === "undefined") {

        mostrarToast(
            "No se pudo cargar el módulo de Excel",
            "error"
        );

        return;
    }

    if (invitados.length === 0) {

        mostrarToast(
            "No hay registros para exportar",
            "error"
        );

        return;
    }

    const datos =
        invitados.map(
            (invitado, index) => ({

                "#":
                    index + 1,

                "Nombre completo":
                    invitado.nombre,

                "Regalo":
                    invitado.regalo,

                "Fecha y hora":
                    formatearFecha(
                        invitado.created_at
                    ),

                "Estado":
                    invitado.estado
            })
        );

    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );

    hoja["!cols"] = [
        { wch: 6 },
        { wch: 30 },
        { wch: 35 },
        { wch: 24 },
        { wch: 15 }
    ];

    const libro =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Invitados"
    );

    XLSX.writeFile(
        libro,
        "registro-invitados.xlsx"
    );

    mostrarToast(
        "Excel descargado",
        "success"
    );
}


// ===============================
// PDF
// ===============================

function exportarPDF() {

    if (!window.jspdf) {

        mostrarToast(
            "No se pudo cargar el módulo PDF",
            "error"
        );

        return;
    }

    if (invitados.length === 0) {

        mostrarToast(
            "No hay registros para exportar",
            "error"
        );

        return;
    }

    const { jsPDF } =
        window.jspdf;

    const pdf =
        new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

    pdf.setFontSize(20);

    pdf.text(
        "Registro de Invitados",
        14,
        18
    );

    pdf.setFontSize(10);

    pdf.text(
        `Total: ${invitados.length}`,
        14,
        26
    );

    const filas =
        invitados.map(
            (invitado, index) => [

                index + 1,

                invitado.nombre,

                invitado.regalo,

                formatearFecha(
                    invitado.created_at
                ),

                invitado.estado
            ]
        );

    pdf.autoTable({

        startY: 32,

        head: [[
            "#",
            "Nombre",
            "Regalo",
            "Fecha y hora",
            "Estado"
        ]],

        body: filas,

        styles: {
            fontSize: 9,
            cellPadding: 3
        },

        headStyles: {
            fontStyle: "bold"
        }
    });

    pdf.save(
        "registro-invitados.pdf"
    );

    mostrarToast(
        "PDF descargado",
        "success"
    );
}


// ===============================
// FECHA
// ===============================

function formatearFecha(fecha) {

    if (!fecha) {
        return "—";
    }

    const date =
        new Date(fecha);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "es-ES",
        {
            dateStyle: "short",
            timeStyle: "medium"
        }
    ).format(date);
}


// ===============================
// CONEXIÓN
// ===============================

function mostrarConexion(estado) {

    if (!conexionElement) return;

    conexionElement.classList.remove(
        "conectando",
        "error",
        "ok"
    );

    if (estado === "ok") {

        conexionElement.classList.add(
            "ok"
        );

        if (conexionTexto) {

            conexionTexto.textContent =
                "Sincronizado en tiempo real";
        }

        return;
    }

    if (estado === "error") {

        conexionElement.classList.add(
            "error"
        );

        if (conexionTexto) {

            conexionTexto.textContent =
                "Problema de conexión";
        }

        return;
    }

    conexionElement.classList.add(
        "conectando"
    );

    if (conexionTexto) {

        conexionTexto.textContent =
            "Conectando...";
    }
}


// ===============================
// TOAST
// ===============================

function mostrarToast(
    mensaje,
    tipo = "success"
) {

    let contenedor =
        document.getElementById(
            "contenedorToast"
        );

    if (!contenedor) {

        contenedor =
            document.createElement(
                "div"
            );

        contenedor.id =
            "contenedorToast";

        document.body.appendChild(
            contenedor
        );
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast toast-${tipo}`;

    toast.innerHTML = `
        <span class="toast-icon">
            ${tipo === "success" ? "✓" : "!"}
        </span>

        <span>
            ${escaparHTML(mensaje)}
        </span>
    `;

    contenedor.appendChild(
        toast
    );

    setTimeout(() => {

        toast.classList.add(
            "toast-saliendo"
        );

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 2800);
}


// ===============================
// SEGURIDAD HTML
// ===============================

function escaparHTML(valor) {

    return String(valor ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ===============================
// FUNCIONES GLOBALES
// ===============================

window.abrirEdicion =
    abrirEdicion;

window.eliminarInvitado =
    eliminarInvitado;
