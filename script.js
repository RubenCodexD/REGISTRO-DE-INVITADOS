/* =====================================================
   REGISTRO DE INVITADOS
   BASE DE DATOS: INDEXEDDB
===================================================== */


// =====================================================
// CONFIGURACIÓN
// =====================================================

const DB_NAME = "RegistroInvitadosDB";

const DB_VERSION = 1;

const STORE_NAME = "invitados";

let db;

let registros = [];


// =====================================================
// ELEMENTOS
// =====================================================

const formulario =
    document.getElementById("registroForm");

const nombreInput =
    document.getElementById("nombre");

const regaloInput =
    document.getElementById("regalo");

const estadoInput =
    document.getElementById("estado");

const tablaBody =
    document.getElementById("tablaBody");

const emptyState =
    document.getElementById("emptyState");

const total =
    document.getElementById("total");

const totalNuevos =
    document.getElementById("totalNuevos");

const totalCancelados =
    document.getElementById("totalCancelados");

const buscar =
    document.getElementById("buscar");

const limpiarBusqueda =
    document.getElementById("limpiarBusqueda");

const actualizarBtn =
    document.getElementById("actualizarBtn");

const excelBtn =
    document.getElementById("excelBtn");

const pdfBtn =
    document.getElementById("pdfBtn");

const borrarTodoBtn =
    document.getElementById("borrarTodoBtn");

const fechaHoraActual =
    document.getElementById("fechaHoraActual");


// =====================================================
// MODAL
// =====================================================

const modal =
    document.getElementById("modal");

const cerrarModal =
    document.getElementById("cerrarModal");

const editarForm =
    document.getElementById("editarForm");

const editarId =
    document.getElementById("editarId");

const editarNombre =
    document.getElementById("editarNombre");

const editarRegalo =
    document.getElementById("editarRegalo");

const editarEstado =
    document.getElementById("editarEstado");


// =====================================================
// TOAST
// =====================================================

const toast =
    document.getElementById("toast");

const toastMessage =
    document.getElementById("toastMessage");

let toastTimer;


// =====================================================
// INICIAR
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    iniciar
);


async function iniciar() {

    await abrirBaseDatos();

    await cargarRegistros();

    actualizarReloj();

    setInterval(
        actualizarReloj,
        1000
    );

}


// =====================================================
// ABRIR INDEXEDDB
// =====================================================

function abrirBaseDatos() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            /*
             * Se ejecuta solamente
             * cuando la base de datos
             * se crea por primera vez.
             */

            request.onupgradeneeded =
                function(event) {

                    const database =
                        event.target.result;


                    if (
                        !database.objectStoreNames.contains(
                            STORE_NAME
                        )
                    ) {

                        const store =
                            database.createObjectStore(
                                STORE_NAME,
                                {
                                    keyPath: "id",
                                    autoIncrement: true
                                }
                            );


                        store.createIndex(
                            "nombre",
                            "nombre",
                            {
                                unique: false
                            }
                        );


                        store.createIndex(
                            "estado",
                            "estado",
                            {
                                unique: false
                            }
                        );

                    }

                };


            request.onsuccess =
                function(event) {

                    db =
                        event.target.result;

                    resolve(db);

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =====================================================
// CARGAR REGISTROS
// =====================================================

function cargarRegistros() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.getAll();


            request.onsuccess =
                function() {

                    registros =
                        request.result
                            .sort(
                                (a, b) =>
                                    a.id - b.id
                            );


                    actualizarInterfaz();

                    resolve(
                        registros
                    );

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =====================================================
// GUARDAR REGISTRO
// =====================================================

function guardarRegistro(registro) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.add(
                    registro
                );


            request.onsuccess =
                function(event) {

                    registro.id =
                        event.target.result;

                    resolve(
                        registro
                    );

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =====================================================
// ACTUALIZAR REGISTRO
// =====================================================

function actualizarRegistro(registro) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.put(
                    registro
                );


            request.onsuccess =
                function() {

                    resolve(
                        registro
                    );

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =====================================================
// ELIMINAR REGISTRO
// =====================================================

function eliminarDeDB(id) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.delete(id);


            request.onsuccess =
                function() {

                    resolve();

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =====================================================
// REGISTRAR INVITADO
// =====================================================

formulario.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const nombre =
            nombreInput.value.trim();


        const regalo =
            regaloInput.value.trim();


        const estado =
            estadoInput.value;


        if (!nombre) {

            mostrarMensaje(
                "Escribe el nombre completo."
            );

            nombreInput.focus();

            return;

        }


        if (!regalo) {

            mostrarMensaje(
                "Escribe el tipo de regalo."
            );

            regaloInput.focus();

            return;

        }


        try {

            const ahora =
                new Date();


            const registro = {

                nombre:
                    nombre,

                regalo:
                    regalo,

                estado:
                    estado,

                fecha:
                    formatearFecha(
                        ahora
                    ),

                hora:
                    formatearHora(
                        ahora
                    ),

                fechaISO:
                    ahora.toISOString()

            };


            /*
             * AQUÍ SE GUARDA EN LA BASE DE DATOS.
             *
             * No depende del Excel.
             * No depende de que la página
             * permanezca abierta.
             */

            await guardarRegistro(
                registro
            );


            await cargarRegistros();


            formulario.reset();


            estadoInput.value =
                "Nuevo";


            nombreInput.focus();


            mostrarMensaje(
                "✓ Invitado guardado correctamente."
            );


        } catch (error) {

            console.error(error);


            mostrarMensaje(
                "No se pudo guardar el registro."
            );

        }

    }
);


// =====================================================
// ACTUALIZAR INTERFAZ
// =====================================================

function actualizarInterfaz() {

    actualizarEstadisticas();

    mostrarTabla(
        registros
    );

}


// =====================================================
// ESTADÍSTICAS
// =====================================================

function actualizarEstadisticas() {

    const nuevos =
        registros.filter(
            registro =>
                registro.estado === "Nuevo"
        ).length;


    const cancelados =
        registros.filter(
            registro =>
                registro.estado === "Cancelado"
        ).length;


    total.textContent =
        registros.length;


    totalNuevos.textContent =
        nuevos;


    totalCancelados.textContent =
        cancelados;

}


// =====================================================
// MOSTRAR TABLA
// =====================================================

function mostrarTabla(lista) {

    tablaBody.innerHTML = "";


    if (lista.length === 0) {

        emptyState.style.display =
            "block";

        return;

    }


    emptyState.style.display =
        "none";


    lista.forEach(
        (registro, index) => {

            const fila =
                document.createElement(
                    "tr"
                );


            const claseEstado =
                registro.estado === "Nuevo"
                    ? "estado-nuevo"
                    : "estado-cancelado";


            fila.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        registro.nombre
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        registro.regalo
                    )}
                </td>

                <td>

                    <span
                        class="estado ${claseEstado}"
                    >

                        ${registro.estado}

                    </span>

                </td>

                <td>
                    ${registro.fecha}
                </td>

                <td>
                    ${registro.hora}
                </td>

                <td>

                    <div class="actions">

                        <button
                            class="btn-small btn-edit"
                            onclick="abrirEdicion(${registro.id})"
                        >
                            ✏️
                        </button>

                        <button
                            class="btn-small btn-delete"
                            onclick="eliminarRegistro(${registro.id})"
                        >
                            🗑️
                        </button>

                    </div>

                </td>

            `;


            tablaBody.appendChild(
                fila
            );

        }
    );

}


// =====================================================
// BÚSQUEDA
// =====================================================

buscar.addEventListener(
    "input",
    filtrarRegistros
);


function filtrarRegistros() {

    const texto =
        buscar.value
            .trim()
            .toLowerCase();


    if (!texto) {

        mostrarTabla(
            registros
        );

        return;

    }


    const filtrados =
        registros.filter(
            registro =>

                registro.nombre
                    .toLowerCase()
                    .includes(texto)

                ||

                registro.regalo
                    .toLowerCase()
                    .includes(texto)

                ||

                registro.estado
                    .toLowerCase()
                    .includes(texto)

        );


    mostrarTabla(
        filtrados
    );

}


// =====================================================
// LIMPIAR BÚSQUEDA
// =====================================================

limpiarBusqueda.addEventListener(
    "click",
    function() {

        buscar.value = "";

        mostrarTabla(
            registros
        );

        buscar.focus();

    }
);


// =====================================================
// EDITAR
// =====================================================

async function abrirEdicion(id) {

    const registro =
        registros.find(
            item =>
                item.id === id
        );


    if (!registro) {
        return;
    }


    editarId.value =
        registro.id;


    editarNombre.value =
        registro.nombre;


    editarRegalo.value =
        registro.regalo;


    editarEstado.value =
        registro.estado;


    modal.classList.add(
        "show"
    );

}


editarForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const id =
            Number(
                editarId.value
            );


        const registro =
            registros.find(
                item =>
                    item.id === id
            );


        if (!registro) {
            return;
        }


        registro.nombre =
            editarNombre.value.trim();


        registro.regalo =
            editarRegalo.value.trim();


        registro.estado =
            editarEstado.value;


        if (
            !registro.nombre ||
            !registro.regalo
        ) {

            mostrarMensaje(
                "Completa todos los campos."
            );

            return;

        }


        try {

            await actualizarRegistro(
                registro
            );


            await cargarRegistros();


            cerrarModal();


            mostrarMensaje(
                "✓ Registro actualizado."
            );


        } catch (error) {

            console.error(error);

            mostrarMensaje(
                "No se pudo actualizar."
            );

        }

    }
);


// =====================================================
// CERRAR MODAL
// =====================================================

cerrarModal.addEventListener(
    "click",
    cerrarModalEdicion
);


modal.addEventListener(
    "click",
    function(event) {

        if (
            event.target === modal
        ) {

            cerrarModalEdicion();

        }

    }
);


function cerrarModalEdicion() {

    modal.classList.remove(
        "show"
    );

}


// =====================================================
// ELIMINAR REGISTRO
// =====================================================

async function eliminarRegistro(id) {

    const registro =
        registros.find(
            item =>
                item.id === id
        );


    if (!registro) {
        return;
    }


    const confirmar =
        confirm(
            `¿Eliminar a ${registro.nombre}?`
        );


    if (!confirmar) {
        return;
    }


    try {

        await eliminarDeDB(
            id
        );


        await cargarRegistros();


        mostrarMensaje(
            "Registro eliminado."
        );


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            "No se pudo eliminar."
        );

    }

}


// =====================================================
// BORRAR TODO
// =====================================================

borrarTodoBtn.addEventListener(
    "click",
    async function() {

        if (
            registros.length === 0
        ) {

            mostrarMensaje(
                "No hay registros."
            );

            return;

        }


        const confirmar =
            confirm(
                "¿Seguro que deseas eliminar TODOS los registros? Esta acción no se puede deshacer."
            );


        if (!confirmar) {
            return;
        }


        try {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            store.clear();


            transaction.oncomplete =
                async function() {

                    registros = [];

                    await cargarRegistros();

                    mostrarMensaje(
                        "Todos los registros fueron eliminados."
                    );

                };


        } catch (error) {

            console.error(error);

            mostrarMensaje(
                "No se pudieron eliminar los registros."
            );

        }

    }
);


// =====================================================
// ACTUALIZAR
// =====================================================

actualizarBtn.addEventListener(
    "click",
    async function() {

        await cargarRegistros();

        mostrarMensaje(
            "Datos actualizados."
        );

    }
);


// =====================================================
// EXPORTAR EXCEL
// =====================================================

excelBtn.addEventListener(
    "click",
    exportarExcel
);


function exportarExcel() {

    if (
        registros.length === 0
    ) {

        mostrarMensaje(
            "No hay registros para exportar."
        );

        return;

    }


    const datos =
        registros.map(
            (registro, index) => ({

                "#":
                    index + 1,

                "Nombre completo":
                    registro.nombre,

                "Tipo de regalo":
                    registro.regalo,

                "Estado":
                    registro.estado,

                "Fecha":
                    registro.fecha,

                "Hora":
                    registro.hora

            })
        );


    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );


    hoja["!cols"] = [

        {
            wch: 7
        },

        {
            wch: 35
        },

        {
            wch: 35
        },

        {
            wch: 15
        },

        {
            wch: 15
        },

        {
            wch: 15
        }

    ];


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        hoja,
        "Invitados"
    );


    const fecha =
        new Date();


    const nombreArchivo =
        `registro_invitados_${
            fecha.getFullYear()
        }-${
            String(
                fecha.getMonth() + 1
            ).padStart(2, "0")
        }-${
            String(
                fecha.getDate()
            ).padStart(2, "0")
        }.xlsx`;


    XLSX.writeFile(
        workbook,
        nombreArchivo
    );


    mostrarMensaje(
        "✓ Excel exportado correctamente."
    );

}


// =====================================================
// EXPORTAR PDF
// =====================================================

pdfBtn.addEventListener(
    "click",
    exportarPDF
);


function exportarPDF() {

    if (
        registros.length === 0
    ) {

        mostrarMensaje(
            "No hay registros para exportar."
        );

        return;

    }


    const {
        jsPDF
    } = window.jspdf;


    const pdf =
        new jsPDF({

            orientation:
                "landscape",

            unit:
                "mm",

            format:
                "a4"

        });


    /*
     * TÍTULO
     */

    pdf.setFontSize(
        20
    );


    pdf.text(
        "Registro de Invitados",
        14,
        15
    );


    pdf.setFontSize(
        10
    );


    const nuevos =
        registros.filter(
            registro =>
                registro.estado === "Nuevo"
        ).length;


    const cancelados =
        registros.filter(
            registro =>
                registro.estado === "Cancelado"
        ).length;


    pdf.text(
        `Total: ${registros.length} | Nuevos: ${nuevos} | Cancelados: ${cancelados}`,
        14,
        23
    );


    /*
     * FILAS
     */

    const filas =
        registros.map(
            (registro, index) => [

                index + 1,

                registro.nombre,

                registro.regalo,

                registro.estado,

                registro.fecha,

                registro.hora

            ]
        );


    /*
     * TABLA
     */

    pdf.autoTable({

        startY:
            30,

        head: [[

            "#",

            "Nombre completo",

            "Tipo de regalo",

            "Estado",

            "Fecha",

            "Hora"

        ]],

        body:
            filas,

        styles: {

            fontSize:
                8,

            cellPadding:
                3

        },

        headStyles: {

            fontSize:
                8,

            fontStyle:
                "bold"

        },

        margin: {

            left:
                10,

            right:
                10

        }

    });


    /*
     * PIE
     */

    const ahora =
        new Date();


    pdf.setFontSize(
        8
    );


    pdf.text(

        `Reporte generado: ${
            formatearFecha(
                ahora
            )
        } ${
            formatearHora(
                ahora
            )
        }`,

        10,

        200

    );


    pdf.save(
        "registro_invitados_final.pdf"
    );


    mostrarMensaje(
        "✓ PDF generado correctamente."
    );

}


// =====================================================
// RELOJ
// =====================================================

function actualizarReloj() {

    const ahora =
        new Date();


    fechaHoraActual.textContent =
        `${formatearFecha(
            ahora
        )} ${
            formatearHora(
                ahora
            )}`;

}


// =====================================================
// FECHA
// =====================================================

function formatearFecha(
    fecha
) {

    const dia =
        String(
            fecha.getDate()
        ).padStart(
            2,
            "0"
        );


    const mes =
        String(
            fecha.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const anio =
        fecha.getFullYear();


    return `${dia}/${mes}/${anio}`;

}


// =====================================================
// HORA
// =====================================================

function formatearHora(
    fecha
) {

    const horas =
        String(
            fecha.getHours()
        ).padStart(
            2,
            "0"
        );


    const minutos =
        String(
            fecha.getMinutes()
        ).padStart(
            2,
            "0"
        );


    const segundos =
        String(
            fecha.getSeconds()
        ).padStart(
            2,
            "0"
        );


    return `${horas}:${minutos}:${segundos}`;

}


// =====================================================
// SEGURIDAD
// =====================================================

function escapeHTML(
    texto
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        texto;


    return div.innerHTML;

}


// =====================================================
// MENSAJES
// =====================================================

function mostrarMensaje(
    mensaje
) {

    toastMessage.textContent =
        mensaje;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            function() {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );

}
