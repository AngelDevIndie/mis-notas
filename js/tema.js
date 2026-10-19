// Se carga en <head>, antes de pintar nada: pone el tema guardado
// para que la ventana no aparezca un instante con el tema equivocado.
document.documentElement.dataset.tema = (window.api.ajustes && window.api.ajustes.tema) || "sistema";
