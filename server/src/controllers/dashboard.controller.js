const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const { exito, error } = require("../utils/apiResponse");

class DashboardController {
  static obtenerMetricas(req, res) {
    const metricasGanado = GanadoModel.obtenerMetricas();
    const alertasSanitarias = SanidadModel.obtenerAlertasActivas();
    const insumosCriticos = InsumoModel.obtenerCriticos();
    const partesPendientes = ParteDiarioModel.obtenerPendientes();

    return exito(res, {
      resumenGanado: metricasGanado,
      alertasSanitariasCount: alertasSanitarias.length,
      insumosCriticosCount: insumosCriticos.length,
      partesPendientesCount: partesPendientes.length,
      rolSolicitante: req.usuario ? req.usuario.rol : null,
      establecimiento: req.usuario ? req.usuario.establecimiento : "Estancia La Esperanza",
    });
  }

  static obtenerAlertas(req, res) {
    const alertas = SanidadModel.listarAlertasYEventos();
    return exito(res, alertas);
  }

  static obtenerInsumosCriticos(req, res) {
    const insumos = InsumoModel.listarTodos();
    return exito(res, insumos);
  }

  static obtenerPartes(req, res) {
    const partes = ParteDiarioModel.listarTodos();
    return exito(res, partes);
  }

  static registrarParteDiario(req, res) {
    const { potrero, novedades, animalesRevisados, solicitudInsumos } = req.body || {};

    if (!potrero || !novedades) {
      return error(res, "Potrero y novedades son campos requeridos.", 400);
    }

    const peonNombre = req.usuario ? req.usuario.nombre : "Operario de Campo";

    const nuevo = ParteDiarioModel.registrar({
      peonNombre,
      potrero,
      novedades,
      animalesRevisados,
      solicitudInsumos,
    });

    return exito(res, nuevo, "Parte diario cargado con éxito.", 201);
  }

  static actualizarEstadoParte(req, res) {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !["Aprobado", "Rechazado", "Pendiente"].includes(estado)) {
      return error(res, "Estado inválido. Debe ser Aprobado, Rechazado o Pendiente.", 400);
    }

    try {
      const revisadoPor = req.usuario
        ? `${req.usuario.nombre} (${req.usuario.rol})`
        : "Supervisor";
      const parteActualizado = ParteDiarioModel.cambiarEstado(id, estado, revisadoPor);
      return exito(res, parteActualizado, `Parte diario marcado como ${estado}.`);
    } catch (err) {
      return error(res, err.message, 404);
    }
  }
}

module.exports = DashboardController;
