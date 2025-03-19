// Configuración Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDeKQem2eTfa0vb36-lLpkRqQYnmNSYxko",
    authDomain: "pagos-app-45454.firebaseapp.com",
    projectId: "pagos-app-45454",
    storageBucket: "pagos-app-45454.appspot.com",
    messagingSenderId: "1067886655605",
    appId: "1:1067886655605:web:e3133ca998d7e7b3a4a03c"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ===== CONSTANTES Y UTILIDADES =====
const MESES_ABREVIADOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                          'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const generarMesesAnio = () => {
    const añoActual = new Date().getFullYear();
    return Array.from({length: 12}, (_, i) => {
        const mes = (i + 1).toString().padStart(2, '0');
        return `${añoActual}-${mes}`;
    });
};

const formatearMes = (mesKey) => {
    const [año, mes] = mesKey.split('-');
    return `${MESES_ABREVIADOS[parseInt(mes)-1]} ${año}`;
};

// ===== AUTENTICACIÓN =====
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => window.location.href = 'index.html')
        .catch(error => alert(`Error: ${error.message}`));
}

function logout() {
    auth.signOut().then(() => window.location.href = 'login.html');
}

auth.onAuthStateChanged(user => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (!user && !isLoginPage) window.location.href = 'login.html';
    if (user && isLoginPage) window.location.href = 'index.html';
});

// ===== GESTIÓN DE ALUMNOS =====
function agregarAlumno() {
    const nombreInput = document.getElementById('nombreAlumno');
    const nombre = nombreInput.value.trim();
    
    if (!nombre) return alert('Ingrese un nombre válido');
    
    db.collection('alumnos').add({
        nombre: nombre,
        meses: {}
    }).then(() => nombreInput.value = '')
      .catch(error => alert(`Error: ${error.message}`));
}

async function togglePago(id, mes) {
    const alumnoRef = db.collection('alumnos').doc(id);
    const doc = await alumnoRef.get();
    const estadoActual = doc.data().meses?.[mes];
    
    // Ciclo de estados: undefined → true → false → undefined
    let nuevoEstado;
    if (estadoActual === undefined) {
        nuevoEstado = true;
    } else if (estadoActual === true) {
        nuevoEstado = false;
    } else {
        nuevoEstado = firebase.firestore.FieldValue.delete();
    }
    
    await alumnoRef.update({
        [`meses.${mes}`]: nuevoEstado
    });
}

function eliminarAlumno(id) {
    if (confirm('¿Eliminar este alumno permanentemente?')) {
        db.collection('alumnos').doc(id).delete()
            .catch(error => alert(`Error: ${error.message}`));
    }
}

// ===== INTERFAZ =====
function cargarAlumnos() {
    db.collection('alumnos').onSnapshot(snapshot => {
        const lista = document.getElementById('listaAlumnos');
        lista.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const mesesRegistrados = data.meses || {};
            const todosMeses = generarMesesAnio().map(mes => ({
                key: mes,
                estado: mesesRegistrados[mes]
            }));

            return `
                <div class="list-group-item mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="mb-0 text-primary">${data.nombre}</h5>
                        <div>
                            <button class="btn btn-danger btn-sm" 
                                    onclick="eliminarAlumno('${doc.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="contenedor-meses">
                        ${todosMeses.map(({key, estado}) => {
                            const esPagado = estado === true;
                            const esPendiente = estado === false;
                            const clase = esPagado ? 'pagado' : esPendiente ? 'pendiente' : '';
                            const icono = esPagado ? '✓' : esPendiente ? '✗' : '●';
                            
                            return `
                                <button class="btn-mes ${clase}"
                                        onclick="togglePago('${doc.id}', '${key}')"
                                        title="${formatearMes(key)} - ${data.nombre}">
                                    <span class="mes-abreviado">${formatearMes(key).split(' ')[0]}</span>
                                    <span class="estado-icono">${icono}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    });
}
function cargarAlumnosParaComprobante() {
    db.collection("alumnos").onSnapshot(snapshot => {
        const select = document.getElementById("selectAlumno");
        select.innerHTML = snapshot.docs.map(doc => 
            `<option value="${doc.id}">${doc.data().nombre}</option>`
        ).join('');
        
        // Cargar meses
        const selectMes = document.getElementById("selectMes");
        selectMes.innerHTML = generarMesesAnio().map(mes => 
            `<option value="${mes}">${formatearMes(mes)}</option>`
        ).join('');
    });
}

window.generarComprobante = async () => {
    const alumnoId = document.getElementById("selectAlumno").value;
    const mes = document.getElementById("selectMes").value;
    const estado = document.getElementById("selectEstado").value;
    
    if(!alumnoId || !mes) return alert("Seleccione todos los campos");
    
    const alumnoDoc = await db.collection("alumnos").doc(alumnoId).get();
    const alumno = alumnoDoc.data();
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Diseño del comprobante
    doc.addImage(logoDataURL, 'PNG', 20, 10, 25, 25);
    doc.setFontSize(16);
    doc.setTextColor(40, 167, 69);
    doc.text("CLUB ATLETICO DEPORTIVO", 50, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text("RECREATIVO SOCIAL Y CULTURAL", 50, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("SAN RAFAEL - CAMPO GRANDE", 50, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Alumno: ${alumno.nombre}`, 20, 40);
    doc.text(`Mes: ${formatearMes(mes)}`, 20, 50);
    doc.text(`Estado: ${estado}`, 20, 60);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 20, 70);
    
    // Código QR (opcional, requiere librería adicional)
    const qrCodeSize = 50;
    doc.text("Firma Digital:", 20, 100);
    doc.rect(20, 105, qrCodeSize, qrCodeSize); // Espacio para QR
    
    // Número de comprobante único
    const numeroComprobante = `COMP-${Date.now()}`;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`N°: ${numeroComprobante}`, 160, 90);
    
    doc.save(`comprobante-${numeroComprobante}.pdf`);
    $('#comprobanteModal').modal('hide');
};

// Inicialización (añade esto al DOMContentLoaded)
if (document.getElementById("selectAlumno")) {
    cargarAlumnosParaComprobante();
}
// ===== GENERACIÓN DE REPORTES PDF =====
window.generarReporte = async (tipo) => {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración del documento
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = 30;
        
        // Encabezado
        doc.addImage(logoDataURL, 'PNG', 15, 10, 30, 30);
doc.setFontSize(16);
doc.setTextColor(40, 167, 69);
doc.text("ESCUELA DE FÚTBOL", 50, 20, { align: 'center' });
doc.text("SAN RAFAEL", 50, 27, { align: 'center' });
        
        // Subtítulo
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(`Reporte de Pagos - ${tipo.toUpperCase()}`, pageWidth / 2, 30, { align: 'center' });
        
        // Fecha de generación
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`, pageWidth - margin, 40, { align: 'right' });
        
        yPos = 50;
        
        // Línea divisoria
        doc.setDrawColor(200);
        doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
        
        // Obtener datos de Firestore
        const snapshot = await db.collection('alumnos').get();
        
        // Recorrer alumnos
        snapshot.docs.forEach(docAlumno => {
            const alumno = docAlumno.data();
            const mesesRegistrados = alumno.meses || {};
            
            // Obtener meses ordenados y filtrados
            const mesesFiltrados = generarMesesAnio()
                .filter(mesKey => {
                    const estado = mesesRegistrados[mesKey];
                    if (tipo === 'pagado') return estado === true;
                    if (tipo === 'pendiente') return estado === false;
                    return false;
                })
                .map(mesKey => formatearMes(mesKey).split(' ')[0]); // Convertir a formato abreviado
            
            if (mesesFiltrados.length === 0) return;
            
            // Nombre del alumno
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(alumno.nombre, margin, yPos);
            
            // Lista de meses
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            
            const mesesTexto = mesesFiltrados.join('  •  ');
            const maxWidth = pageWidth - margin - 60; // 60 = espacio para el nombre
            
            // Ajustar texto si es muy largo
            const lineas = doc.splitTextToSize(mesesTexto, maxWidth);
            doc.text(lineas, margin + 50, yPos);
            
            // Ajustar posición Y
            yPos += 10 + (lineas.length - 1) * 8;
            
            // Línea divisoria
            doc.setDrawColor(220);
            doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
            
            // Salto de página
            if (yPos > 280) {
                doc.addPage();
                yPos = 30;
            }
        });

        doc.save(`reporte-${tipo}.pdf`);
    } catch (error) {
        alert('Error generando reporte: ' + error.message);
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('listaAlumnos')) cargarAlumnos();
});

// Exportar funciones al ámbito global
window.login = login;
window.logout = logout;
window.agregarAlumno = agregarAlumno;
window.eliminarAlumno = eliminarAlumno;
window.generarReporte = generarReporte;