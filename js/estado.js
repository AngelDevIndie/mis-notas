// Estado central de la app: la lista de pestañas y cuál está activa.
// Todo lo demás (pintar, atajos, archivos) lee y cambia este objeto.
// sesion.js guarda este estado en disco como "sesión" (función 3).

const Estado = {
  pestanas: [], // cada una: { id, ruta, texto, modificado, selInicio, selFin, scroll }
  activaId: null,
  siguienteId: 1,

  // Crea una pestaña nueva (sin añadirla a la lista).
  crear({ ruta = null, texto = "", modificado = false } = {}) {
    return { id: this.siguienteId++, ruta, texto, modificado, selInicio: 0, selFin: 0, scroll: 0 };
  },

  activa() {
    return this.pestanas.find((p) => p.id === this.activaId) || null;
  },

  indice(id) {
    return this.pestanas.findIndex((p) => p.id === id);
  },

  // Nombre que se ve en la pestaña: el del archivo o "Sin título".
  nombre(p) {
    if (!p.ruta) return "Sin título";
    return p.ruta.split(/[\\/]/).pop();
  },

  // Busca una pestaña que ya tenga abierto ese archivo (Windows no distingue mayúsculas).
  buscarPorRuta(ruta) {
    const r = ruta.toLowerCase();
    return this.pestanas.find((p) => p.ruta && p.ruta.toLowerCase() === r) || null;
  },
};
