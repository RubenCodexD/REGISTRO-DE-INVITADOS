/* =========================================================
   CONFIGURACIÓN SUPABASE
========================================================= */

const SUPABASE_URL = "https://peanftztnyfwirikxgsv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_dHMDoQKSRW4LFNFhtZz_zg_qDe2yrvq";


/* =========================================================
   CLIENTE SUPABASE
========================================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   VARIABLES
========================================================= */

let invitados = [];

let editandoId = null;

let toastTimer = null;


/* =========================================================
   ELEMENTOS
========================================================= */

const guestForm = document.getElementById("guestForm");

const nombreInput = document.getElementById("nombre");
const regaloInput = document.getElementById("regalo");
const estadoInput = document.getElementById("estado");

const guestTableBody = document.getElementById("guestTableBody");

const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const searchCount = document.getElementById("searchCount");

const totalCount = document.getElementById("totalCount");
const newCount = document.getElementById("newCount");
const cancelCount = document.getElementById("cancelCount");

const liveDateTime = document.getElementById("liveDateTime");

const connectionStatus =
    document.getElementById("connectionStatus");

const connectionText =
    document.getElementById("connectionText");

const saveButton =
    document.getElementById("saveButton");


/* MODAL */

const editModal =
    document.getElementById("editModal");

const editForm =
    document.getElementById("editForm");

const editId =
    document.getElementById("editId");

const editNombre =
    document.getElementById("editNombre");

const editRegalo =
    document.getElementById("editRegalo");

const editEstado =
    document.getElementById("editEstado");

const closeModal =
    document.getElementById("closeModal");

const cancelEdit =
    document.getElementById("cancelEdit");


/* TOAST */

const toast =
    document.getElementById("toast");

const toastMessage =
    document.getElementById("toastMessage");

const toastIcon =
    document.getElementById("toastIcon");


/* =========================================================
   INICIO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    actualizarReloj();

    setInterval(actualizarReloj, 1000);

    configurarEventos();

    await cargarInvitados();

    iniciarRealtime();

});


/* =========================================================
   RELOJ
========================================================= */

function actualizarReloj() {

    const ahora = new Date();

    const fecha = ahora.toLocaleDateString(
        "es-ES",
        {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

    const hora = ahora.toLocaleTimeString(
        "es-ES",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

    liveDateTime.textContent =
        `${capitalizar(fecha)} · ${hora}`;
}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {

    guestForm.addEventListener(
        "submit",
        registrarInvitado
    );

    editForm.addEventListener(
        "submit",
        guardarEdicion
    );

    searchInput.addEventListener(
        "input",
        renderizarTabla
    );

    closeModal.addEventListener(
        "click",
        cerrarModal
    );

    cancelEdit.addEventListener(
        "click",
        cerrarModal
    );

    editModal.addEventListener(
        "click",
        (event) => {

            if (event.target === editModal) {
                cerrarModal();
            }

        }
    );

    document
        .getElementById("exportExcel")
        .addEventListener(
            "click",
            exportarExcel
        );

    document
        .getElementById("exportPDF")
        .addEventListener(
            "click",
            exportarPDF
        );

    document
        .getElementById("deleteAll")
        .addEventListener(
            "click",
            eliminarTodos
        );

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                editModal.classList.contains("active")
            ) {
                cerrarModal();
            }

        }
    );
}


/* =========================================================
   CARGAR INVITADOS
========================================================= */

async function cargarInvitados() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("invitados")
            .select("*")
            .order("created_at", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        invitados = data || [];

        actualizarInterfaz();

        establecerConexion(true);

    } catch (error) {

        console.error(
            "Error cargando invitados:",
            error
        );

        establecerConexion(false);

        mostrarToast(
            "No se pudieron cargar los registros",
            "error"
        );
    }
}


/* =========================================================
   REALTIME
========================================================= */

function iniciarRealtime() {

    supabaseClient
        .channel("invitados-tiempo-real")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "invitados"
            },
            async () => {

                await cargarInvitados();

                mostrarToast(
                    "Registros sincronizados",
                    "success"
                );
            }
        )

        .subscribe((status) => {

            console.log(
                "Realtime:",
                status
            );

            if (status === "SUBSCRIBED") {

                establecerConexion(true);

            } else if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {

                establecerConexion(false);
            }
        });
}


/* =========================================================
   REGISTRAR
========================================================= */

async function registrarInvitado(event) {

    event.preventDefault();

    const nombre =
        nombreInput.value.trim();

    const regalo =
        regaloInput.value.trim();

    const estado =
        estadoInput.value;


    if (!nombre || !regalo) {

        mostrarToast(
            "Completa todos los campos",
            "error"
        );

        return;
    }


    cambiarEstadoBoton(
        true,
        "Guardando..."
    );


    try {

        const {
            error
        } = await supabaseClient
            .from("invitados")
            .insert([
                {
                    nombre,
                    regalo,
                    estado
                }
            ]);


        if (error) {
            throw error;
        }


        guestForm.reset();

        estadoInput.value = "Nuevo";

        mostrarToast(
            "Invitado registrado correctamente",
            "success"
        );


        await cargarInvitados();


    } catch (error) {

        console.error(
            "Error registrando:",
            error
        );

        mostrarToast(
            "No se pudo guardar el invitado",
            "error"
        );

    } finally {

        cambiarEstadoBoton(
            false,
            "Registrar invitado"
        );
    }
}


/* =========================================================
   EDITAR
========================================================= */

function abrirEditar(id) {

    const invitado =
        invitados.find(
            item => Number(item.id) === Number(id)
        );


    if (!invitado) {
        return;
    }


    editandoId = invitado.id;

    editId.value =
        invitado.id;

    editNombre.value =
        invitado.nombre;

    editRegalo.value =
        invitado.regalo;

    editEstado.value =
        invitado.estado;


    editModal.classList.add(
        "active"
    );


    setTimeout(() => {
        editNombre.focus();
    }, 200);
}


async function guardarEdicion(event) {

    event.preventDefault();

    if (!editandoId) {
        return;
    }


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


    try {

        const {
            error
        } = await supabaseClient
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
            throw error;
        }


        cerrarModal();

        mostrarToast(
            "Registro actualizado",
            "success"
        );


        await cargarInvitados();


    } catch (error) {

        console.error(
            "Error actualizando:",
            error
        );

        mostrarToast(
            "No se pudo actualizar",
            "error"
        );
    }
}


/* =========================================================
   ELIMINAR
========================================================= */

async function eliminarInvitado(id) {

    const invitado =
        invitados.find(
            item => Number(item.id) === Number(id)
        );


    if (!invitado) {
        return;
    }


    const confirmar =
        confirm(
            `¿Eliminar a "${invitado.nombre}"?`
        );


    if (!confirmar) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("invitados")
            .delete()
            .eq(
                "id",
                id
            );


        if (error) {
            throw error;
        }


        mostrarToast(
            "Registro eliminado",
            "success"
        );


        await cargarInvitados();


    } catch (error) {

        console.error(
            "Error eliminando:",
            error
        );

        mostrarToast(
            "No se pudo eliminar",
            "error"
        );
    }
}


/* =========================================================
   ELIMINAR TODO
========================================================= */

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
            "¿Seguro que quieres eliminar TODOS los registros?\n\nEsta acción no se puede deshacer."
        );


    if (!confirmar) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("invitados")
            .delete()
            .not(
                "id",
                "is",
                null
            );


        if (error) {
            throw error;
        }


        mostrarToast(
            "Todos los registros fueron eliminados",
            "success"
        );


        await cargarInvitados();


    } catch (error) {

        console.error(
            "Error eliminando todos:",
            error
        );

        mostrarToast(
            "No se pudieron eliminar los registros",
            "error"
        );
    }
}


/* =========================================================
   RENDER
========================================================= */

function actualizarInterfaz() {

    actualizarEstadisticas();

    renderizarTabla();
}


function actualizarEstadisticas() {

    const total =
        invitados.length;

    const nuevos =
        invitados.filter(
            item => item.estado === "Nuevo"
        ).length;

    const cancelados =
        invitados.filter(
            item => item.estado === "Cancelado"
        ).length;


    animarNumero(
        totalCount,
        total
    );

    animarNumero(
        newCount,
        nuevos
    );

    animarNumero(
        cancelCount,
        cancelados
    );
}


function renderizarTabla() {

    const texto =
        searchInput.value
            .trim()
            .toLowerCase();


    const filtrados =
        invitados.filter(item => {

            if (!texto) {
                return true;
            }

            return (
                String(item.nombre || "")
                    .toLowerCase()
                    .includes(texto)
                ||
                String(item.regalo || "")
                    .toLowerCase()
                    .includes(texto)
                ||
                String(item.estado || "")
                    .toLowerCase()
                    .includes(texto)
            );
        });


    guestTableBody.innerHTML = "";


    searchCount.textContent =
        texto
            ? `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}`
            : `${invitados.length} registro${invitados.length !== 1 ? "s" : ""}`;


    if (filtrados.length === 0) {

        emptyState.classList.add(
            "visible"
        );

        return;
    }


    emptyState.classList.remove(
        "visible"
    );


    filtrados.forEach(
        (invitado, index) => {

            const tr =
                document.createElement("tr");


            const fecha =
                formatearFecha(
                    invitado.created_at
                );

            const hora =
                formatearHora(
                    invitado.created_at
                );


            const estadoClase =
                invitado.estado === "Nuevo"
                    ? "new"
                    : "cancelled";


            tr.innerHTML = `
                <td class="number-cell">
                    ${index + 1}
                </td>

                <td class="name-cell">
                    ${escaparHTML(invitado.nombre)}
                </td>

                <td class="gift-cell">
                    ${escaparHTML(invitado.regalo)}
                </td>

                <td>
                    <span class="status-badge ${estadoClase}">
                        ${escaparHTML(invitado.estado)}
                    </span>
                </td>

                <td>
                    ${fecha}
                </td>

                <td>
                    ${hora}
                </td>

                <td>
                    <div class="actions">

                        <button
                            class="action-btn edit-btn"
                            title="Editar"
                            onclick="abrirEditar(${invitado.id})"
                        >
                            ✎
                        </button>

                        <button
                            class="action-btn delete-btn"
                            title="Eliminar"
                            onclick="eliminarInvitado(${invitado.id})"
                        >
                            ×
                        </button>

                    </div>
                </td>
            `;


            guestTableBody.appendChild(
                tr
            );
        }
    );
}


/* =========================================================
   FECHAS
========================================================= */

function formatearFecha(fechaISO) {

    if (!fechaISO) {
        return "-";
    }

    const fecha =
        new Date(fechaISO);


    return fecha.toLocaleDateString(
        "es-ES",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


function formatearHora(fechaISO) {

    if (!fechaISO) {
        return "-";
    }

    const fecha =
        new Date(fechaISO);


    return fecha.toLocaleTimeString(
        "es-ES",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );
}


/* =========================================================
   EXPORTAR EXCEL
========================================================= */

function exportarExcel() {

    if (invitados.length === 0) {

        mostrarToast(
            "No hay registros para exportar",
            "error"
        );

        return;
    }


    const datos =
        invitados.map(
            (item, index) => {

                return {
                    "#": index + 1,

                    "Nombre completo":
                        item.nombre,

                    "Tipo de regalo":
                        item.regalo,

                    "Estado":
                        item.estado,

                    "Fecha":
                        formatearFecha(
                            item.created_at
                        ),

                    "Hora":
                        formatearHora(
                            item.created_at
                        )
                };
            }
        );


    const worksheet =
        XLSX.utils.json_to_sheet(
            datos
        );


    worksheet["!cols"] = [
        { wch: 7 },
        { wch: 30 },
        { wch: 30 },
        { wch: 16 },
        { wch: 15 },
        { wch: 15 }
    ];


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Invitados"
    );


    const fecha =
        new Date()
            .toISOString()
            .slice(0, 10);


    XLSX.writeFile(
        workbook,
        `registro-invitados-${fecha}.xlsx`
    );


    mostrarToast(
        "Excel generado correctamente",
        "success"
    );
}


/* =========================================================
   EXPORTAR PDF
========================================================= */

function exportarPDF() {

    if (invitados.length === 0) {

        mostrarToast(
            "No hay registros para exportar",
            "error"
        );

        return;
    }


    const {
        jsPDF
    } = window.jspdf;


    const doc =
        new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });


    const fechaActual =
        new Date().toLocaleDateString(
            "es-ES"
        );


    doc.setFontSize(20);

    doc.text(
        "Registro de Invitados",
        14,
        17
    );


    doc.setFontSize(9);

    doc.setTextColor(
        100,
        116,
        139
    );

    doc.text(
        `Generado el ${fechaActual}`,
        14,
        24
    );


    const filas =
        invitados.map(
            (item, index) => {

                return [
                    index + 1,

                    item.nombre,

                    item.regalo,

                    item.estado,

                    formatearFecha(
                        item.created_at
                    ),

                    formatearHora(
                        item.created_at
                    )
                ];
            }
        );


    doc.autoTable({
        startY: 31,

        head: [
            [
                "#",
                "Nombre completo",
                "Tipo de regalo",
                "Estado",
                "Fecha",
                "Hora"
            ]
        ],

        body: filas,

        theme: "grid",

        styles: {
            fontSize: 9,
            cellPadding: 4
        },

        headStyles: {
            fontSize: 9,
            fontStyle: "bold"
        },

        alternateRowStyles: {
            fillColor: [
                248,
                250,
                252
            ]
        }
    });


    const fecha =
        new Date()
            .toISOString()
            .slice(0, 10);


    doc.save(
        `registro-invitados-${fecha}.pdf`
    );


    mostrarToast(
        "PDF generado correctamente",
        "success"
    );
}


/* =========================================================
   MODAL
========================================================= */

function cerrarModal() {

    editModal.classList.remove(
        "active"
    );

    editandoId = null;

    editForm.reset();
}


/* =========================================================
   CONEXIÓN
========================================================= */

function establecerConexion(conectado) {

    if (conectado) {

        connectionStatus.classList.add(
            "connected"
        );

        connectionStatus.classList.remove(
            "error"
        );

        connectionText.textContent =
            "Sincronizado en tiempo real";

    } else {

        connectionStatus.classList.remove(
            "connected"
        );

        connectionStatus.classList.add(
            "error"
        );

        connectionText.textContent =
            "Problema de conexión";
    }
}


/* =========================================================
   TOAST
========================================================= */

function mostrarToast(
    mensaje,
    tipo = "success"
) {

    clearTimeout(
        toastTimer
    );


    toastMessage.textContent =
        mensaje;


    if (tipo === "error") {

        toast.classList.add(
            "error"
        );

        toastIcon.textContent =
            "×";

    } else {

        toast.classList.remove(
            "error"
        );

        toastIcon.textContent =
            "✓";
    }


    toast.classList.add(
        "show"
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );
}


/* =========================================================
   BOTÓN
========================================================= */

function cambiarEstadoBoton(
    cargando,
    texto
) {

    saveButton.disabled =
        cargando;


    if (cargando) {

        saveButton.innerHTML =
            `
                <span>⏳</span>
                <span>${texto}</span>
            `;

    } else {

        saveButton.innerHTML =
            `
                <span class="button-icon">＋</span>
                <span>${texto}</span>
            `;
    }
}


/* =========================================================
   ANIMACIÓN NÚMEROS
========================================================= */

function animarNumero(
    elemento,
    destino
) {

    const inicio =
        Number(elemento.textContent) || 0;

    const duracion =
        350;

    const inicioTiempo =
        performance.now();


    function actualizar(tiempo) {

        const progreso =
            Math.min(
                (tiempo - inicioTiempo) /
                duracion,
                1
            );


        const valor =
            Math.round(
                inicio +
                (destino - inicio) *
                progreso
            );


        elemento.textContent =
            valor;


        if (progreso < 1) {

            requestAnimationFrame(
                actualizar
            );
        }
    }


    requestAnimationFrame(
        actualizar
    );
}


/* =========================================================
   SEGURIDAD HTML
========================================================= */

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


/* =========================================================
   MAYÚSCULA
========================================================= */

function capitalizar(texto) {

    if (!texto) {
        return "";
    }

    return texto.charAt(0).toUpperCase() +
        texto.slice(1);
}


/* =========================================================
   EXPONER FUNCIONES A HTML
========================================================= */

window.abrirEditar =
    abrirEditar;

window.eliminarInvitado =
    eliminarInvitado;
