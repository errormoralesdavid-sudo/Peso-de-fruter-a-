/* ==========================================================
   APP.JS - LÓGICA PRINCIPAL KIOSCO BÁSCULA POS PWA PRO
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Estado Global
let tasaBCV = parseFloat(localStorage.getItem('bascula_tasa_bcv')) || 36.50;
// Hash SHA-256 por defecto de "1234"
let claveAdminHash = localStorage.getItem('bascula_clave_hash') || "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
let logoUrl = localStorage.getItem('bascula_logo_url') || "https://cdn-icons-png.flaticon.com/512/1046/1046857.png";
let pesoBrutoGramos = 0;
let taraGramos = 0;
window.carrito = [];
let productoTemp = null;
let categoriaSeleccionada = "";
let temporizadorInactividad = null;
let datosUltimoTicket = null;
let ventasHistorial = JSON.parse(localStorage.getItem('bascula_ventas_historial')) || [];
let imagenesBase64Temp = { add: null, edit: null };
const hoyStr = new Date().toISOString().split('T')[0];

const productosPredeterminados = [
  { id: 1, nombre: 'Manzana Red', categoria: 'Frutería', precioKg: 2.50, stockGramos: 15000, codigoBarras: '7591001', diasVida: 7, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300' },
  { id: 2, nombre: 'Cambur / Banana', categoria: 'Frutería', precioKg: 1.20, stockGramos: 8000, codigoBarras: '7591002', diasVida: 3, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300' },
  { id: 3, nombre: 'Zanahoria', categoria: 'Verdulería', precioKg: 1.80, stockGramos: 20000, codigoBarras: '7591003', diasVida: 8, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1598170845058-12ef4a457939?w=300' },
  { id: 4, nombre: 'Tomate', categoria: 'Verdulería', precioKg: 3.00, stockGramos: 12000, codigoBarras: '7591004', diasVida: 4, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300' },
  { id: 5, nombre: 'Maní Salado (Bolsa)', categoria: 'Manicería', precioKg: 4.00, stockGramos: 5000, codigoBarras: '7591005', diasVida: 30, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1567892568620-80d8591325d7?w=300' },
  { id: 6, nombre: 'Caraotas Negras', categoria: 'Granos', precioKg: 2.20, stockGramos: 30000, codigoBarras: '7591006', diasVida: 60, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=300' },
  { id: 7, nombre: 'Queso Paisa', categoria: 'Charcutería', precioKg: 6.50, stockGramos: 6000, codigoBarras: '7591007', diasVida: 10, fechaIngreso: hoyStr, img: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300' }
];

let productos = JSON.parse(localStorage.getItem('bascula_productos')) || productosPredeterminados;

// Audio Sintetizado Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function reproducirSonido(tipo) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (tipo === 'beep') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
  } else if (tipo === 'balanza') {
    osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  } else if (tipo === 'scan') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  }
}

// Sanitizador contra XSS
function escaparHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Hash SHA-256 para PIN seguro
async function calcularHashSHA256(mensaje) {
  const msgBuffer = new TextEncoder().encode(mensaje);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compresor de imágenes de Galería a Base64 ligero (250x250 JPEG 0.7)
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

      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

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
      mostrarToast("Imagen optimizada y cargada", "exito");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
    translateY: [-20, 0],
    duration: 400,
    easing: 'easeOutExpo'
  });

  setTimeout(() => {
    anime({
      targets: toast,
      opacity: [1, 0],
      translateY: [0, -20],
      duration: 300,
      easing: 'easeInExpo',
      complete: () => toast.remove()
    });
  }, 3200);
}

// Registro de Service Worker para PWA en GitHub
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Inicialización DOM
document.addEventListener('DOMContentLoaded', () => {
  aplicarLogo();
  actualizarDisplaysTasa();
  actualizarDisplayPeso();
  obtenerTasaBCVOnline();
  iniciarMonitoreoInactividad();
  actualizarReporteAdmin();
  document.getElementById('adm-fecha-ingreso').value = hoyStr;
  
  if (localStorage.getItem('bascula_modo_oscuro') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('btn-tema').innerText = '☀️';
  }

  // Animación continua suave del logo de bienvenida con Anime.js
  anime({
    targets: '#img-logo-bienvenida',
    translateY: [-8, 8],
    direction: 'alternate',
    loop: true,
    easing: 'easeInOutSine',
    duration: 2500
  });

  // Listeners principales
  document.getElementById('btn-comenzar').addEventListener('click', iniciarKiosco);
  document.getElementById('btn-tema').addEventListener('click', toggleModoOscuro);
  document.getElementById('btn-simular-peso').addEventListener('click', () => {
    document.getElementById('input-peso-sim').value = pesoBrutoGramos;
    abrirModal('modal-peso-sim');
  });
  document.getElementById('btn-tara').addEventListener('click', aplicarTara);
  document.getElementById('btn-volver').addEventListener('click', mostrarCategorias);
  document.getElementById('btn-cart-float').addEventListener('click', abrirCarrito);
  document.getElementById('btn-acceso-admin').addEventListener('click', () => abrirModal('modal-pin'));
  document.getElementById('btn-conectar-ble').addEventListener('click', conectarBLE);
  document.getElementById('btn-actualizar-tasa-header').addEventListener('click', obtenerTasaBCVOnline);
  document.getElementById('btn-sincronizar').addEventListener('click', obtenerTasaBCVOnline);
  document.getElementById('btn-guardar-tasa').addEventListener('click', guardarTasaManual);
  document.getElementById('btn-actualizar-logo').addEventListener('click', actualizarLogo);
  document.getElementById('btn-guardar-prod').addEventListener('click', guardarProductoAdmin);
  document.getElementById('btn-guardar-edit').addEventListener('click', guardarCambiosEdicion);
  document.getElementById('btn-cambiar-clave').addEventListener('click', cambiarClaveAdmin);
  document.getElementById('btn-verificar-pin').addEventListener('click', verificarPinAdmin);
  document.getElementById('btn-confirmar-peso-sim').addEventListener('click', aplicarPesoSimulado);
  document.getElementById('btn-confirmar-agregar').addEventListener('click', confirmarAgregar);
  document.getElementById('btn-validar-pago').addEventListener('click', validarPagoFirestore);
  document.getElementById('btn-ticket-pendiente').addEventListener('click', () => generarTicket('PENDIENTE'));
  document.getElementById('btn-imprimir-bt').addEventListener('click', imprimirTicketBluetooth);
  document.getElementById('btn-repetir-pesaje').addEventListener('click', repetirPesaje);
  document.getElementById('btn-finalizar-salir').addEventListener('click', reiniciarTodo);
  document.getElementById('btn-exportar-ventas').addEventListener('click', exportarVentasCSV);
  document.getElementById('btn-exportar-catalogo').addEventListener('click', exportarProductosCSV);

  // Botones de Galería en Admin (Crear y Editar)
  document.getElementById('btn-galeria-add').addEventListener('click', () => document.getElementById('img-gallery-add').click());
  document.getElementById('img-gallery-add').addEventListener('change', (e) => comprimirImagenGaleria(e.target.files[0], 'add'));
  document.getElementById('btn-galeria-edit').addEventListener('click', () => document.getElementById('img-gallery-edit').click());
  document.getElementById('img-gallery-edit').addEventListener('change', (e) => comprimirImagenGaleria(e.target.files[0], 'edit'));

  // Categorías
  document.querySelectorAll('.card-categoria').forEach(card => {
    card.addEventListener('click', () => filtrarPorCategoria(card.dataset.categoria));
  });

  // Buscador optimizado con Lodash debounce
  const inputBuscar = document.getElementById('input-buscar');
  inputBuscar.addEventListener('input', _.debounce(buscarProductosDirecto, 220));

  // Chips de peso rápido
  document.querySelectorAll('.chip-peso').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('input-peso-sim').value = chip.dataset.gramos;
    });
  });

  // Cierre de modales
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.getAttribute('data-close')));
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

async function obtenerTasaBCVOnline() {
  const btn = document.getElementById('btn-sincronizar');
  if (btn) btn.innerText = "⏳ Consultando Tasa Al Momento...";
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
    throw new Error("Fallback a DolarApi");
  } catch (err) {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-cache' });
      if (!response.ok) throw new Error("Error HTTP");
      const data = await response.json();
      let tasaAlMomento = data.promedio || data.precio;
      if (tasaAlMomento && !isNaN(tasaAlMomento) && tasaAlMomento > 0) {
        guardarTasaEnStorage(parseFloat(tasaAlMomento));
      }
    } catch (e) {
      console.warn("Usando tasa guardada en caché local.");
    }
  } finally {
    if (btn) btn.innerText = "🔄 Sincronizar Tasa BCV en Vivo (DolarApi / Rates)";
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
    mostrarToast("Tasa BCV actualizada manualmente", "exito");
  } else {
    mostrarToast("Ingresa un valor numérico válido", "error");
  }
}

function abrirModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => {
    el.classList.add('show');
    anime({
      targets: `#${id} .modal-contenido`,
      scale: [0.85, 1],
      opacity: [0, 1],
      duration: 320,
      easing: 'easeOutBack(1.2)'
    });
  });
}

function cerrarModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  anime({
    targets: `#${id} .modal-contenido`,
    scale: [1, 0.9],
    opacity: [1, 0],
    duration: 220,
    easing: 'easeInQuad',
    complete: () => {
      el.classList.remove('show');
      el.style.display = 'none';
    }
  });
}

function toggleModoOscuro() {
  const esOscuro = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bascula_modo_oscuro', esOscuro);
  document.getElementById('btn-tema').innerText = esOscuro ? '☀️' : '🌙';
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
  let neto = pesoBrutoGramos - taraGramos;
  return neto < 0 ? 0 : neto;
}

function actualizarDisplayPeso() {
  const elPeso = document.getElementById('peso-val');
  const valorAnterior = parseInt(elPeso.innerText) || 0;
  const valorNuevo = obtenerPesoNeto();
  
  anime({
    targets: { val: valorAnterior },
    val: valorNuevo,
    round: 1,
    duration: 350,
    easing: 'easeOutQuad',
    update: function(anim) {
      elPeso.innerText = anim.animations[0].currentValue;
    }
  });
}

function aplicarTara() {
  taraGramos = pesoBrutoGramos;
  actualizarDisplayPeso();
  reproducirSonido('balanza');
  mostrarToast("Tara aplicada (0g establecidos)", "exito");
}

function aplicarPesoSimulado() {
  let val = parseInt(document.getElementById('input-peso-sim').value);
  if (!isNaN(val) && val >= 0) {
    document.getElementById('estado-peso-lbl').innerText = "🟡 AJUSTANDO...";
    setTimeout(() => {
      pesoBrutoGramos = val;
      actualizarDisplayPeso();
      reproducirSonido('balanza');
      document.getElementById('estado-peso-lbl').innerText = "🟢 PESO ESTABLE";
      cerrarModal('modal-peso-sim');
      mostrarToast(`Peso en balanza: ${val}g`, "exito");
    }, 200);
  } else {
    mostrarToast("Ingresa un peso en gramos válido", "error");
  }
}

function iniciarMonitoreoInactividad() {
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => document.addEventListener(evt, resetearTemporizador));
  resetearTemporizador();
}

function resetearTemporizador() {
  clearTimeout(temporizadorInactividad);
  temporizadorInactividad = setTimeout(() => {
    if (document.getElementById('pantalla-kiosco').style.display === 'flex') reiniciarTodo();
  }, 90000);
}

function iniciarKiosco() {
  anime({
    targets: '#pantalla-inicio',
    opacity: [1, 0],
    scale: [1, 1.04],
    duration: 350,
    easing: 'easeInOutQuad',
    complete: () => {
      document.getElementById('pantalla-inicio').style.display = 'none';
      const kiosco = document.getElementById('pantalla-kiosco');
      kiosco.style.display = 'flex';
      anime({
        targets: kiosco,
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutQuad'
      });
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
    translateY: [20, 0],
    delay: anime.stagger(55),
    easing: 'easeOutExpo',
    duration: 450
  });
}

function filtrarPorCategoria(cat) {
  categoriaSeleccionada = cat;
  document.getElementById('input-buscar').value = "";
  document.getElementById('titulo-seccion').innerText = "Categoría: " + cat;
  document.getElementById('btn-volver').style.display = 'flex';
  document.getElementById('vista-categorias').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'grid';
  renderizarProductosGrid(productos.filter(p => p.categoria === cat || (!p.categoria && cat === 'Frutería')));
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
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:30px; color:white; font-weight:700;">No se encontraron productos.</p>';
    return;
  }

  lista.forEach(p => {
    const estadoOferta = calcularEstadoOferta(p);
    let precioEfectivo = estadoOferta.precioFinal;
    let precioBs = precioEfectivo * tasaBCV;

    let badgeHtml = estadoOferta.descuento > 0 ? `<div class="${estadoOferta.descuento === 50 ? 'badge-remate' : 'badge-oferta'}">${estadoOferta.etiqueta}</div>` : '';
    let barcodeHtml = p.codigoBarras ? `<div class="badge-barcode">#${escaparHTML(p.codigoBarras)}</div>` : '';

    let stockGramos = p.stockGramos !== undefined ? p.stockGramos : 10000;
    let stockHtml = stockGramos <= 0 
      ? `<div class="badge-stock stock-out">AGOTADO</div>` 
      : stockGramos < 2000 
        ? `<div class="badge-stock stock-low">Quedan ${(stockGramos/1000).toFixed(1)}kg</div>` 
        : `<div class="badge-stock stock-ok">Stock: ${(stockGramos/1000).toFixed(1)}kg</div>`;

    const card = document.createElement('div');
    card.className = 'card-producto';
    card.innerHTML = `
      ${badgeHtml}
      ${barcodeHtml}
      <img src="${escaparHTML(p.img)}" alt="${escaparHTML(p.nombre)}" onerror="this.src='https://via.placeholder.com/200?text=Producto'">
      <h4>${escaparHTML(p.nombre)}</h4>
      <div>
        <div class="precio-usd">$${precioEfectivo.toFixed(2)} /kg ${estadoOferta.descuento > 0 ? `<small class="precio-tachado">$${p.precioKg.toFixed(2)}</small>` : ''}</div>
        <div class="precio-bs">Bs. ${precioBs.toFixed(2)} /kg</div>
        ${stockHtml}
      </div>
    `;
    card.addEventListener('click', () => seleccionarProducto(p.id));
    grid.appendChild(card);
  });

  anime({
    targets: '.card-producto',
    opacity: [0, 1],
    scale: [0.92, 1],
    delay: anime.stagger(35),
    easing: 'easeOutExpo',
    duration: 380
  });
}

function seleccionarProducto(id) {
  let pesoNeto = obtenerPesoNeto();
  if (pesoNeto <= 0) {
    mostrarToast("⚖️ Primero coloque el producto en la balanza (peso mayor a 0g)", "aviso");
    return;
  }

  productoTemp = productos.find(p => p.id === id);
  let stockGramos = productoTemp.stockGramos !== undefined ? productoTemp.stockGramos : 10000;
  if (stockGramos <= 0) {
    mostrarToast(`El producto "${productoTemp.nombre}" está AGOTADO`, "error");
    return;
  }

  const estadoOferta = calcularEstadoOferta(productoTemp);
  const subtotalUsd = (pesoNeto / 1000) * estadoOferta.precioFinal;
  const subtotalBs = subtotalUsd * tasaBCV;
  
  document.getElementById('modal-prod-nombre').innerText = productoTemp.nombre;
  document.getElementById('modal-prod-img').src = productoTemp.img;
  document.getElementById('modal-peso').innerText = pesoNeto;
  document.getElementById('modal-descuento-info').innerText = estadoOferta.descuento > 0 ? `🔥 Oferta de Lote: ${estadoOferta.etiqueta}` : '';

  document.getElementById('modal-subtotal-usd').innerText = subtotalUsd.toFixed(2);
  document.getElementById('modal-subtotal-bs').innerText = subtotalBs.toFixed(2);
  
  abrirModal('modal-confirmar');
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
    left: rectDestino.left + 10,
    top: rectDestino.top + 10,
    scale: [1, 0.2],
    opacity: [1, 0.4],
    duration: 650,
    easing: 'easeInOutCubic',
    complete: () => {
      clon.remove();
      actualizarCarritoBadge();
    }
  });
}

function confirmarAgregar() {
  let pesoNeto = obtenerPesoNeto();
  if (pesoNeto <= 0 || !productoTemp) return;

  const estadoOferta = calcularEstadoOferta(productoTemp);
  const subtotalUsd = (pesoNeto / 1000) * estadoOferta.precioFinal;
  const subtotalBs = subtotalUsd * tasaBCV;

  window.carrito.push({
    id: productoTemp.id,
    nombre: productoTemp.nombre + (estadoOferta.descuento > 0 ? ` (${estadoOferta.etiqueta})` : ''),
    peso: pesoNeto,
    subtotalUsd: subtotalUsd,
    subtotalBs: subtotalBs
  });

  reproducirSonido('beep');
  animarVueloAlCarrito(productoTemp.img);
  cerrarModal('modal-confirmar');
  mostrarToast("Agregado al carrito", "exito");
}

function actualizarCarritoBadge() {
  const badge = document.getElementById('cant-carrito');
  badge.innerText = window.carrito.length;
  anime({
    targets: badge,
    scale: [1, 1.45, 1],
    duration: 400,
    easing: 'easeOutElastic(1, .6)'
  });
}

function abrirCarrito() {
  const contenedor = document.getElementById('lista-carrito');
  contenedor.innerHTML = '';
  let totalUsd = 0; let totalBs = 0;

  if (window.carrito.length === 0) {
    contenedor.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:15px; font-weight:700;">El carrito está vacío</p>';
  } else {
    window.carrito.forEach((item, index) => {
      totalUsd += item.subtotalUsd; totalBs += item.subtotalBs;
      const row = document.createElement('div');
      row.style.cssText = "display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;";
      row.innerHTML = `
        <div>
          <b>${escaparHTML(item.nombre)}</b> <small style="color:var(--text-muted);">(${item.peso}g)</small>
          <div style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">Bs. ${item.subtotalBs.toFixed(2)}</div>
        </div>
        <div style="text-align:right;">
          <b style="color:var(--primary); font-size:1.05rem;">$${item.subtotalUsd.toFixed(2)}</b>
          <br><button class="btn-eliminar-item" style="background:none; border:none; color:#ef4444; font-size:0.8rem; font-weight:800; cursor:pointer;">Eliminar</button>
        </div>
      `;
      row.querySelector('.btn-eliminar-item').addEventListener('click', () => eliminarDelCarrito(index));
      contenedor.appendChild(row);
    });
  }

  document.getElementById('cart-total-usd').innerText = totalUsd.toFixed(2);
  document.getElementById('cart-total-bs').innerText = totalBs.toFixed(2);
  
  const msgDiv = document.getElementById('msg-autopago');
  if (msgDiv) { msgDiv.innerText = ''; msgDiv.className = ''; }
  document.getElementById('ref-pago-input').value = '';
  
  abrirModal('modal-carrito');
}

function eliminarDelCarrito(index) {
  window.carrito.splice(index, 1);
  actualizarCarritoBadge();
  abrirCarrito();
}

async function validarPagoFirestore() {
  const rawInput = document.getElementById('ref-pago-input').value.trim();
  const msgDiv = document.getElementById('msg-autopago');
  const btnValidar = document.getElementById('btn-validar-pago');

  if (!rawInput) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "❌ Por favor ingresa los últimos 6 dígitos de referencia.";
    return;
  }
  if (!window.carrito || window.carrito.length === 0) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "❌ El carrito está vacío.";
    return;
  }

  let totalBsRequerido = window.carrito.reduce((acc, item) => acc + item.subtotalBs, 0);
  const refInput = rawInput.slice(-6);

  btnValidar.disabled = true;
  msgDiv.className = "msg-cargando";
  msgDiv.innerText = "⏳ Verificando referencia y monto en Firestore...";

  try {
    const pagosRef = collection(db, "verificacion_pagos");
    const q = query(pagosRef, where("referencia_6digitos", "==", refInput));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        if (data.estado === "PROCESADO") {
          msgDiv.className = "msg-error";
          msgDiv.innerText = "⚠️ Esta referencia ya fue utilizada anteriormente.";
          break;
        }

        let montoRegistradoEnPago = parseFloat(data.monto || data.monto_bs || 0);
        if (montoRegistradoEnPago > 0 && Math.abs(montoRegistradoEnPago - totalBsRequerido) > 1.50) {
          msgDiv.className = "msg-error";
          msgDiv.innerText = `❌ Monto incorrecto. Pagado: Bs. ${montoRegistradoEnPago.toFixed(2)} | Total: Bs. ${totalBsRequerido.toFixed(2)}`;
          break;
        }

        await updateDoc(docSnap.ref, {
          estado: "PROCESADO",
          fecha_procesado: new Date().toISOString()
        });

        msgDiv.className = "msg-exito";
        msgDiv.innerText = "✅ ¡Pago y Monto Confirmados Exitosamente!";
        reproducirSonido('scan');

        setTimeout(() => {
          cerrarModal('modal-carrito');
          generarTicket('PAGADO');
          document.getElementById('ref-pago-input').value = "";
          msgDiv.innerText = "";
        }, 1000);
        break;
      }
    } else {
      msgDiv.className = "msg-error";
      msgDiv.innerText = "❌ Referencia no encontrada. Verifica el número o espera unos segundos.";
    }
  } catch (error) {
    msgDiv.className = "msg-error";
    msgDiv.innerText = "❌ Error de conexión al consultar la base de datos.";
  } finally {
    btnValidar.disabled = false;
  }
}

function generarTicket(estadoPago = 'PENDIENTE') {
  if (window.carrito.length === 0) { mostrarToast("Agregue al menos un producto al carrito", "aviso"); return; }
  cerrarModal('modal-carrito');

  const numSerial = "TK-" + Math.floor(100000 + Math.random() * 900000);
  const fechaHora = new Date().toLocaleString('es-VE');
  let totalUsd = 0; let totalBs = 0;

  window.carrito.forEach(cartItem => {
    let prod = productos.find(p => p.id === cartItem.id);
    if (prod) {
      if (prod.stockGramos === undefined) prod.stockGramos = 10000;
      prod.stockGramos = Math.max(0, prod.stockGramos - cartItem.peso);
    }
  });
  localStorage.setItem('bascula_productos', JSON.stringify(productos));

  datosUltimoTicket = { serial: numSerial, fecha: fechaHora, tasa: tasaBCV, estado: estadoPago, items: [...window.carrito] };
  let esPagado = estadoPago === 'PAGADO';
  let badgeEstadoText = esPagado ? "🟢 [ PAGADO EN KIOSCO ]" : "🟡 [ PENDIENTE DE PAGO - IR A CAJA ]";

  let html = `
    <div style="text-align:center; margin-bottom:8px;">
      <b>BÁSCULA INTELIGENTE POS</b><br>
      <small>${fechaHora}</small><br>
      <b>SERIAL: ${numSerial}</b><br>
      <div style="margin: 6px 0; padding: 4px; border-radius: 6px; font-weight: 900; background: ${esPagado ? '#dcfce7; color: #15803d;' : '#fef3c7; color: #b45309;'}">
        ${badgeEstadoText}
      </div>
      <small>Tasa Ref. BCV: ${tasaBCV.toFixed(2)} Bs/$</small>
    </div>
    ----------------------------------<br>
  `;

  window.carrito.forEach(item => {
    totalUsd += item.subtotalUsd; totalBs += item.subtotalBs;
    html += `
      <b>${escaparHTML(item.nombre)}</b> (${item.peso}g)<br>
      $${item.subtotalUsd.toFixed(2)} | Bs. ${item.subtotalBs.toFixed(2)}<br>
    `;
  });

  datosUltimoTicket.totalUsd = totalUsd;
  datosUltimoTicket.totalBs = totalBs;

  ventasHistorial.push({
    serial: numSerial,
    fecha: hoyStr,
    hora: new Date().toLocaleTimeString('es-VE'),
    totalUsd: totalUsd,
    totalBs: totalBs,
    estado: estadoPago,
    cantProductos: window.carrito.length
  });
  localStorage.setItem('bascula_ventas_historial', JSON.stringify(ventasHistorial));
  actualizarReporteAdmin();

  html += `
    ----------------------------------<br>
    <div style="font-size:1.05rem; margin-top:4px;">
      <b>TOTAL USD: $${totalUsd.toFixed(2)}</b><br>
      <b>TOTAL BS: Bs. ${totalBs.toFixed(2)}</b>
    </div>
  `;

  document.getElementById('contenido-ticket').innerHTML = html;
  window.carrito = [];
  actualizarCarritoBadge();
  abrirModal('modal-ticket');
}

async function imprimirTicketBluetooth() {
  if (!datosUltimoTicket) { mostrarToast("No hay ticket disponible", "aviso"); return; }
  if (!navigator.bluetooth) { mostrarToast("Web Bluetooth no soportado en este navegador", "error"); return; }

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
    let texto = `================================\n        BASCULA POS        \n================================\nFECHA: ${datosUltimoTicket.fecha}\nSERIAL: ${datosUltimoTicket.serial}\nESTADO: [ ${datosUltimoTicket.estado} ]\n--------------------------------\n`;
    datosUltimoTicket.items.forEach(item => {
      texto += `${item.nombre}\nPESO: ${item.peso}g  SUB: $${item.subtotalUsd.toFixed(2)}\nBS: ${item.subtotalBs.toFixed(2)} BS\n--------------------------------\n`;
    });
    texto += `TOTAL USD: $${datosUltimoTicket.totalUsd.toFixed(2)}\nTOTAL BS:  Bs. ${datosUltimoTicket.totalBs.toFixed(2)}\n================================\n\n\n`;

    await characteristic.writeValue((new TextEncoder()).encode(texto));
    mostrarToast("¡Ticket enviado a la impresora!", "exito");
  } catch (err) {
    mostrarToast("Error Bluetooth: " + err.message, "error");
  }
}

function repetirPesaje() { cerrarModal('modal-ticket'); }

function reiniciarTodo() {
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
  anime({
    targets: inicio,
    opacity: [0, 1],
    duration: 450,
    easing: 'easeOutQuad'
  });
}

async function verificarPinAdmin() {
  const pinInput = document.getElementById('input-pin-acceso').value;
  const hashIngresado = await calcularHashSHA256(pinInput);

  if (hashIngresado === claveAdminHash) {
    document.getElementById('input-pin-acceso').value = '';
    cerrarModal('modal-pin');
    renderizarListaAdmin();
    actualizarReporteAdmin();
    abrirModal('modal-admin');
    setTimeout(renderizarGraficoD3, 150);
  } else {
    mostrarToast("Clave incorrecta", "error");
  }
}

async function cambiarClaveAdmin() {
  let nueva = document.getElementById('adm-nueva-clave').value;
  if (nueva && nueva.length >= 4) {
    claveAdminHash = await calcularHashSHA256(nueva);
    localStorage.setItem('bascula_clave_hash', claveAdminHash);
    document.getElementById('adm-nueva-clave').value = '';
    mostrarToast("Contraseña actualizada con cifrado SHA-256", "exito");
  } else {
    mostrarToast("Mínimo 4 caracteres", "error");
  }
}

function actualizarLogo() {
  const url = document.getElementById('adm-logo').value.trim();
  if (url) {
    logoUrl = url;
    localStorage.setItem('bascula_logo_url', logoUrl);
    aplicarLogo();
    mostrarToast("Logo actualizado", "exito");
  }
}

function guardarProductoAdmin() {
  const nombre = document.getElementById('adm-nombre').value.trim();
  const categoria = document.getElementById('adm-categoria').value;
  const precio = parseFloat(document.getElementById('adm-precio').value);
  const stockGramos = parseInt(document.getElementById('adm-stock').value) || 10000;
  const codigoBarras = document.getElementById('adm-codigo-barras').value.trim();
  const diasVida = parseInt(document.getElementById('adm-dias-vida').value) || 5;
  const fechaIngreso = document.getElementById('adm-fecha-ingreso').value || hoyStr;
  const imgUrlInput = document.getElementById('adm-img-url').value.trim();

  if (!nombre || isNaN(precio)) {
    mostrarToast("Ingresa nombre y precio válido", "error");
    return;
  }

  const imgFinal = imagenesBase64Temp.add || imgUrlInput || 'https://via.placeholder.com/200?text=Producto';

  productos.push({ id: Date.now(), nombre, categoria, precioKg: precio, stockGramos, codigoBarras, diasVida, fechaIngreso, img: imgFinal });
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
  mostrarToast("Producto registrado exitosamente", "exito");
}

function renderizarListaAdmin() {
  const container = document.getElementById('lista-admin-productos');
  container.innerHTML = '';
  document.getElementById('contador-inventario').innerText = productos.length;

  if (productos.length === 0) {
    container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted);">No hay productos en inventario.</p>';
    return;
  }

  productos.forEach(p => {
    const item = document.createElement('div');
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:8px 12px; border-radius:12px; border:1px solid rgba(0,0,0,0.1);";
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${escaparHTML(p.img)}" style="width:36px; height:36px; object-fit:cover; border-radius:8px;">
        <div>
          <b style="font-size:0.9rem;">${escaparHTML(p.nombre)}</b>
          <div style="font-size:0.78rem; color:var(--text-muted);">$${p.precioKg.toFixed(2)} /kg | ${escaparHTML(p.categoria)} | ${((p.stockGramos||0)/1000).toFixed(1)}kg</div>
        </div>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn-editar-prod" style="background:#f59e0b; color:white; border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer;">Editar</button>
        <button class="btn-borrar-prod" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:0.75rem; cursor:pointer;">Borrar</button>
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
  let prodIndex = productos.findIndex(p => p.id === id);
  if (prodIndex === -1) return;

  productos[prodIndex].nombre = document.getElementById('edit-prod-nombre').value.trim();
  productos[prodIndex].precioKg = parseFloat(document.getElementById('edit-prod-precio').value) || 0;
  productos[prodIndex].categoria = document.getElementById('edit-prod-categoria').value;
  productos[prodIndex].stockGramos = parseInt(document.getElementById('edit-prod-stock').value) || 0;
  productos[prodIndex].codigoBarras = document.getElementById('edit-prod-codigo').value.trim();
  productos[prodIndex].diasVida = parseInt(document.getElementById('edit-prod-dias').value) || 5;
  productos[prodIndex].fechaIngreso = document.getElementById('edit-prod-fecha').value || hoyStr;
  
  const imgUrlInput = document.getElementById('edit-prod-img-url').value.trim();
  if (imagenesBase64Temp.edit) {
    productos[prodIndex].img = imagenesBase64Temp.edit;
  } else if (imgUrlInput) {
    productos[prodIndex].img = imgUrlInput;
  }

  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  cerrarModal('modal-editar-producto');
  renderizarListaAdmin();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Producto actualizado", "exito");
}

function eliminarProductoAdmin(id) {
  productos = productos.filter(p => p.id !== id);
  localStorage.setItem('bascula_productos', JSON.stringify(productos));
  renderizarListaAdmin();
  renderizarGraficoD3();
  if (categoriaSeleccionada) filtrarPorCategoria(categoriaSeleccionada);
  mostrarToast("Producto eliminado del catálogo", "aviso");
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
    categoriasMap[cat] = (categoriasMap[cat] || 0) + (p.stockGramos || 0) / 1000;
  });

  const dataset = Object.keys(categoriasMap).map(k => ({ categoria: k, stockKg: categoriasMap[k] }));
  if (dataset.length === 0) return;

  const width = container.clientWidth || 420;
  const height = 120;

  const svg = d3.select("#d3-chart-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleBand()
    .range([25, width - 15])
    .domain(dataset.map(d => d.categoria))
    .padding(0.35);

  const y = d3.scaleLinear()
    .range([height - 22, 18])
    .domain([0, d3.max(dataset, d => d.stockKg) || 10]);

  svg.selectAll(".barra")
    .data(dataset)
    .enter()
    .append("rect")
    .attr("x", d => x(d.categoria))
    .attr("y", d => y(d.stockKg))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.max(0, height - 22 - y(d.stockKg)))
    .attr("fill", "#2d6a4f")
    .attr("rx", 5);

  svg.selectAll(".label-cat")
    .data(dataset)
    .enter()
    .append("text")
    .attr("x", d => x(d.categoria) + x.bandwidth() / 2)
    .attr("y", height - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("font-weight", "700")
    .style("fill", "currentColor")
    .text(d => d.categoria);

  svg.selectAll(".texto-barra")
    .data(dataset)
    .enter()
    .append("text")
    .attr("x", d => x(d.categoria) + x.bandwidth() / 2)
    .attr("y", d => y(d.stockKg) - 4)
    .attr("text-anchor", "middle")
    .style("font-size", "9px")
    .style("font-weight", "800")
    .style("fill", "#52b788")
    .text(d => d.stockKg.toFixed(1) + "kg");
}

function exportarVentasCSV() {
  if (ventasHistorial.length === 0) { mostrarToast("No hay ventas registradas para exportar", "aviso"); return; }
  let csvContent = "data:text/csv;charset=utf-8,Serial,Fecha,Hora,CantProductos,TotalUSD,TotalBS,Estado\n";
  ventasHistorial.forEach(v => {
    csvContent += `${v.serial},${v.fecha},${v.hora},${v.cantProductos},${v.totalUsd.toFixed(2)},${v.totalBs.toFixed(2)},${v.estado}\n`;
  });
  descargarCSV(csvContent, `Ventas_${hoyStr}.csv`);
}

function exportarProductosCSV() {
  let csvContent = "data:text/csv;charset=utf-8,ID,Nombre,Categoria,PrecioUSD,StockGramos,CodigoBarras\n";
  productos.forEach(p => {
    csvContent += `${p.id},"${p.nombre}",${p.categoria},${p.precioKg},${p.stockGramos || 0},${p.codigoBarras || ''}\n`;
  });
  descargarCSV(csvContent, `Inventario_Productos.csv`);
}

function descargarCSV(content, filename) {
  const encodedUri = encodeURI(content);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarToast(`Archivo ${filename} descargado`, "exito");
}

async function conectarBLE() {
  try {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b'] });
    await device.gatt.connect();
    mostrarToast("Conectado a la Báscula BLE", "exito");
  } catch (e) {
    mostrarToast("Modo Simulación BLE activo", "aviso");
  }
}
