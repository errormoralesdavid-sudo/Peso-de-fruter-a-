/* ==========================================================
   APP.JS - MOTOR SÚPER APP BÁSCULA POS & AUTOPAGO QR SUICHE 7B
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsBnDGC_E_oSoKrewTbmkrmw2JAjdcalU",
  authDomain: "geomercado-9d642.firebaseapp.com",
  projectId: "geomercado-9d642",
  storageBucket: "geomercado-9d642.appspot.com",
  messagingSenderId: "521126894575",
  appId: "1:521126894575:web:4c847de3dd57d6a430b7a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado Global y Persistencia Segura
let tasaBCV = parseFloat(localStorage.getItem('bascula_tasa_bcv')) || 36.50;
// Hash SHA-256 por defecto de "1234"
let claveAdminHash = localStorage.getItem('bascula_clave_hash') || "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
let logoUrl = localStorage.getItem('bascula_logo_url') || "https://cdn-icons-png.flaticon.com/512/1046/1046857.png";

// Datos Bancarios para el Motor QR Suiche 7B (Con tus datos predeterminados listos)
let datosPagoMovil = JSON.parse(localStorage.getItem('bascula_datos_pm')) || {
  banco: "0102 - Banco de Venezuela",
  rif: "V30629336",
  telefono: "04123167126"
};

// Imagen QR propia subida directamente desde el banco (opcional)
let qrBancoCustomBase64 = localStorage.getItem('bascula_qr_custom_img') || null;

let pesoBrutoGramos = 0;
let taraGramos = 0;
window.carrito = [];
let productoTemp = null;
let cantidadUnidadesTemp = 1;
let metodoPagoActual = 'pagomovil';
let unsubscribePagosVivo = null;
let numpadCallback = null;
let numpadMaxLen = 6;
let numpadEsSecreto = false;
let numpadValorActual = "";

let categoriaSeleccionada = "";
let temporizadorInactividad = null;
let datosUltimoTicket = null;
let ventasHistorial = JSON.parse(localStorage.getItem('bascula_ventas_historial')) || [];
let imagenesBase64Temp = { add: null, edit: null };
const hoyStr = new Date().toISOString().split('T')[0];

// Catálogo Predeterminado (Incluye la nueva categoría "Varios / Empaques" por Unidad)
const productosPredeterminados = [
  { id: 1, nombre: 'Manzana Red', categoria: 'Frutería', tipoVenta: 'peso', precioKg: 2.50, stockGramos: 15000, codigoBarras: '7591001', diasVida: 7, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300' },
  { id: 2, nombre: 'Cambur / Banana', categoria: 'Frutería', tipoVenta: 'peso', precioKg: 1.20, stockGramos: 8000, codigoBarras: '7591002', diasVida: 3, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300' },
  { id: 3, nombre: 'Zanahoria Fresca', categoria: 'Verdulería', tipoVenta: 'peso', precioKg: 1.80, stockGramos: 20000, codigoBarras: '7591003', diasVida: 8, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1598170845058-12ef4a457939?w=300' },
  { id: 4, nombre: 'Tomate Perita', categoria: 'Verdulería', tipoVenta: 'peso', precioKg: 3.00, stockGramos: 12000, codigoBarras: '7591004', diasVida: 4, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300' },
  { id: 5, nombre: 'Maní Salado 250g', categoria: 'Manicería', tipoVenta: 'unidad', precioKg: 1.50, stockGramos: 40, codigoBarras: '7591005', diasVida: 45, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1567892568620-80d8591325d7?w=300' },
  { id: 6, nombre: 'Caraotas Negras', categoria: 'Granos', tipoVenta: 'peso', precioKg: 2.20, stockGramos: 30000, codigoBarras: '7591006', diasVida: 60, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=300' },
  { id: 7, nombre: 'Queso Paisa', categoria: 'Charcutería', tipoVenta: 'peso', precioKg: 6.50, stockGramos: 6000, codigoBarras: '7591007', diasVida: 10, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300' },
  { id: 8, nombre: 'Paquete de Casabe Gourmet', categoria: 'Varios / Empaques', tipoVenta: 'unidad', precioKg: 2.00, stockGramos: 30, codigoBarras: '7591008', diasVida: 90, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },
  { id: 9, nombre: 'medio Cartón de Huevos (15u)', categoria: 'Varios / Empaques', tipoVenta: 'unidad', precioKg: 2.80, stockGramos: 25, codigoBarras: '7591009', diasVida: 15, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300' }
];

let productos = JSON.parse(localStorage.getItem('bascula_productos')) || productosPredeterminados;

// Asegurar que si ya tenías productos guardados en caché se agreguen los de ejemplo de la nueva categoría si no existe ninguno
if (!productos.some(p => p.categoria === 'Varios / Empaques')) {
  productos.push(productosPredeterminados[7], productosPredeterminados[8]);
  localStorage.setItem('bascula_productos', JSON.stringify(productos));
}

// Sintetizador de Sonido Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function reproducirSonido(tipo) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (tipo === 'beep') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    osc.start(); osc.stop(audioCtx.currentTime + 0.14);
  } else if (tipo === 'balanza') {
    osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  } else if (tipo === 'scan') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(1250, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.start(); osc.stop(audioCtx.currentTime + 0.12);
  }
}

// Sanitizador contra XSS
function escaparHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Cifrado SHA-256 para PIN Administrador
async function calcularHashSHA256(mensaje) {
  const msgBuffer = new TextEncoder().encode(mensaje);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Notificaciones Toast Animadas con Anime.js
function mostrarToast(mensaje, tipo = 'exito') {
  const contenedor = document.getElementById('toast-container');
  if (!contenedor) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerText = mensaje;
  contenedor.appendChild(toast);

  anime({
    targets: toast,
    opacity: [0, 1],
    translateX: [30, 0],
    duration: 380,
    easing: 'easeOutExpo'
  });

  setTimeout(() => {
    anime({
      targets: toast,
      opacity: [1, 0],
      translateX: [0, 30],
      duration: 280,
      easing: 'easeInExpo',
      complete: () => toast.remove()
    });
  }, 3200);
}

// ==========================================================
// GENERADOR DE TOKEN OFICIAL JWT SUICHE 7B + MOTOR QR CALIBRADO
// ==========================================================
function generarPayloadOficialSuiche7B(bancoStr, rifStr, telStr, montoBsNumber) {
  const bankCode = String(bancoStr || "0102").replace(/\D/g, '').slice(0, 4) || "0102";
  const cleanId = String(rifStr || "V30629336").toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  let digitsPhone = String(telStr || "04123167126").replace(/\D/g, '');
  if (digitsPhone.startsWith('0')) {
    digitsPhone = '58' + digitsPhone.slice(1);
  } else if (!digitsPhone.startsWith('58')) {
    digitsPhone = '58' + digitsPhone;
  }

  // Estructura exacta decodificada del QR bancario real de Suiche 7B
  const headerB64 = "eyJhbGciOiAibm9uZSIsICJ0eXAiOiAiSldUIn0=";
  const ahoraSeg = Math.floor(Date.now() / 1000);
  
  const payloadObj = {
    iss: "SUICHE7B",
    iat: ahoraSeg,
    exp: -1,
    data: {
      bank: bankCode,
      identification: cleanId,
      phone: digitsPhone,
      amount: Number(montoBsNumber).toFixed(2),
      url: "https://qr.suiche7b.com.ve"
    }
  };

  const jsonPayload = JSON.stringify(payloadObj);
  const payloadB64 = btoa(unescape(encodeURIComponent(jsonPayload)));
  return `${headerB64}.${payloadB64}.`;
}

function dibujarQRSuiche7B(canvasId, payloadTexto, incluirLogoSuiche = true) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof qrcode === 'undefined') return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;

  // Nivel M/Q optimizado + Quiet Zone amplia (10%) para lectura instantánea en Mercantil Tpago y BDV
  const qr = qrcode(0, incluirLogoSuiche ? 'Q' : 'M');
  qr.addData(payloadTexto);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const margin = Math.floor(size * 0.10);
  const availableSize = size - margin * 2;
  const tileW = availableSize / moduleCount;
  const tileH = availableSize / moduleCount;

  // Fondo blanco puro (indispensable para que las apps bancarias detecten los bordes)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Dibujar módulos con coordenadas enteras nítidas
  ctx.fillStyle = '#000000';
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        const x = Math.round(margin + col * tileW);
        const y = Math.round(margin + row * tileH);
        const w = Math.ceil((col + 1) * tileW) - Math.floor(col * tileW);
        const h = Math.ceil((row + 1) * tileH) - Math.floor(row * tileH);
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  // Emblema central Suiche 7B calibrado al 16% (no obstruye patrones de alineación)
  if (incluirLogoSuiche) {
    const boxSize = Math.floor(size * 0.165);
    const boxX = Math.floor((size - boxSize) / 2);
    const boxY = Math.floor((size - boxSize) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(boxX - 3, boxY - 3, boxSize + 6, boxSize + 6);

    ctx.fillStyle = '#111827';
    ctx.font = `900 ${Math.floor(boxSize * 0.20)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SUICHE', size / 2, boxY + boxSize * 0.22);

    const badgeY = boxY + boxSize * 0.28;
    const badgeH = boxSize * 0.68;
    const badgeW = boxSize * 0.90;
    const badgeX = (size - badgeW) / 2;

    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.clip();

    const coloresSuiche = ['#9333ea', '#0284c7', '#16a34a', '#ea580c'];
    const stripeW = badgeW / 4;
    coloresSuiche.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(badgeX + idx * stripeW, badgeY, stripeW + 1, badgeH);
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(badgeH * 0.66)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('7B', size / 2, badgeY + badgeH / 2 + 1);
    ctx.restore();
  }
}

// Descargar únicamente el cuadro blanco del QR (para adjuntar en Tpago/BDV sin errores)
function descargarQRLimpio() {
  const link = document.createElement('a');
  link.download = `QR_PagoMovil_${datosPagoMovil.rif}.png`;

  if (qrBancoCustomBase64) {
    link.href = qrBancoCustomBase64;
  } else {
    const canvas = document.getElementById('qr-suiche-canvas');
    link.href = canvas.toDataURL('image/png', 1.0);
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarToast("Imagen QR limpia guardada lista para tu banco", "exito");
}

// Subir imagen QR original descargada del banco en el Panel Admin
function procesarSubidaQRBanco(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_QR = 500;
      canvas.width = MAX_QR;
      canvas.height = MAX_QR;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, MAX_QR, MAX_QR);
      ctx.drawImage(img, 0, 0, MAX_QR, MAX_QR);
      
      qrBancoCustomBase64 = canvas.toDataURL('image/png', 0.92);
      localStorage.setItem('bascula_qr_custom_img', qrBancoCustomBase64);
      recalcularTotalesCarritoUI();
      mostrarToast("Imagen QR oficial de tu banco activada", "exito");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================================
// TECLADO NUMÉRICO TÁCTIL INTEGRADO (NUMPAD)
// ==========================================================
function abrirNumpad({ titulo, maxLen = 6, secreto = false, valorInicial = "", onConfirm }) {
  numpadValorActual = String(valorInicial || "");
  numpadMaxLen = maxLen;
  numpadEsSecreto = secreto;
  numpadCallback = onConfirm;

  document.getElementById('numpad-titulo').innerText = titulo;
  actualizarVisorNumpad();
  abrirModal('modal-numpad');
}

function actualizarVisorNumpad() {
  const visor = document.getElementById('numpad-display');
  if (numpadEsSecreto) {
    visor.value = "•".repeat(numpadValorActual.length);
  } else {
    visor.value = numpadValorActual || "—";
  }
}

function procesarTeclaNumpad(key) {
  reproducirSonido('beep');
  if (key === 'C') {
    numpadValorActual = "";
  } else if (key === 'BACK') {
    numpadValorActual = numpadValorActual.slice(0, -1);
  } else if (numpadValorActual.length < numpadMaxLen) {
    numpadValorActual += key;
  }
  actualizarVisorNumpad();
}

// Compresor de imágenes de Galería para Productos
function comprimirImagenGaleria(file, modo) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 260;
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);

      if (modo === 'add') {
        imagenesBase64Temp.add = dataUrl;
        document.getElementById('prev-add-img').src = dataUrl;
        document.getElementById('prev-add-box').style.display = 'block';
        document.getElementById('adm-img-url').value = '';
      } else {
        imagenesBase64Temp.edit = dataUrl;
        document.getElementById('prev-edit-img').src = dataUrl;
        document.getElementById('edit-prod-img-url').value = '';
      }
      mostrarToast("Imagen optimizada lista", "exito");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ==========================================================
// INICIALIZACIÓN DE EVENTOS DOM
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  aplicarLogo();
  actualizarDisplaysTasa();
  actualizarDisplayPeso();
  cargarDatosPagoMovilUI();
  obtenerTasaBCVOnline();
  iniciarMonitoreoInactividad();
  actualizarReporteAdmin();
  document.getElementById('adm-fecha-ingreso').value = hoyStr;

  anime({
    targets: '#img-logo-bienvenida',
    translateY: [-6, 6],
    direction: 'alternate',
    loop: true,
    easing: 'easeInOutSine',
    duration: 2400
  });

  // Navegación y Kiosco
  document.getElementById('btn-comenzar').addEventListener('click', iniciarKiosco);
  document.getElementById('btn-simular-peso').addEventListener('click', () => {
    document.getElementById('input-peso-sim').value = pesoBrutoGramos;
    abrirModal('modal-peso-sim');
  });
  document.getElementById('btn-tara').addEventListener('click', aplicarTara);
  document.getElementById('btn-volver').addEventListener('click', mostrarCategorias);
  document.getElementById('btn-cart-float').addEventListener('click', abrirCarrito);

  // Acceso Admin con Numpad Táctil
  document.getElementById('btn-acceso-admin').addEventListener('click', () => {
    abrirNumpad({
      titulo: "PIN de Administrador",
      maxLen: 8,
      secreto: true,
      onConfirm: (pin) => verificarPinAdmin(pin)
    });
  });

  // Hardware (BLE + USB Serial)
  document.getElementById('btn-conectar-ble').addEventListener('click', conectarBLE);
  document.getElementById('btn-conectar-usb').addEventListener('click', conectarUSBSerial);

  // Configuración Admin y QR Bancario
  document.getElementById('btn-actualizar-tasa-header').addEventListener('click', obtenerTasaBCVOnline);
  document.getElementById('btn-sincronizar').addEventListener('click', obtenerTasaBCVOnline);
  document.getElementById('btn-guardar-tasa').addEventListener('click', guardarTasaManual);
  document.getElementById('btn-guardar-pm').addEventListener('click', guardarDatosPagoMovil);
  document.getElementById('btn-subir-qr-banco').addEventListener('click', () => document.getElementById('input-file-qr-banco').click());
  document.getElementById('input-file-qr-banco').addEventListener('change', (e) => procesarSubidaQRBanco(e.target.files[0]));
  document.getElementById('btn-usar-qr-motor').addEventListener('click', () => {
    qrBancoCustomBase64 = null;
    localStorage.removeItem('bascula_qr_custom_img');
    recalcularTotalesCarritoUI();
    mostrarToast("Motor QR Suiche 7B automático activado", "exito");
  });

  // Cambio automático a "Por Unidad" cuando seleccionas la categoría "Varios / Empaques"
  document.getElementById('adm-categoria').addEventListener('change', (e) => {
    if (e.target.value === 'Varios / Empaques') {
      document.getElementById('adm-tipo-venta').value = 'unidad';
      document.getElementById('adm-stock').value = '50';
    }
  });
  document.getElementById('edit-prod-categoria').addEventListener('change', (e) => {
    if (e.target.value === 'Varios / Empaques') {
      document.getElementById('edit-prod-tipo').value = 'unidad';
    }
  });

  document.getElementById('btn-actualizar-logo').addEventListener('click', actualizarLogo);
  document.getElementById('btn-guardar-prod').addEventListener('click', guardarProductoAdmin);
  document.getElementById('btn-guardar-edit').addEventListener('click', guardarCambiosEdicion);
  document.getElementById('btn-cambiar-clave').addEventListener('click', cambiarClaveAdmin);
  document.getElementById('btn-confirmar-peso-sim').addEventListener('click', aplicarPesoSimulado);

  // Modal Confirmación Híbrida
  document.getElementById('btn-restar-unidad').addEventListener('click', () => ajustarUnidadesModal(-1));
  document.getElementById('btn-sumar-unidad').addEventListener('click', () => ajustarUnidadesModal(1));
  document.getElementById('btn-confirmar-agregar').addEventListener('click', confirmarAgregar);

  // Carrito, Descarga de QR Limpio y Numpad de Referencia
  document.getElementById('tab-pagomovil').addEventListener('click', () => cambiarMetodoPago('pagomovil'));
  document.getElementById('tab-divisas').addEventListener('click', () => cambiarMetodoPago('divisas'));
  document.getElementById('btn-descargar-qr-limpio').addEventListener('click', descargarQRLimpio);
  document.getElementById('btn-zoom-qr').addEventListener('click', descargarQRLimpio);

  const abrirNumpadRef = () => {
    abrirNumpad({
      titulo: "Últimos 6 Dígitos de Referencia",
      maxLen: 6,
      secreto: false,
      valorInicial: document.getElementById('ref-pago-input').value,
      onConfirm: (val) => {
        document.getElementById('ref-pago-input').value = val;
      }
    });
  };
  document.getElementById('ref-pago-input').addEventListener('click', abrirNumpadRef);
  document.getElementById('btn-abrir-numpad-ref').addEventListener('click', abrirNumpadRef);
  document.getElementById('btn-validar-pago').addEventListener('click', validarPagoFirestore);
  document.getElementById('btn-ticket-pendiente').addEventListener('click', () => generarTicket('PENDIENTE'));

  // Ticket y Exportaciones
  document.getElementById('btn-imprimir-bt').addEventListener('click', imprimirTicketBluetooth);
  document.getElementById('btn-repetir-pesaje').addEventListener('click', repetirPesaje);
  document.getElementById('btn-finalizar-salir').addEventListener('click', reiniciarTodo);
  document.getElementById('btn-exportar-ventas').addEventListener('click', exportarVentasCSV);
  document.getElementById('btn-exportar-catalogo').addEventListener('click', exportarProductosCSV);

  // Galería Productos
  document.getElementById('btn-galeria-add').addEventListener('click', () => document.getElementById('img-gallery-add').click());
  document.getElementById('img-gallery-add').addEventListener('change', (e) => comprimirImagenGaleria(e.target.files[0], 'add'));
  document.getElementById('btn-galeria-edit').addEventListener('click', () => document.getElementById('img-gallery-edit').click());
  document.getElementById('img-gallery-edit').addEventListener('change', (e) => comprimirImagenGaleria(e.target.files[0], 'edit'));

  // Teclas Numpad
  document.querySelectorAll('.numpad-key').forEach(btn => {
    btn.addEventListener('click', () => procesarTeclaNumpad(btn.dataset.key));
  });
  document.getElementById('btn-numpad-ok').addEventListener('click', () => {
    cerrarModal('modal-numpad');
    if (typeof numpadCallback === 'function') numpadCallback(numpadValorActual);
  });

  // Categorías (incluyendo Varios / Empaques)
  document.querySelectorAll('.card-categoria').forEach(card => {
    card.addEventListener('click', () => filtrarPorCategoria(card.dataset.categoria));
  });

  // Buscador con Lodash Debounce
  document.getElementById('input-buscar').addEventListener('input', _.debounce(buscarProductosDirecto, 200));

  // Chips de peso
  document.querySelectorAll('.chip-peso').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('input-peso-sim').value = chip.dataset.gramos;
    });
  });

  // Cierre de modales
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      if (targetId === 'modal-carrito' && unsubscribePagosVivo) {
        unsubscribePagosVivo();
        unsubscribePagosVivo = null;
      }
      cerrarModal(targetId);
    });
  });

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4') {
      e.preventDefault();
      abrirCarrito();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => cerrarModal(m.id));
    }
  });
});

window.addEventListener('focus', () => obtenerTasaBCVOnline());

// ==========================================================
// SINCRONIZACIÓN TASA BCV Y CONFIGURACIÓN COMERCIO
// ==========================================================
async function obtenerTasaBCVOnline() {
  const btn = document.getElementById('btn-sincronizar');
  if (btn) btn.innerText = "Consultando tasa oficial en vivo...";
  try {
    const resPrimary = await fetch('https://rates.dolarvzla.com/bcv/current.json', { cache: 'no-cache' });
    if (resPrimary.ok) {
      const dataPrimary = await resPrimary.json();
      let tasaActual = dataPrimary.rate || dataPrimary.price || dataPrimary.promedio;
      if (tasaActual && !isNaN(tasaActual) && tasaActual > 0) {
        guardarTasaEnStorage(parseFloat(tasaActual));
        return;
      }
    }
    throw new Error("Fallback");
  } catch (err) {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-cache' });
      if (response.ok) {
        const data = await response.json();
        let tasaAlMomento = data.promedio || data.precio;
        if (tasaAlMomento && !isNaN(tasaAlMomento) && tasaAlMomento > 0) {
          guardarTasaEnStorage(parseFloat(tasaAlMomento));
        }
      }
    } catch (e) {
      console.warn("Operando con tasa BCV local.");
    }
  } finally {
    if (btn) btn.innerText = "Sincronizar Tasa BCV en Tiempo Real";
  }
}

function guardarTasaEnStorage(valor) {
  tasaBCV = valor;
  localStorage.setItem('bascula_tasa_bcv', tasaBCV);
  actualizarDisplaysTasa();
  if (categoriaSeleccionada) renderizarProductosGrid(productos.filter(p => p.categoria === categoriaSeleccionada));
}

function guardarTasaManual() {
  let val = parseFloat(document.getElementById('adm-tasa').value);
  if (val && val > 0) {
    guardarTasaEnStorage(val);
    mostrarToast("Tasa BCV actualizada", "exito");
  } else {
    mostrarToast("Monto de tasa inválido", "error");
  }
}

function cargarDatosPagoMovilUI() {
  document.getElementById('lbl-banco-comercio').innerText = datosPagoMovil.banco;
  document.getElementById('lbl-rif-comercio').innerText = datosPagoMovil.rif;
  document.getElementById('lbl-tel-comercio').innerText = datosPagoMovil.telefono;

  document.getElementById('adm-pm-banco').value = datosPagoMovil.banco;
  document.getElementById('adm-pm-rif').value = datosPagoMovil.rif;
  document.getElementById('adm-pm-tel').value = datosPagoMovil.telefono;
}

function guardarDatosPagoMovil() {
  const banco = document.getElementById('adm-pm-banco').value.trim();
  const rif = document.getElementById('adm-pm-rif').value.trim();
  const telefono = document.getElementById('adm-pm-tel').value.trim();
  if (!banco || !rif || !telefono) {
    mostrarToast("Completa todos los datos bancarios", "error");
    return;
  }
  datosPagoMovil = { banco, rif, telefono };
  localStorage.setItem('bascula_datos_pm', JSON.stringify(datosPagoMovil));
  cargarDatosPagoMovilUI();
  recalcularTotalesCarritoUI();
  mostrarToast("Datos de Pago Móvil QR actualizados", "exito");
}

// ==========================================================
// GESTIÓN DE MODALES Y BALANZA
// ==========================================================
function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => {
    el.classList.add('show');
    anime({
      targets: `#${id} .modal-contenido`,
      scale: [0.88, 1],
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutBack(1.15)'
    });
  });
}

function cerrarModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  anime({
    targets: `#${id} .modal-contenido`,
    scale: [1, 0.92],
    opacity: [1, 0],
    duration: 200,
    easing: 'easeInQuad',
    complete: () => {
      el.classList.remove('show');
      el.style.display = 'none';
    }
  });
}

function aplicarLogo() {
  document.getElementById('img-logo-bienvenida').src = logoUrl;
  document.getElementById('img-logo-header').src = logoUrl;
}

function actualizarDisplaysTasa() {
  document.getElementById('tasa-display-inicio').innerText = tasaBCV.toFixed(2);
  document.getElementById('tasa-display-header').innerText = tasaBCV.toFixed(2);
  document.getElementById('adm-tasa').value = tasaBCV.toFixed(2);
}

function obtenerPesoNeto() {
  return Math.max(0, pesoBrutoGramos - taraGramos);
}

function actualizarDisplayPeso() {
  const elPeso = document.getElementById('peso-val');
  const valorAnterior = parseInt(elPeso.innerText) || 0;
  const valorNuevo = obtenerPesoNeto();
  
  anime({
    targets: { val: valorAnterior },
    val: valorNuevo,
    round: 1,
    duration: 320,
    easing: 'easeOutQuad',
    update: (anim) => {
      elPeso.innerText = anim.animations[0].currentValue;
    }
  });
}

function aplicarTara() {
  taraGramos = pesoBrutoGramos;
  actualizarDisplayPeso();
  reproducirSonido('balanza');
  mostrarToast(`Tara fijada en ${taraGramos}g (Neto: 0g)`, "exito");
}

function aplicarPesoSimulado() {
  let val = parseInt(document.getElementById('input-peso-sim').value);
  if (!isNaN(val) && val >= 0) {
    document.getElementById('estado-peso-lbl').innerHTML = `<span class="dot-status" style="background:#f59e0b;"></span> ESTABILIZANDO...`;
    setTimeout(() => {
      pesoBrutoGramos = val;
      actualizarDisplayPeso();
      reproducirSonido('balanza');
      document.getElementById('estado-peso-lbl').innerHTML = `<span class="dot-status"></span> PESO ESTABLE`;
      cerrarModal('modal-peso-sim');
      mostrarToast(`Balanza: ${val}g`, "exito");
    }, 220);
  } else {
    mostrarToast("Ingresa un peso válido", "error");
  }
}

function iniciarMonitoreoInactividad() {
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => document.addEventListener(evt, resetearTemporizador));
  resetearTemporizador();
}

function resetearTemporizador() {
  clearTimeout(temporizadorInactividad);
  temporizadorInactividad = setTimeout(() => {
    if (document.getElementById('pantalla-kiosco').style.display === 'flex' && window.carrito.length === 0) {
      reiniciarTodo();
    }
  }, 120000);
}

// ==========================================================
// CATÁLOGO Y COMPRA HÍBRIDA (PESO EN GRAMOS O POR UNIDAD)
// ==========================================================
function iniciarKiosco() {
  anime({
    targets: '#pantalla-inicio',
    opacity: [1, 0],
    scale: [1, 1.03],
    duration: 320,
    easing: 'easeInOutQuad',
    complete: () => {
      document.getElementById('pantalla-inicio').style.display = 'none';
      const kiosco = document.getElementById('pantalla-kiosco');
      kiosco.style.display = 'flex';
      anime({ targets: kiosco, opacity: [0, 1], duration: 380, easing: 'easeOutQuad' });
      mostrarCategorias();
    }
  });
}

function mostrarCategorias() {
  categoriaSeleccionada = "";
  document.getElementById('input-buscar').value = "";
  document.getElementById('titulo-seccion').innerText = "Seleccione una Categoría";
  document.getElementById('btn-volver').style.display = 'none';
  document.getElementById('vista-categorias').style.display = 'grid';
  document.getElementById('vista-productos').style.display = 'none';

  anime({
    targets: '.card-categoria',
    opacity: [0, 1],
    translateY: [18, 0],
    delay: anime.stagger(50),
    easing: 'easeOutExpo',
    duration: 420
  });
}

function filtrarPorCategoria(cat) {
  categoriaSeleccionada = cat;
  document.getElementById('input-buscar').value = "";
  document.getElementById('titulo-seccion').innerText = "Categoría: " + cat;
  document.getElementById('btn-volver').style.display = 'flex';
  document.getElementById('vista-categorias').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'grid';
  renderizarProductosGrid(productos.filter(p => p.categoria === cat));
}

function buscarProductosDirecto() {
  let texto = document.getElementById('input-buscar').value.toLowerCase().trim();
  if (texto.length > 0) {
    document.getElementById('vista-categorias').style.display = 'none';
    document.getElementById('vista-productos').style.display = 'grid';
    document.getElementById('btn-volver').style.display = 'flex';
    document.getElementById('titulo-seccion').innerText = "Resultados de Búsqueda";
    
    const encontrados = productos.filter(p => p.nombre.toLowerCase().includes(texto) || (p.codigoBarras && p.codigoBarras === texto));
    if (encontrados.length === 1 && encontrados[0].codigoBarras === texto) {
      reproducirSonido('scan');
      seleccionarProducto(encontrados[0].id);
      document.getElementById('input-buscar').value = "";
      return;
    }
    renderizarProductosGrid(encontrados);
  } else if (categoriaSeleccionada) {
    filtrarPorCategoria(categoriaSeleccionada);
  } else {
    mostrarCategorias();
  }
}

function calcularEstadoOferta(p) {
  if (!p.fechaIngreso || !p.diasVida) return { descuento: 0, etiqueta: '', precioFinal: p.precioKg };
  const fIngreso = new Date(p.fechaIngreso);
  const fHoy = new Date();
  const diasTranscurridos = Math.floor(Math.abs(fHoy - fIngreso) / (1000 * 60 * 60 * 24));
  const diasRestantes = p.diasVida - diasTranscurridos;

  if (diasRestantes <= 0) return { descuento: 50, etiqueta: 'REMATE -50%', precioFinal: p.precioKg * 0.50 };
  if (diasRestantes === 1) return { descuento: 20, etiqueta: 'OFERTA -20%', precioFinal: p.precioKg * 0.80 };
  return { descuento: 0, etiqueta: '', precioFinal: p.precioKg };
}

function renderizarProductosGrid(lista) {
  const grid = document.getElementById('vista-productos');
  grid.innerHTML = '';
  if (lista.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--text-muted); font-weight:700;">No se encontraron productos en esta categoría.</p>';
    return;
  }

  lista.forEach(p => {
    const esPorUnidad = p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques';
    const sufijoUnidad = esPorUnidad ? '/unid' : '/kg';
    const estadoOferta = calcularEstadoOferta(p);
    let precioEfectivo = estadoOferta.precioFinal;
    let precioBs = precioEfectivo * tasaBCV;

    let badgeHtml = estadoOferta.descuento > 0 ? `<div class="${estadoOferta.descuento === 50 ? 'badge-remate' : 'badge-oferta'}">${estadoOferta.etiqueta}</div>` : '';
    let barcodeHtml = p.codigoBarras ? `<div class="badge-barcode">#${escaparHTML(p.codigoBarras)}</div>` : '';

    let stockVal = p.stockGramos !== undefined ? p.stockGramos : 10000;
    let stockTexto = esPorUnidad ? `${stockVal} unid.` : `${(stockVal / 1000).toFixed(1)}kg`;
    let stockHtml = stockVal <= 0 
      ? `<div class="badge-stock stock-out">AGOTADO</div>` 
      : (esPorUnidad ? stockVal < 5 : stockVal < 2000)
        ? `<div class="badge-stock stock-low">Quedan ${stockTexto}</div>` 
        : `<div class="badge-stock stock-ok">Disponible: ${stockTexto}</div>`;

    const card = document.createElement('div');
    card.className = 'card-producto';
    card.innerHTML = `
      ${badgeHtml}
      ${barcodeHtml}
      <img src="${escaparHTML(p.img)}" alt="${escaparHTML(p.nombre)}" onerror="this.src='https://via.placeholder.com/200?text=Producto'">
      <h4>${escaparHTML(p.nombre)}</h4>
      <div>
        <div class="precio-usd">$${precioEfectivo.toFixed(2)} ${sufijoUnidad} ${estadoOferta.descuento > 0 ? `<small class="precio-tachado">$${p.precioKg.toFixed(2)}</small>` : ''}</div>
        <div class="precio-bs">Bs. ${precioBs.toFixed(2)} ${sufijoUnidad}</div>
        ${stockHtml}
      </div>
    `;
    card.addEventListener('click', () => seleccionarProducto(p.id));
    grid.appendChild(card);
  });

  anime({
    targets: '.card-producto',
    opacity: [0, 1],
    scale: [0.94, 1],
    delay: anime.stagger(30),
    easing: 'easeOutExpo',
    duration: 350
  });
}

function seleccionarProducto(id) {
  productoTemp = productos.find(p => p.id === id);
  if (!productoTemp) return;

  const esPorUnidad = productoTemp.tipoVenta === 'unidad' || productoTemp.categoria === 'Varios / Empaques';
  let stockDisponible = productoTemp.stockGramos !== undefined ? productoTemp.stockGramos : 10000;
  if (stockDisponible <= 0) {
    mostrarToast(`"${productoTemp.nombre}" está agotado en inventario`, "error");
    return;
  }

  let pesoNeto = obtenerPesoNeto();
  if (!esPorUnidad && pesoNeto <= 0) {
    mostrarToast("Coloque el producto sobre la balanza (peso mayor a 0g)", "aviso");
    return;
  }

  cantidadUnidadesTemp = 1;
  document.getElementById('modal-prod-nombre').innerText = productoTemp.nombre;
  document.getElementById('modal-prod-img').src = productoTemp.img;

  if (esPorUnidad) {
    document.getElementById('bloque-modo-peso').style.display = 'none';
    document.getElementById('bloque-modo-unidad').style.display = 'block';
    document.getElementById('val-unidades').innerText = cantidadUnidadesTemp;
  } else {
    document.getElementById('bloque-modo-peso').style.display = 'block';
    document.getElementById('bloque-modo-unidad').style.display = 'none';
    document.getElementById('modal-peso').innerText = pesoNeto;
  }

  recalcularSubtotalModal();
  abrirModal('modal-confirmar');
}

function ajustarUnidadesModal(delta) {
  if (!productoTemp) return;
  let maxStock = productoTemp.stockGramos || 50;
  let nuevaCant = cantidadUnidadesTemp + delta;
  if (nuevaCant >= 1 && nuevaCant <= maxStock) {
    cantidadUnidadesTemp = nuevaCant;
    document.getElementById('val-unidades').innerText = cantidadUnidadesTemp;
    reproducirSonido('beep');
    recalcularSubtotalModal();
  }
}

function recalcularSubtotalModal() {
  if (!productoTemp) return;
  const esPorUnidad = productoTemp.tipoVenta === 'unidad' || productoTemp.categoria === 'Varios / Empaques';
  const estadoOferta = calcularEstadoOferta(productoTemp);
  
  let subtotalUsd = esPorUnidad 
    ? cantidadUnidadesTemp * estadoOferta.precioFinal 
    : (obtenerPesoNeto() / 1000) * estadoOferta.precioFinal;
  let subtotalBs = subtotalUsd * tasaBCV;

  document.getElementById('modal-descuento-info').innerText = estadoOferta.descuento > 0 ? `Promoción Activa: ${estadoOferta.etiqueta}` : '';
  document.getElementById('modal-subtotal-usd').innerText = subtotalUsd.toFixed(2);
  document.getElementById('modal-subtotal-bs').innerText = subtotalBs.toFixed(2);
}

function animarVueloAlCarrito(imgSrc) {
  const imgOrigen = document.getElementById('modal-prod-img');
  const btnDestino = document.getElementById('btn-cart-float');
  if (!imgOrigen || !btnDestino) return;

  const rectOrigen = imgOrigen.getBoundingClientRect();
  const rectDestino = btnDestino.getBoundingClientRect();

  const clon = document.createElement('img');
  clon.src = imgSrc;
  clon.className = 'vuelo-item';
  clon.style.left = `${rectOrigen.left + rectOrigen.width / 2 - 30}px`;
  clon.style.top = `${rectOrigen.top + rectOrigen.height / 2 - 30}px`;
  document.body.appendChild(clon);

  anime({
    targets: clon,
    left: rectDestino.left + 8,
    top: rectDestino.top + 8,
    scale: [1, 0.2],
    opacity: [1, 0.3],
    duration: 600,
    easing: 'easeInOutCubic',
    complete: () => {
      clon.remove();
      actualizarCarritoBadge();
    }
  });
}

function confirmarAgregar() {
  if (!productoTemp) return;
  const esPorUnidad = productoTemp.tipoVenta === 'unidad' || productoTemp.categoria === 'Varios / Empaques';
  let pesoNeto = obtenerPesoNeto();
  if (!esPorUnidad && pesoNeto <= 0) return;

  const estadoOferta = calcularEstadoOferta(productoTemp);
  const subtotalUsd = esPorUnidad 
    ? cantidadUnidadesTemp * estadoOferta.precioFinal 
    : (pesoNeto / 1000) * estadoOferta.precioFinal;
  const subtotalBs = subtotalUsd * tasaBCV;

  window.carrito.push({
    id: productoTemp.id,
    nombre: productoTemp.nombre + (estadoOferta.descuento > 0 ? ` (${estadoOferta.etiqueta})` : ''),
    tipoVenta: esPorUnidad ? 'unidad' : 'peso',
    peso: esPorUnidad ? 0 : pesoNeto,
    unidades: esPorUnidad ? cantidadUnidadesTemp : 1,
    subtotalUsd,
    subtotalBs
  });

  reproducirSonido('beep');
  animarVueloAlCarrito(productoTemp.img);
  cerrarModal('modal-confirmar');
  mostrarToast("Producto añadido al carrito", "exito");
}

function actualizarCarritoBadge() {
  const badge = document.getElementById('cant-carrito');
  badge.innerText = window.carrito.length;
  anime({
    targets: badge,
    scale: [1, 1.4, 1],
    duration: 380,
    easing: 'easeOutElastic(1, .6)'
  });
}

// ==========================================================
// CARRITO, AUDITORÍA DE PESO, QR SUICHE 7B Y ESCUCHA EN VIVO
// ==========================================================
function cambiarMetodoPago(metodo) {
  metodoPagoActual = metodo;
  document.getElementById('tab-pagomovil').classList.toggle('active', metodo === 'pagomovil');
  document.getElementById('tab-divisas').classList.toggle('active', metodo === 'divisas');
  document.getElementById('panel-autopago-qr').style.display = metodo === 'pagomovil' ? 'block' : 'none';
  document.getElementById('panel-pago-divisas').style.display = metodo === 'divisas' ? 'block' : 'none';
  document.getElementById('badge-igtf-activo').style.display = metodo === 'divisas' ? 'inline' : 'none';
  recalcularTotalesCarritoUI();
}

function recalcularTotalesCarritoUI() {
  let baseUsd = window.carrito.reduce((acc, item) => acc + item.subtotalUsd, 0);
  let baseBs = window.carrito.reduce((acc, item) => acc + item.subtotalBs, 0);

  let finalUsd = metodoPagoActual === 'divisas' ? baseUsd * 1.03 : baseUsd;
  let finalBs = metodoPagoActual === 'divisas' ? baseBs * 1.03 : baseBs;

  document.getElementById('cart-total-usd').innerText = finalUsd.toFixed(2);
  document.getElementById('cart-total-bs').innerText = finalBs.toFixed(2);

  const canvasQR = document.getElementById('qr-suiche-canvas');
  const imgCustomQR = document.getElementById('qr-custom-img');

  if (qrBancoCustomBase64) {
    canvasQR.style.display = 'none';
    imgCustomQR.src = qrBancoCustomBase64;
    imgCustomQR.style.display = 'block';
  } else {
    imgCustomQR.style.display = 'none';
    canvasQR.style.display = 'block';
    const jwtSuiche = generarPayloadOficialSuiche7B(
      datosPagoMovil.banco,
      datosPagoMovil.rif,
      datosPagoMovil.telefono,
      finalBs
    );
    dibujarQRSuiche7B('qr-suiche-canvas', jwtSuiche, true);
  }
}

function abrirCarrito() {
  const contenedor = document.getElementById('lista-carrito');
  contenedor.innerHTML = '';
  let pesoEsperadoTotal = 0;

  if (window.carrito.length === 0) {
    contenedor.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:15px; font-weight:700;">El carrito está vacío</p>';
  } else {
    window.carrito.forEach((item, index) => {
      pesoEsperadoTotal += item.peso || 0;
      const detalleCant = item.tipoVenta === 'unidad' ? `${item.unidades} unid.` : `${item.peso}g`;
      const row = document.createElement('div');
      row.style.cssText = "display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;";
      row.innerHTML = `
        <div>
          <b>${escaparHTML(item.nombre)}</b> <small style="color:var(--text-muted);">(${detalleCant})</small>
          <div style="font-size:0.82rem; color:var(--text-muted); font-weight:700;">Bs. ${item.subtotalBs.toFixed(2)}</div>
        </div>
        <div style="text-align:right;">
          <b style="color:var(--primary); font-size:1rem;">$${item.subtotalUsd.toFixed(2)}</b>
          <br><button class="btn-eliminar-item" style="background:none; border:none; color:var(--danger); font-size:0.78rem; font-weight:800; cursor:pointer;">Quitar</button>
        </div>
      `;
      row.querySelector('.btn-eliminar-item').addEventListener('click', () => eliminarDelCarrito(index));
      contenedor.appendChild(row);
    });
  }

  document.getElementById('peso-esperado-cart').innerText = `${pesoEsperadoTotal}g`;
  document.getElementById('peso-actual-cart').innerText = `${obtenerPesoNeto()}g`;

  const msgDiv = document.getElementById('msg-autopago');
  if (msgDiv) { msgDiv.innerText = ''; msgDiv.className = ''; }
  document.getElementById('ref-pago-input').value = '';

  recalcularTotalesCarritoUI();
  abrirModal('modal-carrito');
  iniciarEscuchaPagosEnVivo();
}

function eliminarDelCarrito(index) {
  window.carrito.splice(index, 1);
  actualizarCarritoBadge();
  abrirCarrito();
}

// Escucha Automática en Tiempo Real con Firestore onSnapshot
function iniciarEscuchaPagosEnVivo() {
  if (unsubscribePagosVivo) {
    unsubscribePagosVivo();
    unsubscribePagosVivo = null;
  }
  if (window.carrito.length === 0) return;

  let totalBsRequerido = window.carrito.reduce((acc, item) => acc + item.subtotalBs, 0);
  const pagosRef = collection(db, "verificacion_pagos");
  const q = query(pagosRef, where("estado", "==", "PENDIENTE"));

  unsubscribePagosVivo = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added" || change.type === "modified") {
        const docSnap = change.doc;
        const data = docSnap.data();
        const montoPago = parseFloat(data.monto || data.monto_bs || 0);

        if (montoPago > 0 && Math.abs(montoPago - totalBsRequerido) <= 1.50) {
          if (unsubscribePagosVivo) { unsubscribePagosVivo(); unsubscribePagosVivo = null; }
          await updateDoc(docSnap.ref, {
            estado: "PROCESADO",
            fecha_procesado: new Date().toISOString()
          });
          reproducirSonido('scan');
          mostrarToast("¡Pago Móvil detectado automáticamente!", "exito");
          cerrarModal('modal-carrito');
          generarTicket('PAGADO');
        }
      }
    });
  }, () => {});
}

// Verificación Manual por 6 Dígitos de Referencia
async function validarPagoFirestore() {
  const rawInput = document.getElementById('ref-pago-input').value.trim();
  const msgDiv = document.getElementById('msg-autopago');
  const btnValidar = document.getElementById('btn-validar-pago');

  if (!rawInput || rawInput.length < 4) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "Ingresa los últimos 6 dígitos de la referencia.";
    return;
  }
  if (window.carrito.length === 0) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "El carrito está vacío.";
    return;
  }

  let totalBsRequerido = window.carrito.reduce((acc, item) => acc + item.subtotalBs, 0);
  const refInput = rawInput.slice(-6);

  btnValidar.disabled = true;
  msgDiv.className = "msg-cargando";
  msgDiv.innerText = "Consultando transacción en Firestore...";

  try {
    const pagosRef = collection(db, "verificacion_pagos");
    const q = query(pagosRef, where("referencia_6digitos", "==", refInput));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        if (data.estado === "PROCESADO") {
          msgDiv.className = "msg-error";
          msgDiv.innerText = "Esta referencia ya fue utilizada anteriormente.";
          break;
        }

        let montoRegistrado = parseFloat(data.monto || data.monto_bs || 0);
        if (montoRegistrado > 0 && Math.abs(montoRegistrado - totalBsRequerido) > 1.50) {
          msgDiv.className = "msg-error";
          msgDiv.innerText = `Monto diferente. Recibido: Bs. ${montoRegistrado.toFixed(2)} | Requerido: Bs. ${totalBsRequerido.toFixed(2)}`;
          break;
        }

        await updateDoc(docSnap.ref, {
          estado: "PROCESADO",
          fecha_procesado: new Date().toISOString()
        });

        msgDiv.className = "msg-exito";
        msgDiv.innerText = "¡Pago Confirmado Exitosamente!";
        reproducirSonido('scan');

        setTimeout(() => {
          cerrarModal('modal-carrito');
          generarTicket('PAGADO');
        }, 900);
        break;
      }
    } else {
      msgDiv.className = "msg-error";
      msgDiv.innerText = "Referencia aún no recibida. Verifique los dígitos.";
    }
  } catch (error) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "Error de red al verificar con el banco.";
  } finally {
    btnValidar.disabled = false;
  }
}

// ==========================================================
// EMISIÓN DE TICKET CON QR DE AUDITORÍA ANTIRROBO
// ==========================================================
function generarTicket(estadoPago = 'PENDIENTE') {
  if (window.carrito.length === 0) { mostrarToast("El carrito está vacío", "aviso"); return; }
  if (unsubscribePagosVivo) { unsubscribePagosVivo(); unsubscribePagosVivo = null; }
  cerrarModal('modal-carrito');

  const numSerial = "TK-" + Math.floor(100000 + Math.random() * 900000);
  const fechaHora = new Date().toLocaleString('es-VE');
  let baseUsd = 0; let baseBs = 0;

  window.carrito.forEach(cartItem => {
    let prod = productos.find(p => p.id === cartItem.id);
    if (prod) {
      let descuentoStock = cartItem.tipoVenta === 'unidad' ? cartItem.unidades : cartItem.peso;
      prod.stockGramos = Math.max(0, (prod.stockGramos || 0) - descuentoStock);
    }
    baseUsd += cartItem.subtotalUsd;
    baseBs += cartItem.subtotalBs;
  });
  localStorage.setItem('bascula_productos', JSON.stringify(productos));

  const aplicaIGTF = metodoPagoActual === 'divisas' && estadoPago !== 'PAGADO';
  const totalUsd = aplicaIGTF ? baseUsd * 1.03 : baseUsd;
  const totalBs = aplicaIGTF ? baseBs * 1.03 : baseBs;

  datosUltimoTicket = { serial: numSerial, fecha: fechaHora, tasa: tasaBCV, estado: estadoPago, items: [...window.carrito], totalUsd, totalBs };

  let esPagado = estadoPago === 'PAGADO';
  let badgeEstadoText = esPagado ? "[ AUTOPAGO VERIFICADO - SALIDA AUTORIZADA ]" : "[ PENDIENTE DE PAGO - PASAR POR CAJA ]";

  let html = `
    <div style="text-align:center; margin-bottom:8px;">
      <b>TERMINAL BÁSCULA POS PRO</b><br>
      <small>${fechaHora}</small><br>
      <b>SERIAL: ${numSerial}</b><br>
      <div style="margin: 6px 0; padding: 5px; border-radius: 6px; font-weight: 900; background: ${esPagado ? '#dcfce7; color: #15803d;' : '#fef3c7; color: #b45309;'}">
        ${badgeEstadoText}
      </div>
      <small>Tasa BCV: ${tasaBCV.toFixed(2)} Bs/$</small>
    </div>
    ----------------------------------<br>
  `;

  window.carrito.forEach(item => {
    const cantStr = item.tipoVenta === 'unidad' ? `${item.unidades} unid` : `${item.peso}g`;
    html += `
      <b>${escaparHTML(item.nombre)}</b> (${cantStr})<br>
      $${item.subtotalUsd.toFixed(2)} | Bs. ${item.subtotalBs.toFixed(2)}<br>
    `;
  });

  if (aplicaIGTF) {
    html += `<small>Recargo IGTF Divisas (3%): +$${(baseUsd * 0.03).toFixed(2)}</small><br>`;
  }

  html += `
    ----------------------------------<br>
    <div style="font-size:1.05rem; margin-top:4px;">
      <b>TOTAL USD: $${totalUsd.toFixed(2)}</b><br>
      <b>TOTAL BS: Bs. ${totalBs.toFixed(2)}</b>
    </div>
  `;

  document.getElementById('contenido-ticket').innerHTML = html;

  const qrAuditoriaPayload = `AUDIT|${numSerial}|${estadoPago}|USD:${totalUsd.toFixed(2)}|BS:${totalBs.toFixed(2)}|${fechaHora}`;
  dibujarQRSuiche7B('qr-ticket-auditoria', qrAuditoriaPayload, false);

  ventasHistorial.push({
    serial: numSerial,
    fecha: hoyStr,
    hora: new Date().toLocaleTimeString('es-VE'),
    totalUsd,
    totalBs,
    estado: estadoPago,
    cantProductos: window.carrito.length
  });
  localStorage.setItem('bascula_ventas_historial', JSON.stringify(ventasHistorial));
  actualizarReporteAdmin();

  window.carrito = [];
  actualizarCarritoBadge();
  abrirModal('modal-ticket');
}

// ==========================================================
// CONEXIÓN HARDWARE DUAL: WEB BLUETOOTH BLE + WEB SERIAL USB
// ==========================================================
async function conectarBLE() {
  if (!navigator.bluetooth) { mostrarToast("Web Bluetooth no disponible en este navegador", "error"); return; }
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b', '0000181d-0000-1000-8000-00805f9b34fb']
    });
    await device.gatt.connect();
    mostrarToast("Balanza Bluetooth BLE conectada", "exito");
  } catch (e) {
    mostrarToast("Modo Simulación BLE activo", "aviso");
  }
}

async function conectarUSBSerial() {
  if (!('serial' in navigator)) {
    mostrarToast("Web Serial USB requiere Chrome/Edge en PC o Android OTG", "aviso");
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    mostrarToast("Balanza USB Serial conectada (9600 baud)", "exito");

    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lineas = buffer.split(/\r?\n/);
      buffer = lineas.pop();
      for (const linea of lineas) {
        const match = linea.match(/(\d+(\.\d+)?)/);
        if (match) {
          let valLeido = parseFloat(match[1]);
          pesoBrutoGramos = linea.toLowerCase().includes('kg') ? Math.round(valLeido * 1000) : Math.round(valLeido);
          actualizarDisplayPeso();
        }
      }
    }
  } catch (err) {
    mostrarToast("Puerto Serial no iniciado: " + err.message, "aviso");
  }
}

async function imprimirTicketBluetooth() {
  if (!datosUltimoTicket) { mostrarToast("No hay ticket activo", "aviso"); return; }
  if (!navigator.bluetooth) { mostrarToast("Web Bluetooth no soportado", "error"); return; }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000e025-0000-1000-8000-00805f9b34fb']
    });
    const server = await device.gatt.connect();
    let service;
    try { service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb'); }
    catch(e) { service = await server.getPrimaryService('0000e025-0000-1000-8000-00805f9b34fb'); }

    const characteristic = (await service.getCharacteristics())[0];
    let texto = `================================\n      BASCULA POS PRO      \n================================\nFECHA: ${datosUltimoTicket.fecha}\nSERIAL: ${datosUltimoTicket.serial}\nESTADO: [ ${datosUltimoTicket.estado} ]\n--------------------------------\n`;
    datosUltimoTicket.items.forEach(item => {
      const cant = item.tipoVenta === 'unidad' ? `${item.unidades}u` : `${item.peso}g`;
      texto += `${item.nombre} (${cant})\nUSD: $${item.subtotalUsd.toFixed(2)} | Bs. ${item.subtotalBs.toFixed(2)}\n--------------------------------\n`;
    });
    texto += `TOTAL USD: $${datosUltimoTicket.totalUsd.toFixed(2)}\nTOTAL BS:  Bs. ${datosUltimoTicket.totalBs.toFixed(2)}\n================================\n\n\n`;

    await characteristic.writeValue((new TextEncoder()).encode(texto));
    mostrarToast("Impresión enviada a la térmica", "exito");
  } catch (err) {
    mostrarToast("No se encontró impresora térmica", "error");
  }
}

function repetirPesaje() { cerrarModal('modal-ticket'); }

function reiniciarTodo() {
  if (unsubscribePagosVivo) { unsubscribePagosVivo(); unsubscribePagosVivo = null; }
  window.carrito = []; taraGramos = 0; datosUltimoTicket = null;
  actualizarCarritoBadge();
  document.querySelectorAll('.modal').forEach(m => {
    m.classList.remove('show');
    m.style.display = 'none';
  });
  mostrarCategorias();
  
  document.getElementById('pantalla-kiosco').style.display = 'none';
  const inicio = document.getElementById('pantalla-inicio');
  inicio.style.display = 'flex';
  anime({ targets: inicio, opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
}

// ==========================================================
// PANEL ADMINISTRADOR Y GRÁFICA D3.JS
// ==========================================================
async function verificarPinAdmin(pinIngresado) {
  const hashIngresado = await calcularHashSHA256(pinIngresado || "");
  if (hashIngresado === claveAdminHash) {
    renderizarListaAdmin();
    actualizarReporteAdmin();
    cargarDatosPagoMovilUI();
    abrirModal('modal-admin');
    setTimeout(renderizarGraficoD3, 160);
  } else {
    mostrarToast("PIN de Administrador incorrecto", "error");
  }
}

async function cambiarClaveAdmin() {
  let nueva = document.getElementById('adm-nueva-clave').value.trim();
  if (nueva && nueva.length >= 4) {
    claveAdminHash = await calcularHashSHA256(nueva);
    localStorage.setItem('bascula_clave_hash', claveAdminHash);
    document.getElementById('adm-nueva-clave').value = '';
    mostrarToast("PIN actualizado con cifrado SHA-256", "exito");
  } else {
    mostrarToast("El PIN debe tener mínimo 4 dígitos", "error");
  }
}

function actualizarLogo() {
  const url = document.getElementById('adm-logo').value.trim();
  if (url) {
    logoUrl = url;
    localStorage.setItem('bascula_logo_url', logoUrl);
    aplicarLogo();
    mostrarToast("Logo corporativo actualizado", "exito");
  }
}

function guardarProductoAdmin() {
  const nombre = document.getElementById('adm-nombre').value.trim();
  const categoria = document.getElementById('adm-categoria').value;
  const tipoVenta = categoria === 'Varios / Empaques' ? 'unidad' : document.getElementById('adm-tipo-venta').value;
  const precio = parseFloat(document.getElementById('adm-precio').value);
  const stockGramos = parseInt(document.getElementById('adm-stock').value) || 0;
  const codigoBarras = document.getElementById('adm-codigo-barras').value.trim();
  const diasVida = parseInt(document.getElementById('adm-dias-vida').value) || 5;
  const fechaIngreso = document.getElementById('adm-fecha-ingreso').value || hoyStr;
  const imgUrlInput = document.getElementById('adm-img-url').value.trim();

  if (!nombre || isNaN(precio)) {
    mostrarToast("Nombre y precio son obligatorios", "error");
    return;
  }

  const imgFinal = imagenesBase64Temp.add || imgUrlInput || 'https://via.placeholder.com/200?text=Producto';
  productos.push({ id: Date.now(), nombre, categoria, tipoVenta, precioKg: precio, stockGramos, codigoBarras, diasVida, fechaIngreso, img: imgFinal });
  localStorage.setItem('bascula_productos', JSON.stringify(productos));

  document.getElementById('adm-nombre').value = '';
  document.getElementById('adm-precio').value = '';
  document.getElementById('adm-codigo-barras').value = '';
  document.getElementById('adm-img-url').value = '';
  document.getElementById('prev-add-box').style.display = 'none';
  imagenesBase64Temp.add = null;

  renderizarListaAdmin();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Producto guardado en catálogo", "exito");
}

function renderizarListaAdmin() {
  const container = document.getElementById('lista-admin-productos');
  container.innerHTML = '';
  document.getElementById('contador-inventario').innerText = productos.length;

  productos.forEach(p => {
    const esUnidad = p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques';
    const stockTxt = esUnidad ? `${p.stockGramos || 0} unid.` : `${((p.stockGramos || 0) / 1000).toFixed(1)}kg`;
    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#070c14; padding:8px 12px; border-radius:10px; border:1px solid var(--border-glass);";
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${escaparHTML(p.img)}" style="width:36px; height:36px; object-fit:cover; border-radius:8px;">
        <div>
          <b style="font-size:0.88rem;">${escaparHTML(p.nombre)}</b>
          <div style="font-size:0.75rem; color:var(--text-muted);">$${p.precioKg.toFixed(2)} (${esUnidad ? 'Unidad' : 'Kg'}) | ${escaparHTML(p.categoria)} | Stock: ${stockTxt}</div>
        </div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-editar-prod" style="background:var(--amber); color:#000; border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer;">Editar</button>
        <button class="btn-borrar-prod" style="background:var(--danger); color:#fff; border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer;">Borrar</button>
      </div>
    `;
    item.querySelector('.btn-editar-prod').addEventListener('click', () => abrirModalEditar(p.id));
    item.querySelector('.btn-borrar-prod').addEventListener('click', () => eliminarProductoAdmin(p.id));
    container.appendChild(item);
  });
}

function abrirModalEditar(id) {
  const p = productos.find(prod => prod.id === id);
  if (!p) return;

  imagenesBase64Temp.edit = null;
  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('edit-prod-nombre').value = p.nombre;
  document.getElementById('edit-prod-precio').value = p.precioKg;
  document.getElementById('edit-prod-categoria').value = p.categoria || 'Frutería';
  document.getElementById('edit-prod-tipo').value = p.tipoVenta || (p.categoria === 'Varios / Empaques' ? 'unidad' : 'peso');
  document.getElementById('edit-prod-stock').value = p.stockGramos !== undefined ? p.stockGramos : 10000;
  document.getElementById('edit-prod-codigo').value = p.codigoBarras || '';
  document.getElementById('edit-prod-dias').value = p.diasVida || 5;
  document.getElementById('edit-prod-fecha').value = p.fechaIngreso || hoyStr;
  document.getElementById('edit-prod-img-url').value = p.img.startsWith('data:') ? '' : p.img;
  document.getElementById('prev-edit-img').src = p.img;

  abrirModal('modal-editar-producto');
}

function guardarCambiosEdicion() {
  const id = parseInt(document.getElementById('edit-prod-id').value);
  let idx = productos.findIndex(p => p.id === id);
  if (idx === -1) return;

  productos[idx].nombre = document.getElementById('edit-prod-nombre').value.trim();
  productos[idx].precioKg = parseFloat(document.getElementById('edit-prod-precio').value) || 0;
  productos[idx].categoria = document.getElementById('edit-prod-categoria').value;
  productos[idx].tipoVenta = document.getElementById('edit-prod-tipo').value;
  productos[idx].stockGramos = parseInt(document.getElementById('edit-prod-stock').value) || 0;
  productos[idx].codigoBarras = document.getElementById('edit-prod-codigo').value.trim();
  productos[idx].diasVida = parseInt(document.getElementById('edit-prod-dias').value) || 5;
  productos[idx].fechaIngreso = document.getElementById('edit-prod-fecha').value || hoyStr;
  
  const imgUrlInput = document.getElementById('edit-prod-img-url').value.trim();
  if (imagenesBase64Temp.edit) productos[idx].img = imagenesBase64Temp.edit;
  else if (imgUrlInput) productos[idx].img = imgUrlInput;

  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  cerrarModal('modal-editar-producto');
  renderizarListaAdmin();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Cambios guardados", "exito");
}

function eliminarProductoAdmin(id) {
  productos = productos.filter(p => p.id !== id);
  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  renderizarListaAdmin();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Producto eliminado", "aviso");
}

function actualizarReporteAdmin() {
  let ventasHoy = ventasHistorial.filter(v => v.fecha === hoyStr);
  let totalUsd = ventasHoy.reduce((acc, v) => acc + v.totalUsd, 0);
  let totalBs = ventasHoy.reduce((acc, v) => acc + v.totalBs, 0);

  document.getElementById('rep-tickets').innerText = ventasHoy.length;
  document.getElementById('rep-total-usd').innerText = "$" + totalUsd.toFixed(2);
  document.getElementById('rep-total-bs').innerText = totalBs.toFixed(2) + " Bs";
}

function renderizarGraficoD3() {
  const container = document.getElementById('d3-chart-container');
  if (!container) return;
  container.innerHTML = '';
  
  const categoriasMap = {};
  productos.forEach(p => {
    let cat = p.categoria || 'Frutería';
    let valorEquiv = (p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques') ? (p.stockGramos || 0) : (p.stockGramos || 0) / 1000;
    categoriasMap[cat] = (categoriasMap[cat] || 0) + valorEquiv;
  });

  const dataset = Object.keys(categoriasMap).map(k => ({ categoria: k, stock: categoriasMap[k] }));
  if (dataset.length === 0) return;

  const width = container.clientWidth || 440;
  const height = 120;

  const svg = d3.select("#d3-chart-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleBand().range([20, width - 15]).domain(dataset.map(d => d.categoria)).padding(0.32);
  const y = d3.scaleLinear().range([height - 22, 18]).domain([0, d3.max(dataset, d => d.stock) || 10]);

  svg.selectAll(".barra")
    .data(dataset)
    .enter()
    .append("rect")
    .attr("x", d => x(d.categoria))
    .attr("y", d => y(d.stock))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.max(0, height - 22 - y(d.stock)))
    .attr("fill", "#10b981")
    .attr("rx", 5);

  svg.selectAll(".label-cat")
    .data(dataset)
    .enter()
    .append("text")
    .attr("x", d => x(d.categoria) + x.bandwidth() / 2)
    .attr("y", height - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "9px")
    .style("font-weight", "700")
    .style("fill", "#94a3b8")
    .text(d => d.categoria.length > 10 ? d.categoria.slice(0, 9) + '.' : d.categoria);

  svg.selectAll(".texto-barra")
    .data(dataset)
    .enter()
    .append("text")
    .attr("x", d => x(d.categoria) + x.bandwidth() / 2)
    .attr("y", d => y(d.stock) - 4)
    .attr("text-anchor", "middle")
    .style("font-size", "9px")
    .style("font-weight", "800")
    .style("fill", "#10b981")
    .text(d => d.stock.toFixed(1));
}

function exportarVentasCSV() {
  if (ventasHistorial.length === 0) { mostrarToast("Sin ventas para exportar", "aviso"); return; }
  let csv = "data:text/csv;charset=utf-8,Serial,Fecha,Hora,Articulos,TotalUSD,TotalBS,Estado\n";
  ventasHistorial.forEach(v => {
    csv += `${v.serial},${v.fecha},${v.hora},${v.cantProductos},${v.totalUsd.toFixed(2)},${v.totalBs.toFixed(2)},${v.estado}\n`;
  });
  descargarCSV(csv, `Ventas_POS_${hoyStr}.csv`);
}

function exportarProductosCSV() {
  let csv = "data:text/csv;charset=utf-8,ID,Nombre,Categoria,ModoVenta,PrecioUSD,Stock,CodigoBarras\n";
  productos.forEach(p => {
    csv += `${p.id},"${p.nombre}",${p.categoria},${p.tipoVenta || 'peso'},${p.precioKg},${p.stockGramos || 0},${p.codigoBarras || ''}\n`;
  });
  descargarCSV(csv, `Inventario_POS.csv`);
}

function descargarCSV(content, filename) {
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(content));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarToast(`Archivo ${filename} descargado`, "exito");
}
