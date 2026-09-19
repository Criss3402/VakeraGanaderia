/**
 * Utilidades para estructurar respuestas HTTP estandarizadas en la API de Vakera
 */

function exito(res, data = null, mensaje = null, status = 200) {
  return res.status(status).json({
    ok: true,
    ...(mensaje ? { mensaje } : {}),
    ...(data !== null ? { data } : {}),
  });
}

function error(res, mensaje = "Ocurrió un error inesperado", status = 400, detalles = null) {
  return res.status(status).json({
    ok: false,
    error: mensaje,
    ...(detalles ? { detalles } : {}),
  });
}

module.exports = {
  exito,
  error,
};
