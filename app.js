/* ==========================================================
   APP.JS - MOTOR SÚPER APP BÁSCULA POS 3D, OFERTAS & HARDWARE
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, query, where, getDocs, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsBnDGC_E_oSoKrewTbmkrmw2JAjdcalU",
  authDomain: "geomercado-9d642.firebaseapp.com",
  projectId: "geomercado-9d642",
  storageBucket: "geomercado-9d642.appspot.com",
  messagingSenderId: "521126894575",
  appId: "1:521126894575:web:4c847de3dd57d6a430b7a"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// Estado Global y Persistencia Segura
let tasaBCV = parseFloat(localStorage.getItem('bascula_tasa_bcv')) || 36.50;
// Hash SHA-256 por defecto de "1234"
let claveAdminHash = localStorage.getItem('bascula_clave_hash') || "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
let logoUrl = localStorage.getItem('bascula_logo_url') || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Shopping%20Cart.png";

// Datos Bancarios del Comercio
let datosPagoMovil = JSON.parse(localStorage.getItem('bascula_datos_pm')) || {
  banco: "0102 - Banco de Venezuela",
  rif: "V30629336",
  telefono: "04123167126"
};

// Configuración de Impresora Térmica y Rollo de Papel
let anchoPapelMM = localStorage.getItem('bascula_papel_ancho') || "58"; // "58" (32 col) o "80" (48 col)
let autoImprimirTicket = localStorage.getItem('bascula_auto_print') !== "false"; // true por defecto
let characteristicImpresoraActiva = null;
let nombreImpresoraActiva = "";

// Imagen fija de tu Código QR Bancario
let qrBancoImagenSrc = localStorage.getItem('bascula_qr_custom_img') || "";
let referenciasQuemadasLocal = JSON.parse(localStorage.getItem('bascula_refs_quemadas')) || [];

// Iconos 3D sin fondo para las 6 Categorías
const FLUENT_3D_BASE = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis";
const iconosCategoriasDefault = {
  "Frutería": `${FLUENT_3D_BASE}/Food/Red%20Apple.png`,
  "Verdulería": `${FLUENT_3D_BASE}/Food/Broccoli.png`,
  "Manicería": `${FLUENT_3D_BASE}/Food/Peanuts.png`,
  "Granos": `${FLUENT_3D_BASE}/Food/Beans.png`,
  "Charcutería": `${FLUENT_3D_BASE}/Food/Cheese%20Wedge.png`,
  "Varios / Empaques": `${FLUENT_3D_BASE}/Objects/Package.png`
};

let iconosCategorias3D = JSON.parse(localStorage.getItem('bascula_iconos_cat_3d')) || iconosCategoriasDefault;

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
let navegandoConBotonAtras = false;
const hoyStr = new Date().toISOString().split('T')[0];

// Catálogo Predeterminado (Con ejemplos de Ofertas Solo por Hoy activas)
const productosPredeterminados = [
  { id: 1, nombre: 'Manzana Roja 3D', categoria: 'Frutería', tipoVenta: 'peso', precioKg: 2.50, stockGramos: 15000, codigoBarras: '7591001', descuentoHoy: 15, diasVida: 7, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Red%20Apple.png` },
  { id: 2, nombre: 'Cambur / Banana', categoria: 'Frutería', tipoVenta: 'peso', precioKg: 1.20, stockGramos: 8000, codigoBarras: '7591002', descuentoHoy: 20, diasVida: 4, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Banana.png` },
  { id: 3, nombre: 'Fresa de Montaña', categoria: 'Frutería', tipoVenta: 'peso', precioKg: 3.80, stockGramos: 6000, codigoBarras: '7591010', descuentoHoy: 0, diasVida: 3, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Strawberry.png` },
  { id: 4, nombre: 'Zanahoria Fresca', categoria: 'Verdulería', tipoVenta: 'peso', precioKg: 1.80, stockGramos: 20000, codigoBarras: '7591003', descuentoHoy: 0, diasVida: 8, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Carrot.png` },
  { id: 5, nombre: 'Tomate Perita', categoria: 'Verdulería', tipoVenta: 'peso', precioKg: 3.00, stockGramos: 12000, codigoBarras: '7591004', descuentoHoy: 25, diasVida: 4, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Tomato.png` },
  { id: 6, nombre: 'Aguacate Criollo', categoria: 'Verdulería', tipoVenta: 'peso', precioKg: 3.20, stockGramos: 9000, codigoBarras: '7591011', descuentoHoy: 0, diasVida: 5, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Avocado.png` },
  { id: 7, nombre: 'Maní Tostado 250g', categoria: 'Manicería', tipoVenta: 'unidad', precioKg: 1.50, stockGramos: 40, codigoBarras: '7591005', descuentoHoy: 0, diasVida: 45, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Peanuts.png` },
  { id: 8, nombre: 'Caraotas Negras', categoria: 'Granos', tipoVenta: 'peso', precioKg: 2.20, stockGramos: 30000, codigoBarras: '7591006', descuentoHoy: 0, diasVida: 60, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Beans.png` },
  { id: 9, nombre: 'Queso Paisa', categoria: 'Charcutería', tipoVenta: 'peso', precioKg: 6.50, stockGramos: 6000, codigoBarras: '7591007', descuentoHoy: 10, diasVida: 10, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Cheese%20Wedge.png` },
  { id: 10, nombre: 'Pan / Casabe Empaque', categoria: 'Varios / Empaques', tipoVenta: 'unidad', precioKg: 2.00, stockGramos: 30, codigoBarras: '7591008', descuentoHoy: 0, diasVida: 60, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Flatbread.png` },
  { id: 11, nombre: 'Medio Cartón Huevos', categoria: 'Varios / Empaques', tipoVenta: 'unidad', precioKg: 2.80, stockGramos: 25, codigoBarras: '7591009', descuentoHoy: 15, diasVida: 15, fechaIngreso: hoyStr, img: `${FLUENT_3D_BASE}/Food/Egg.png` }
];

let productos = JSON.parse(localStorage.getItem('bascula_productos')) || productosPredeterminados;

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

// ==========================================================
// 7. MOTOR DE ACTUALIZACIÓN RÁPIDA TASA DÓLAR BCV
// ==========================================================
async function obtenerTasaBCV() {
  try {
    // 1. Intenta con la API principal (DolarVzla)
    const res = await fetch('https://rates.dolarvzla.com/bcv/current.json', { cache: 'no-store' });
    const data = await res.json();
    if (data && data.current && data.current.usd) {
      return parseFloat(data.current.usd);
    }
  } catch (e) {}

  try {
    // 2. Si falla, usa el respaldo (DolarApi Oficial)
    const res2 = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    const data2 = await res2.json();
    if (data2 && data2.promedio) {
      return parseFloat(data2.promedio);
    }
  } catch (e) {}

  return null;
}

async function sincronizarTasaBCV Ahora() {
  const btn = document.getElementById('btn-sincronizar');
  if (btn) btn.innerText = "Actualizando dólar BCV...";
  const nuevaTasa = await obtenerTasaBCV();
  if (nuevaTasa && !isNaN(nuevaTasa) && nuevaTasa > 0) {
    guardarTasaEnStorage(nuevaTasa);
  }
  if (btn) btn.innerText = "Sincronizar Tasa BCV en Tiempo Real";
}

// ==========================================================
// NORMALIZADORES BANCARIOS (SOPORTE COMAS BDV Y MACRODROID)
// ==========================================================
function parsearMontoVenezolano(valorRaw) {
  if (typeof valorRaw === 'number') return valorRaw;
  if (!valorRaw) return 0;
  let str = String(valorRaw).trim().replace(/[^\d.,]/g, '');
  if (!str) return 0;

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function extraerUltimos6Digitos(refRaw) {
  if (!refRaw) return "";
  const soloDigitos = String(refRaw).replace(/\D/g, '');
  return soloDigitos.slice(-6);
}

// ==========================================================
// NAVEGACIÓN NATIVA CON BOTÓN / GESTO "ATRÁS" DEL CELULAR
// ==========================================================
function empujarEstadoHistorial(vistaObj) {
  if (navegandoConBotonAtras) return;
  try {
    window.history.pushState(vistaObj, "");
  } catch (e) {}
}

function inicializarBotonAtrasNativo() {
  try {
    window.history.replaceState({ vista: 'inicio' }, "");
  } catch (e) {}

  window.addEventListener('popstate', () => {
    navegandoConBotonAtras = true;

    // Si el banner de instrucción de entrada está visible, quitarlo primero
    const overlayInst = document.getElementById('overlay-instruccion-entrada');
    if (overlayInst && overlayInst.style.display !== 'none') {
      ocultarInstruccionEntrada();
      navegandoConBotonAtras = false;
      return;
    }

    // 1. Si hay algún modal abierto, cerrarlo
    const modalesAbiertos = Array.from(document.querySelectorAll('.modal.show'));
    if (modalesAbiertos.length > 0) {
      const ultimoModal = modalesAbiertos[modalesAbiertos.length - 1];
      if (ultimoModal.id === 'modal-carrito' && unsubscribePagosVivo) {
        unsubscribePagosVivo();
        unsubscribePagosVivo = null;
      }
      cerrarModal(ultimoModal.id);
      navegandoConBotonAtras = false;
      return;
    }

    // 2. Si está dentro de una Categoría o búsqueda, volver a las 6 Categorías
    const vistaProductos = document.getElementById('vista-productos');
    if (vistaProductos && vistaProductos.style.display !== 'none') {
      mostrarCategorias(true);
      navegandoConBotonAtras = false;
      return;
    }

    // 3. Si está en la pantalla de Categorías del Kiosco
    const pantallaKiosco = document.getElementById('pantalla-kiosco');
    if (pantallaKiosco && pantallaKiosco.style.display !== 'none') {
      if (window.carrito.length > 0) {
        mostrarToast("Tienes productos en el carrito.", "aviso");
        try { window.history.pushState({ vista: 'categorias' }, ""); } catch (e) {}
      } else {
        reiniciarTodo(true);
      }
      navegandoConBotonAtras = false;
      return;
    }

    navegandoConBotonAtras = false;
  });
}

// ==========================================================
// BANNER FLOTANTE DE INSTRUCCIÓN AL ENTRAR
// ==========================================================
function mostrarInstruccionEntrada() {
  const overlay = document.getElementById('overlay-instruccion-entrada');
  if (!overlay) return;
  overlay.style.display = 'flex';
  anime({
    targets: '.instruccion-floating-card',
    translateY: [-35, 0],
    opacity: [0, 1],
    scale: [0.92, 1],
    duration: 420,
    easing: 'easeOutBack(1.2)'
  });
}

function ocultarInstruccionEntrada() {
  const overlay = document.getElementById('overlay-instruccion-entrada');
  if (!overlay || overlay.style.display === 'none') return;
  anime({
    targets: '.instruccion-floating-card',
    translateY: [0, -25],
    opacity: [1, 0],
    scale: [1, 0.94],
    duration: 220,
    easing: 'easeInQuad',
    complete: () => {
      overlay.style.display = 'none';
    }
  });
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

function precargarImagenes3D() {
  Object.values(iconosCategorias3D).forEach(url => {
    const img = new Image();
    img.src = url;
  });
  productos.forEach(p => {
    if (p.img && !p.img.startsWith('data:')) {
      const img = new Image();
      img.src = p.img;
    }
  });
}

function comprimirImagenPNGTransparente(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 300;
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function procesarSubidaQRBanco(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_QR = 600;
      let w = img.width;
      let h = img.height;
      if (w > h && w > MAX_QR) { h *= MAX_QR / w; w = MAX_QR; }
      else if (h > MAX_QR) { w *= MAX_QR / h; h = MAX_QR; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      
      qrBancoImagenSrc = canvas.toDataURL('image/png');
      localStorage.setItem('bascula_qr_custom_img', qrBancoImagenSrc);
      document.getElementById('adm-qr-url').value = '';
      actualizarVisorQRCarrito();
      mostrarToast("Imagen de tu QR bancario guardada", "exito");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function actualizarVisorQRCarrito() {
  const imgQR = document.getElementById('qr-custom-img');
  const placeholder = document.getElementById('qr-placeholder-aviso');
  if (!imgQR || !placeholder) return;

  if (qrBancoImagenSrc) {
    imgQR.src = qrBancoImagenSrc;
    imgQR.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    imgQR.style.display = 'none';
    placeholder.style.display = 'flex';
  }
}

function dibujarBarcodeSVGTicket(serialTexto) {
  const svg = document.getElementById('svg-ticket-barcode');
  if (!svg) return;
  svg.innerHTML = '';

  const str = String(serialTexto || 'TK000000');
  let xCursor = 12;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    for (let b = 0; b < 5; b++) {
      const anchoBarra = ((code >> b) & 1) ? 3.2 : 1.4;
      const espacio = (b % 2 === 0) ? 2.2 : 1.5;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xCursor);
      rect.setAttribute('y', 4);
      rect.setAttribute('width', anchoBarra);
      rect.setAttribute('height', 38);
      rect.setAttribute('fill', '#0f172a');
      svg.appendChild(rect);
      xCursor += anchoBarra + espacio;
    }
  }

  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', '120');
  txt.setAttribute('y', '54');
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', '#0f172a');
  txt.setAttribute('font-family', 'monospace');
  txt.setAttribute('font-size', '11');
  txt.setAttribute('font-weight', 'bold');
  txt.textContent = `* ${str} *`;
  svg.appendChild(txt);
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
  // Disparo inmediato de tasa BCV al abrir la app
  sincronizarTasaBCVAhora();

  aplicarLogo();
  actualizarDisplaysTasa();
  actualizarDisplayPeso();
  cargarDatosPagoMovilUI();
  actualizarVisorQRCarrito();
  renderizarTarjetasCategorias3D();
  renderizarOfertasSoloPorHoy();
  precargarImagenes3D();
  iniciarMonitoreoInactividad();
  inicializarBotonAtrasNativo();
  actualizarReporteAdmin();
  document.getElementById('adm-fecha-ingreso').value = hoyStr;

  // Cargar ajustes de Impresora y Papel en el Panel Admin
  const selectPapel = document.getElementById('adm-papel-ancho');
  const checkAutoPrint = document.getElementById('adm-auto-print');
  if (selectPapel) {
    selectPapel.value = anchoPapelMM;
    selectPapel.addEventListener('change', (e) => {
      anchoPapelMM = e.target.value;
      localStorage.setItem('bascula_papel_ancho', anchoPapelMM);
      mostrarToast(`Formato de papel fijado en ${anchoPapelMM}mm`, "exito");
    });
  }
  if (checkAutoPrint) {
    checkAutoPrint.checked = autoImprimirTicket;
    checkAutoPrint.addEventListener('change', (e) => {
      autoImprimirTicket = e.target.checked;
      localStorage.setItem('bascula_auto_print', String(autoImprimirTicket));
      mostrarToast(
        autoImprimirTicket
          ? "Impresión directa activada al finalizar"
          : "Modo sin papel activo: mostrará el ticket para tomar foto",
        "exito"
      );
    });
  }

  // Cerrar el banner flotante de instrucción al tocar cualquier parte
  document.getElementById('overlay-instruccion-entrada').addEventListener('click', ocultarInstruccionEntrada);
  document.getElementById('btn-cerrar-instruccion').addEventListener('click', (e) => {
    e.stopPropagation();
    ocultarInstruccionEntrada();
  });

  anime({
    targets: '#img-logo-bienvenida',
    translateY: [-8, 8],
    rotate: [-2, 2],
    direction: 'alternate',
    loop: true,
    easing: 'easeInOutSine',
    duration: 2600
  });

  // Navegación Kiosco
  document.getElementById('btn-comenzar').addEventListener('click', iniciarKiosco);
  document.getElementById('btn-simular-peso').addEventListener('click', () => {
    document.getElementById('input-peso-sim').value = pesoBrutoGramos;
    abrirModal('modal-peso-sim');
  });
  document.getElementById('btn-tara').addEventListener('click', aplicarTara);
  document.getElementById('btn-volver').addEventListener('click', () => mostrarCategorias(false));
  document.getElementById('btn-cart-float').addEventListener('click', abrirCarrito);

  // Botón Eliminar Todo el Carrito
  document.getElementById('btn-vaciar-carrito').addEventListener('click', vaciarTodoElCarrito);

  // Acceso Admin con Numpad Táctil
  document.getElementById('btn-acceso-admin').addEventListener('click', () => {
    abrirNumpad({
      titulo: "PIN de Administrador",
      maxLen: 8,
      secreto: true,
      onConfirm: (pin) => verificarPinAdmin(pin)
    });
  });

  // Hardware dentro del Panel Admin (Balanza BLE, Balanza USB e Impresora Térmica)
  document.getElementById('btn-conectar-ble').addEventListener('click', conectarBLE);
  document.getElementById('btn-conectar-usb').addEventListener('click', conectarUSBSerial);
  document.getElementById('btn-vincular-impresora-admin').addEventListener('click', vincularImpresoraBluetooth);

  // Configuración Admin y Subida de tu Imagen QR
  document.getElementById('btn-actualizar-tasa-header').addEventListener('click', sincronizarTasaBCVAhora);
  document.getElementById('btn-sincronizar').addEventListener('click', sincronizarTasaBCVAhora);
  document.getElementById('btn-guardar-tasa').addEventListener('click', guardarTasaManual);
  document.getElementById('btn-guardar-pm').addEventListener('click', guardarDatosPagoMovil);
  
  document.getElementById('btn-subir-qr-banco').addEventListener('click', () => document.getElementById('input-file-qr-banco').click());
  document.getElementById('input-file-qr-banco').addEventListener('change', (e) => procesarSubidaQRBanco(e.target.files[0]));
  document.getElementById('btn-guardar-qr-url').addEventListener('click', () => {
    const urlQR = document.getElementById('adm-qr-url').value.trim();
    if (!urlQR) { mostrarToast("Pega la URL de tu imagen QR o súbela de galería", "aviso"); return; }
    qrBancoImagenSrc = urlQR;
    localStorage.setItem('bascula_qr_custom_img', qrBancoImagenSrc);
    actualizarVisorQRCarrito();
    mostrarToast("URL de tu imagen QR fijada correctamente", "exito");
  });

  // Gestor de Iconos 3D sin fondo para Categorías
  const selectCat3D = document.getElementById('adm-cat-3d-select');
  const inputCat3DUrl = document.getElementById('adm-cat-3d-url');
  inputCat3DUrl.value = iconosCategorias3D[selectCat3D.value] || '';
  selectCat3D.addEventListener('change', () => {
    inputCat3DUrl.value = iconosCategorias3D[selectCat3D.value] || '';
  });

  document.getElementById('btn-galeria-cat3d').addEventListener('click', () => document.getElementById('input-file-cat3d').click());
  document.getElementById('input-file-cat3d').addEventListener('change', (e) => {
    comprimirImagenPNGTransparente(e.target.files[0], (dataUrl) => {
      const cat = selectCat3D.value;
      iconosCategorias3D[cat] = dataUrl;
      localStorage.setItem('bascula_iconos_cat_3d', JSON.stringify(iconosCategorias3D));
      renderizarTarjetasCategorias3D();
      mostrarToast(`Icono 3D de ${cat} actualizado`, "exito");
    });
  });

  document.getElementById('btn-guardar-cat3d').addEventListener('click', () => {
    const cat = selectCat3D.value;
    const url = inputCat3DUrl.value.trim();
    if (!url) { mostrarToast("Ingresa una URL PNG válida", "aviso"); return; }
    iconosCategorias3D[cat] = url;
    localStorage.setItem('bascula_iconos_cat_3d', JSON.stringify(iconosCategorias3D));
    renderizarTarjetasCategorias3D();
    mostrarToast(`Icono 3D de ${cat} actualizado`, "exito");
  });

  // Cambio automático a "Por Unidad" en "Varios / Empaques"
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

  // Carrito, Ampliación de tu QR y Botones de Copiado en 1 Toque
  document.getElementById('tab-pagomovil').addEventListener('click', () => cambiarMetodoPago('pagomovil'));
  document.getElementById('tab-divisas').addEventListener('click', () => cambiarMetodoPago('divisas'));
  
  document.getElementById('btn-ampliar-qr').addEventListener('click', () => {
    if (!qrBancoImagenSrc) {
      mostrarToast("Sube primero la imagen de tu QR desde el Panel Admin", "aviso");
      return;
    }
    document.getElementById('qr-fullscreen-img').src = qrBancoImagenSrc;
    document.getElementById('zoom-qr-monto-bs').innerText = "Bs. " + document.getElementById('cart-total-bs').innerText;
    abrirModal('modal-qr-fullscreen');
  });

  document.getElementById('btn-copiar-monto').addEventListener('click', () => {
    const montoTxt = document.getElementById('cart-total-bs').innerText;
    navigator.clipboard.writeText(montoTxt).then(() => mostrarToast(`Monto Bs. ${montoTxt} copiado`, "exito"));
  });

  document.querySelectorAll('.btn-icon-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-copy-target');
      const valor = document.getElementById(targetId).innerText.trim();
      navigator.clipboard.writeText(valor).then(() => mostrarToast(`Copiado: ${valor}`, "exito"));
    });
  });

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
  document.getElementById('btn-imprimir-bt').addEventListener('click', () => imprimirTicketBluetooth(false));
  document.getElementById('btn-repetir-pesaje').addEventListener('click', repetirPesaje);
  document.getElementById('btn-finalizar-salir').addEventListener('click', () => reiniciarTodo(false));
  document.getElementById('btn-exportar-ventas').addEventListener('click', exportarVentasCSV);
  document.getElementById('btn-exportar-catalogo').addEventListener('click', exportarProductosCSV);

  // Galería Productos
  document.getElementById('btn-galeria-add').addEventListener('click', () => document.getElementById('img-gallery-add').click());
  document.getElementById('img-gallery-add').addEventListener('change', (e) => {
    comprimirImagenPNGTransparente(e.target.files[0], (dataUrl) => {
      imagenesBase64Temp.add = dataUrl;
      document.getElementById('prev-add-img').src = dataUrl;
      document.getElementById('prev-add-box').style.display = 'block';
      document.getElementById('adm-img-url').value = '';
      mostrarToast("Imagen PNG 3D cargada", "exito");
    });
  });

  document.getElementById('btn-galeria-edit').addEventListener('click', () => document.getElementById('img-gallery-edit').click());
  document.getElementById('img-gallery-edit').addEventListener('change', (e) => {
    comprimirImagenPNGTransparente(e.target.files[0], (dataUrl) => {
      imagenesBase64Temp.edit = dataUrl;
      document.getElementById('prev-edit-img').src = dataUrl;
      document.getElementById('edit-prod-img-url').value = '';
      mostrarToast("Imagen PNG 3D actualizada", "exito");
    });
  });

  // Teclas Numpad
  document.querySelectorAll('.numpad-key').forEach(btn => {
    btn.addEventListener('click', () => procesarTeclaNumpad(btn.dataset.key));
  });
  document.getElementById('btn-numpad-ok').addEventListener('click', () => {
    cerrarModal('modal-numpad');
    if (typeof numpadCallback === 'function') numpadCallback(numpadValorActual);
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

  // Atajos de teclado físico
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4') {
      e.preventDefault();
      abrirCarrito();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => cerrarModal(m.id));
    }
  });
});

window.addEventListener('focus', () => sincronizarTasaBCVAhora());

// ==========================================================
// 6. VITRINA "¡OFERTAS SOLO POR HOY!" EN PANTALLA PRINCIPAL
// ==========================================================
function calcularEstadoOferta(p) {
  // Prioridad 1: Descuento directo asignado en "Oferta Solo por Hoy"
  const descHoy = parseInt(p.descuentoHoy) || 0;
  if (descHoy > 0 && descHoy <= 90) {
    return {
      descuento: descHoy,
      etiqueta: `HOY -${descHoy}%`,
      precioFinal: p.precioKg * (1 - descHoy / 100)
    };
  }

  // Prioridad 2: Descuento automático por frescura del lote
  if (!p.fechaIngreso || !p.diasVida) return { descuento: 0, etiqueta: '', precioFinal: p.precioKg };
  const fIngreso = new Date(p.fechaIngreso);
  const fHoy = new Date();
  const diasTranscurridos = Math.floor(Math.abs(fHoy - fIngreso) / (1000 * 60 * 60 * 24));
  const diasRestantes = p.diasVida - diasTranscurridos;

  if (diasRestantes <= 0) return { descuento: 50, etiqueta: 'REMATE -50%', precioFinal: p.precioKg * 0.50 };
  if (diasRestantes === 1) return { descuento: 20, etiqueta: 'OFERTA -20%', precioFinal: p.precioKg * 0.80 };
  return { descuento: 0, etiqueta: '', precioFinal: p.precioKg };
}

function renderizarOfertasSoloPorHoy() {
  const seccion = document.getElementById('seccion-ofertas-hoy');
  const contenedor = document.getElementById('grid-ofertas-hoy');
  if (!seccion || !contenedor) return;

  contenedor.innerHTML = '';
  const productosEnOferta = productos.filter(p => {
    const est = calcularEstadoOferta(p);
    return est.descuento > 0 && (p.stockGramos === undefined || p.stockGramos > 0);
  });

  if (productosEnOferta.length === 0) {
    seccion.style.display = 'none';
    return;
  }

  if (categoriaSeleccionada === "") {
    seccion.style.display = 'block';
  }

  productosEnOferta.forEach(p => {
    const esPorUnidad = p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques';
    const sufijo = esPorUnidad ? '/u' : '/kg';
    const est = calcularEstadoOferta(p);
    const precioBs = est.precioFinal * tasaBCV;

    const card = document.createElement('div');
    card.className = 'card-oferta-hoy';
    card.innerHTML = `
      <img src="${escaparHTML(p.img)}" alt="${escaparHTML(p.nombre)}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1046/1046857.png'">
      <div class="oferta-hoy-info">
        <span class="oferta-hoy-tag">${est.etiqueta}</span>
        <h5>${escaparHTML(p.nombre)}</h5>
        <div class="oferta-hoy-precio">$${est.precioFinal.toFixed(2)}${sufijo} <small class="precio-tachado">$${p.precioKg.toFixed(2)}</small></div>
        <div class="oferta-hoy-bs">Bs. ${precioBs.toFixed(2)}${sufijo}</div>
      </div>
    `;
    card.addEventListener('click', () => seleccionarProducto(p.id));
    contenedor.appendChild(card);
  });
}

// ==========================================================
// RENDERIZADO VISUAL 3D DE CATEGORÍAS Y QUICK-TABS
// ==========================================================
function renderizarTarjetasCategorias3D() {
  const gridCats = document.getElementById('vista-categorias');
  const barQuick = document.getElementById('barra-quick-cats');
  if (!gridCats || !barQuick) return;

  gridCats.innerHTML = '';
  barQuick.innerHTML = '';

  const listaCategorias = ["Frutería", "Verdulería", "Manicería", "Granos", "Charcutería", "Varios / Empaques"];

  listaCategorias.forEach(cat => {
    const img3D = iconosCategorias3D[cat] || iconosCategoriasDefault[cat];
    const cantItems = productos.filter(p => p.categoria === cat).length;

    const card = document.createElement('div');
    card.className = 'card-categoria';
    card.innerHTML = `
      <img src="${escaparHTML(img3D)}" alt="${escaparHTML(cat)}" class="img-3d-cat" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1046/1046857.png'">
      <h3>${escaparHTML(cat)}</h3>
      <span class="cat-sub-count">${cantItems} productos</span>
    `;
    card.addEventListener('click', () => filtrarPorCategoria(cat));
    gridCats.appendChild(card);

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `quick-cat-pill ${categoriaSeleccionada === cat ? 'active' : ''}`;
    pill.dataset.cat = cat;
    pill.innerHTML = `
      <img src="${escaparHTML(img3D)}" alt="">
      <span>${escaparHTML(cat)}</span>
    `;
    pill.addEventListener('click', () => filtrarPorCategoria(cat));
    barQuick.appendChild(pill);
  });
}

function actualizarEstadoQuickPills() {
  document.querySelectorAll('.quick-cat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.cat === categoriaSeleccionada);
  });
}

function guardarTasaEnStorage(valor) {
  tasaBCV = valor;
  localStorage.setItem('bascula_tasa_bcv', tasaBCV);
  actualizarDisplaysTasa();
  renderizarOfertasSoloPorHoy();
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
  mostrarToast("Datos de Pago Móvil actualizados", "exito");
}

// ==========================================================
// GESTIÓN DE MODALES Y BALANZA
// ==========================================================
function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const yaAbierto = el.classList.contains('show');
  el.style.display = 'flex';
  requestAnimationFrame(() => {
    el.classList.add('show');
    if (!yaAbierto) {
      empujarEstadoHistorial({ modal: id });
    }
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
  if (!el || !el.classList.contains('show')) return;
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
      reiniciarTodo(false);
    }
  }, 120000);
}

// ==========================================================
// CATÁLOGO Y COMPRA HÍBRIDA CON ESCENARIO 3D
// ==========================================================
function iniciarKiosco() {
  empujarEstadoHistorial({ vista: 'categorias' });
  anime({
    targets: '#pantalla-inicio',
    opacity: [1, 0],
    scale: [1, 1.03],
    duration: 300,
    easing: 'easeInOutQuad',
    complete: () => {
      document.getElementById('pantalla-inicio').style.display = 'none';
      const kiosco = document.getElementById('pantalla-kiosco');
      kiosco.style.display = 'flex';
      anime({ targets: kiosco, opacity: [0, 1], duration: 360, easing: 'easeOutQuad' });
      mostrarCategorias(true);
      // Mostrar notificación flotante de instrucción al entrar
      mostrarInstruccionEntrada();
    }
  });
}

function mostrarCategorias(desdeHistorial = false) {
  if (!desdeHistorial && categoriaSeleccionada !== "") {
    empujarEstadoHistorial({ vista: 'categorias' });
  }
  categoriaSeleccionada = "";
  document.getElementById('input-buscar').value = "";
  document.getElementById('titulo-seccion').innerText = "Seleccione una Categoría";
  document.getElementById('btn-volver').style.display = 'none';
  document.getElementById('barra-quick-cats').style.display = 'none';
  document.getElementById('vista-categorias').style.display = 'grid';
  document.getElementById('vista-productos').style.display = 'none';

  renderizarTarjetasCategorias3D();
  renderizarOfertasSoloPorHoy();

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
  ocultarInstruccionEntrada();
  if (categoriaSeleccionada !== cat) {
    empujarEstadoHistorial({ vista: 'productos', categoria: cat });
  }
  categoriaSeleccionada = cat;
  document.getElementById('input-buscar').value = "";
  document.getElementById('titulo-seccion').innerText = cat;
  document.getElementById('btn-volver').style.display = 'flex';
  document.getElementById('seccion-ofertas-hoy').style.display = 'none';
  document.getElementById('barra-quick-cats').style.display = 'flex';
  document.getElementById('vista-categorias').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'grid';
  
  actualizarEstadoQuickPills();
  renderizarProductosGrid(productos.filter(p => p.categoria === cat));
}

function buscarProductosDirecto() {
  ocultarInstruccionEntrada();
  let texto = document.getElementById('input-buscar').value.toLowerCase().trim();
  if (texto.length > 0) {
    if (document.getElementById('vista-productos').style.display === 'none') {
      empujarEstadoHistorial({ vista: 'busqueda' });
    }
    document.getElementById('seccion-ofertas-hoy').style.display = 'none';
    document.getElementById('vista-categorias').style.display = 'none';
    document.getElementById('barra-quick-cats').style.display = 'flex';
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
    mostrarCategorias(true);
  }
}

function renderizarProductosGrid(lista) {
  const grid = document.getElementById('vista-productos');
  grid.innerHTML = '';
  if (lista.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--text-muted); font-weight:700;">No se encontraron productos en esta sección.</p>';
    return;
  }

  lista.forEach(p => {
    const esPorUnidad = p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques';
    const sufijoUnidad = esPorUnidad ? '/unid' : '/kg';
    const estadoOferta = calcularEstadoOferta(p);
    let precioEfectivo = estadoOferta.precioFinal;
    let precioBs = precioEfectivo * tasaBCV;

    let badgeHtml = estadoOferta.descuento > 0 ? `<div class="${estadoOferta.descuento >= 40 ? 'badge-remate' : 'badge-oferta'}">${estadoOferta.etiqueta}</div>` : '';
    let barcodeHtml = p.codigoBarras ? `<div class="badge-barcode">#${escaparHTML(p.codigoBarras)}</div>` : '';

    let stockVal = p.stockGramos !== undefined ? p.stockGramos : 10000;
    let stockTexto = esPorUnidad ? `${stockVal} unid.` : `${(stockVal / 1000).toFixed(1)}kg`;
    let stockHtml = stockVal <= 0 
      ? `<div class="badge-stock stock-out">AGOTADO</div>` 
      : (esPorUnidad ? stockVal < 5 : stockVal < 2000)
        ? `<div class="badge-stock stock-low">Quedan ${stockTexto}</div>` 
        : `<div class="badge-stock stock-ok">Stock: ${stockTexto}</div>`;

    const textoBotonElegir = esPorUnidad ? 'Elegir Unidades' : 'Pesar y Agregar';

    const card = document.createElement('div');
    card.className = 'card-producto';
    card.innerHTML = `
      ${badgeHtml}
      ${barcodeHtml}
      <div class="stage-3d">
        <img src="${escaparHTML(p.img)}" alt="${escaparHTML(p.nombre)}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1046/1046857.png'">
      </div>
      <h4>${escaparHTML(p.nombre)}</h4>
      <div style="width:100%;">
        <div class="precio-usd">$${precioEfectivo.toFixed(2)} ${sufijoUnidad} ${estadoOferta.descuento > 0 ? `<small class="precio-tachado">$${p.precioKg.toFixed(2)}</small>` : ''}</div>
        <div class="precio-bs">Bs. ${precioBs.toFixed(2)} ${sufijoUnidad}</div>
        ${stockHtml}
        <div class="btn-touch-elegir">
          <span>${textoBotonElegir}</span>
        </div>
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
  ocultarInstruccionEntrada();
  productoTemp = productos.find(p => p.id === id);
  if (!productoTemp) return;

  const esPorUnidad = productoTemp.tipoVenta === 'unidad' || productoTemp.categoria === 'Varios / Empaques';
  let stockDisponible = productoTemp.stockGramos !== undefined ? productoTemp.stockGramos : 10000;
  if (stockDisponible <= 0) {
    mostrarToast(`"${productoTemp.nombre}" está agotado`, "error");
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
  clon.style.left = `${rectOrigen.left + rectOrigen.width / 2 - 32}px`;
  clon.style.top = `${rectOrigen.top + rectOrigen.height / 2 - 32}px`;
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
// 5. CARRITO, BOTÓN VACIAR TODO Y ESCUCHA EN VIVO
// ==========================================================
function vaciarTodoElCarrito() {
  if (window.carrito.length === 0) {
    mostrarToast("El carrito ya está vacío", "aviso");
    return;
  }
  window.carrito = [];
  reproducirSonido('beep');
  actualizarCarritoBadge();
  abrirCarrito();
  mostrarToast("Se eliminaron todos los artículos del carrito", "aviso");
}

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
  actualizarVisorQRCarrito();
}

function abrirCarrito() {
  ocultarInstruccionEntrada();
  const contenedor = document.getElementById('lista-carrito');
  const btnVaciar = document.getElementById('btn-vaciar-carrito');
  contenedor.innerHTML = '';
  let pesoEsperadoTotal = 0;

  if (window.carrito.length === 0) {
    if (btnVaciar) btnVaciar.style.display = 'none';
    contenedor.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:15px; font-weight:700;">El carrito está vacío</p>';
  } else {
    if (btnVaciar) btnVaciar.style.display = 'inline-flex';
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

// Quemado de pago compatible con tus reglas de Firestore (canjeado_en_junride == true)
async function quemarPagoEnFirestore(docSnap) {
  const docId = docSnap.id;
  if (!referenciasQuemadasLocal.includes(docId)) {
    referenciasQuemadasLocal.push(docId);
    localStorage.setItem('bascula_refs_quemadas', JSON.stringify(referenciasQuemadasLocal));
  }

  try {
    await updateDoc(docSnap.ref, {
      canjeado_en_junride: true,
      estado: "PROCESADO",
      fecha_procesado: new Date().toISOString()
    });
  } catch (errSdk) {
    try {
      const data = docSnap.data();
      const restUrl = `https://firestore.googleapis.com/v1/projects/geomercado-9d642/databases/(default)/documents/verificacion_pagos/${docId}?updateMask.fieldPaths=canjeado_en_junride&updateMask.fieldPaths=estado&updateMask.fieldPaths=monto&updateMask.fieldPaths=referencia_6digitos`;
      await fetch(restUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            canjeado_en_junride: { booleanValue: true },
            estado: { stringValue: "PROCESADO" },
            monto: { stringValue: String(data.monto || "") },
            referencia_6digitos: { stringValue: String(data.referencia_6digitos || "") }
          }
        })
      });
    } catch (errRest) {}
  }
}

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

        if (data.canjeado_en_junride === true || data.estado === "PROCESADO" || referenciasQuemadasLocal.includes(docSnap.id)) {
          return;
        }

        const montoPago = parsearMontoVenezolano(data.monto || data.monto_bs || 0);
        if (montoPago > 0 && Math.abs(montoPago - totalBsRequerido) <= 1.50) {
          if (unsubscribePagosVivo) { unsubscribePagosVivo(); unsubscribePagosVivo = null; }
          await quemarPagoEnFirestore(docSnap);
          reproducirSonido('scan');
          mostrarToast("¡Pago Móvil BDV detectado automáticamente!", "exito");
          cerrarModal('modal-carrito');
          generarTicket('PAGADO');
        }
      }
    });
  }, () => {});
}

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
  const refInput = extraerUltimos6Digitos(rawInput);

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

        if (data.estado === "PROCESADO" || data.canjeado_en_junride === true || referenciasQuemadasLocal.includes(docSnap.id)) {
          msgDiv.className = "msg-error";
          msgDiv.innerText = "Esta referencia ya fue utilizada anteriormente.";
          continue;
        }

        let montoRegistrado = parsearMontoVenezolano(data.monto || data.monto_bs || 0);
        if (montoRegistrado > 0 && Math.abs(montoRegistrado - totalBsRequerido) > 1.50) {
          msgDiv.className = "msg-error";
          msgDiv.innerText = `Monto diferente. Recibido: Bs. ${montoRegistrado.toFixed(2)} | Requerido: Bs. ${totalBsRequerido.toFixed(2)}`;
          break;
        }

        await quemarPagoEnFirestore(docSnap);

        msgDiv.className = "msg-exito";
        msgDiv.innerText = "¡Pago Confirmado Exitosamente!";
        reproducirSonido('scan');

        setTimeout(() => {
          cerrarModal('modal-carrito');
          generarTicket('PAGADO');
        }, 500);
        return;
      }
    } else {
      msgDiv.className = "msg-error";
      msgDiv.innerText = "Referencia aún no recibida. Verifique los 6 dígitos.";
    }
  } catch (error) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "Error de conexión al consultar la referencia.";
  } finally {
    btnValidar.disabled = false;
  }
}

// ==========================================================
// 3 y 4. EMISIÓN DE TICKET AUTOMÁTICO + MODOS 58MM / 80MM / SIN ROLLO
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

  datosUltimoTicket = {
    serial: numSerial,
    fecha: fechaHora,
    tasa: tasaBCV,
    estado: estadoPago,
    aplicaIGTF,
    baseUsd,
    items: [...window.carrito],
    totalUsd,
    totalBs
  };

  let esPagado = estadoPago === 'PAGADO';
  let badgeEstadoText = esPagado ? "[ AUTOPAGO VERIFICADO - SALIDA AUTORIZADA ]" : "[ PENDIENTE DE PAGO - PASAR POR CAJA ]";

  let html = `
    <div style="text-align:center; margin-bottom:8px;">
      <b>BÁSCULA POS</b><br>
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
  dibujarBarcodeSVGTicket(numSerial);

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
  renderizarOfertasSoloPorHoy();

  window.carrito = [];
  actualizarCarritoBadge();

  // Configurar textos según si está activo el modo de impresión automática o el modo sin rollo (foto)
  const tituloModal = document.getElementById('titulo-modal-ticket');
  const subModal = document.getElementById('subtitulo-modal-ticket');
  const btnImprimirManual = document.getElementById('btn-imprimir-bt');

  if (autoImprimirTicket) {
    tituloModal.innerText = "¡Retire su Ticket Impreso!";
    subModal.innerText = "Enviando comprobante directamente a la impresora térmica...";
    btnImprimirManual.style.display = 'inline-flex';
    abrirModal('modal-ticket');
    // Dispara la impresión de una vez sin preguntar
    imprimirTicketBluetooth(true);
  } else {
    // Modo Ahorro / Sin Rollo de Papel: Para que el cliente tome foto al ticket en pantalla
    tituloModal.innerText = "📸 ¡Tome una Foto a su Ticket!";
    subModal.innerText = "Modo sin papel activo: Capture una foto de este comprobante para su salida.";
    btnImprimirManual.style.display = 'none';
    abrirModal('modal-ticket');
  }
}

// Formateador de texto térmico según el ancho del rollo (58mm = 32 col | 80mm = 48 col)
function construirTextoTermico(ticket) {
  const cols = anchoPapelMM === "80" ? 48 : 32;
  const lineaIgual = "=".repeat(cols) + "\n";
  const lineaGuion = "-".repeat(cols) + "\n";

  const centrar = (txt) => {
    if (txt.length >= cols) return txt.slice(0, cols) + "\n";
    const pad = Math.floor((cols - txt.length) / 2);
    return " ".repeat(pad) + txt + "\n";
  };

  let out = lineaIgual;
  out += centrar("BASCULA POS");
  out += lineaIgual;
  out += `FECHA: ${ticket.fecha}\n`;
  out += `SERIAL: ${ticket.serial}\n`;
  out += `TASA BCV: ${ticket.tasa.toFixed(2)} Bs/$\n`;
  out += `ESTADO: [ ${ticket.estado} ]\n`;
  out += lineaGuion;

  ticket.items.forEach(item => {
    const cant = item.tipoVenta === 'unidad' ? `${item.unidades}u` : `${item.peso}g`;
    out += `${item.nombre} (${cant})\n`;
    out += `USD: $${item.subtotalUsd.toFixed(2)} | Bs. ${item.subtotalBs.toFixed(2)}\n`;
  });

  if (ticket.aplicaIGTF) {
    out += `IGTF Divisas (3%): +$${(ticket.baseUsd * 0.03).toFixed(2)}\n`;
  }

  out += lineaGuion;
  out += `TOTAL USD: $${ticket.totalUsd.toFixed(2)}\n`;
  out += `TOTAL BS:  Bs. ${ticket.totalBs.toFixed(2)}\n`;
  out += lineaIgual + "\n\n\n";
  return out;
}

// Vincular impresora desde el Panel Admin para que quede lista para imprimir sin preguntar
async function vincularImpresoraBluetooth() {
  if (!navigator.bluetooth) {
    mostrarToast("Web Bluetooth no soportado en este navegador", "error");
    return false;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000e025-0000-1000-8000-00805f9b34fb']
    });
    const server = await device.gatt.connect();
    let service;
    try { service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb'); }
    catch (e) { service = await server.getPrimaryService('0000e025-0000-1000-8000-00805f9b34fb'); }

    characteristicImpresoraActiva = (await service.getCharacteristics())[0];
    nombreImpresoraActiva = device.name || "Térmica BT";

    const lbl = document.getElementById('lbl-estado-impresora');
    if (lbl) lbl.innerText = `Conectada: ${nombreImpresoraActiva}`;
    mostrarToast(`Impresora "${nombreImpresoraActiva}" lista (${anchoPapelMM}mm)`, "exito");
    return true;
  } catch (err) {
    mostrarToast("No se seleccionó impresora Bluetooth", "aviso");
    return false;
  }
}

async function imprimirTicketBluetooth(esAutomatico = false) {
  if (!datosUltimoTicket) { mostrarToast("No hay ticket activo", "aviso"); return; }

  try {
    // Si ya vinculaste la impresora en el Panel Admin, imprime directo en 0.1s sin ventana emergente
    if (!characteristicImpresoraActiva) {
      const conectado = await vincularImpresoraBluetooth();
      if (!conectado) return;
    }

    const textoFormateado = construirTextoTermico(datosUltimoTicket);
    const bytes = (new TextEncoder()).encode(textoFormateado);

    // Envío fragmentado seguro (chunks de 100 bytes) para soportar rollos largos sin saturar el buffer BLE
    const CHUNK_SIZE = 100;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      await characteristicImpresoraActiva.writeValue(chunk);
    }

    mostrarToast(`Ticket impreso (${anchoPapelMM}mm)`, "exito");
  } catch (err) {
    characteristicImpresoraActiva = null;
    const lbl = document.getElementById('lbl-estado-impresora');
    if (lbl) lbl.innerText = "Conectar Impresora";
    if (!esAutomatico) {
      mostrarToast("Reconectando impresora térmica...", "aviso");
    }
  }
}

// ==========================================================
// CONEXIÓN HARDWARE BALANZA (DESDE EL PANEL ADMIN)
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

function repetirPesaje() { cerrarModal('modal-ticket'); }

function reiniciarTodo(desdeHistorial = false) {
  if (unsubscribePagosVivo) { unsubscribePagosVivo(); unsubscribePagosVivo = null; }
  ocultarInstruccionEntrada();
  window.carrito = []; taraGramos = 0; datosUltimoTicket = null;
  actualizarCarritoBadge();
  document.querySelectorAll('.modal').forEach(m => {
    m.classList.remove('show');
    m.style.display = 'none';
  });
  mostrarCategorias(true);
  
  document.getElementById('pantalla-kiosco').style.display = 'none';
  const inicio = document.getElementById('pantalla-inicio');
  inicio.style.display = 'flex';
  if (!desdeHistorial) {
    try { window.history.replaceState({ vista: 'inicio' }, ""); } catch (e) {}
  }
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
  const descuentoHoy = parseInt(document.getElementById('adm-descuento-hoy').value) || 0;
  const diasVida = parseInt(document.getElementById('adm-dias-vida').value) || 5;
  const fechaIngreso = document.getElementById('adm-fecha-ingreso').value || hoyStr;
  const imgUrlInput = document.getElementById('adm-img-url').value.trim();

  if (!nombre || isNaN(precio)) {
    mostrarToast("Nombre y precio son obligatorios", "error");
    return;
  }

  const imgFinal = imagenesBase64Temp.add || imgUrlInput || iconosCategorias3D[categoria] || 'https://cdn-icons-png.flaticon.com/512/1046/1046857.png';
  productos.push({ id: Date.now(), nombre, categoria, tipoVenta, precioKg: precio, stockGramos, codigoBarras, descuentoHoy, diasVida, fechaIngreso, img: imgFinal });
  localStorage.setItem('bascula_productos', JSON.stringify(productos));

  document.getElementById('adm-nombre').value = '';
  document.getElementById('adm-precio').value = '';
  document.getElementById('adm-codigo-barras').value = '';
  document.getElementById('adm-descuento-hoy').value = '0';
  document.getElementById('adm-img-url').value = '';
  document.getElementById('prev-add-box').style.display = 'none';
  imagenesBase64Temp.add = null;

  renderizarListaAdmin();
  renderizarTarjetasCategorias3D();
  renderizarOfertasSoloPorHoy();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Producto 3D guardado en catálogo", "exito");
}

function renderizarListaAdmin() {
  const container = document.getElementById('lista-admin-productos');
  container.innerHTML = '';
  document.getElementById('contador-inventario').innerText = productos.length;

  productos.forEach(p => {
    const esUnidad = p.tipoVenta === 'unidad' || p.categoria === 'Varios / Empaques';
    const stockTxt = esUnidad ? `${p.stockGramos || 0} unid.` : `${((p.stockGramos || 0) / 1000).toFixed(1)}kg`;
    const descTxt = p.descuentoHoy > 0 ? ` | 🔥 Oferta -${p.descuentoHoy}%` : '';
    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#070c14; padding:8px 12px; border-radius:10px; border:1px solid var(--border-glass);";
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${escaparHTML(p.img)}" style="width:38px; height:38px; object-fit:contain;">
        <div>
          <b style="font-size:0.88rem;">${escaparHTML(p.nombre)}</b>
          <div style="font-size:0.75rem; color:var(--text-muted);">$${p.precioKg.toFixed(2)} (${esUnidad ? 'Unidad' : 'Kg'}) | ${escaparHTML(p.categoria)} | Stock: ${stockTxt}${descTxt}</div>
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
  document.getElementById('edit-prod-descuento-hoy').value = p.descuentoHoy || 0;
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
  productos[idx].descuentoHoy = parseInt(document.getElementById('edit-prod-descuento-hoy').value) || 0;
  productos[idx].diasVida = parseInt(document.getElementById('edit-prod-dias').value) || 5;
  productos[idx].fechaIngreso = document.getElementById('edit-prod-fecha').value || hoyStr;
  
  const imgUrlInput = document.getElementById('edit-prod-img-url').value.trim();
  if (imagenesBase64Temp.edit) productos[idx].img = imagenesBase64Temp.edit;
  else if (imgUrlInput) productos[idx].img = imgUrlInput;

  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  cerrarModal('modal-editar-producto');
  renderizarListaAdmin();
  renderizarTarjetasCategorias3D();
  renderizarOfertasSoloPorHoy();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Cambios guardados", "exito");
}

function eliminarProductoAdmin(id) {
  productos = productos.filter(p => p.id !== id);
  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  renderizarListaAdmin();
  renderizarTarjetasCategorias3D();
  renderizarOfertasSoloPorHoy();
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
  let csv = "data:text/csv;charset=utf-8,ID,Nombre,Categoria,ModoVenta,PrecioUSD,Stock,DescuentoHoy,CodigoBarras\n";
  productos.forEach(p => {
    csv += `${p.id},"${p.nombre}",${p.categoria},${p.tipoVenta || 'peso'},${p.precioKg},${p.stockGramos || 0},${p.descuentoHoy || 0},${p.codigoBarras || ''}\n`;
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
