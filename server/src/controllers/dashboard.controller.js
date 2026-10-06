const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const { exito, error } = require("../utils/apiResponse");

class DashboardController {
  static async obtenerMetricas(req, res) {
    try {
      const [metricasGanado, alertasSanitarias, insumosCriticos, partesPendientes] = await Promise.all([
        GanadoModel.obtenerMetricas(),
        SanidadModel.obtenerAlertasActivas(),
        InsumoModel.obtenerCriticos(),
        ParteDiarioModel.obtenerPendientes(),
      ]);

      return exito(res, {
        resumenGanado: metricasGanado,
        alertasSanitariasCount: alertasSanitarias.length,
        insumosCriticosCount: insumosCriticos.length,
        partesPendientesCount: partesPendientes.length,
        rolSolicitante: req.usuario ? req.usuario.rol : null,
        establecimiento: req.usuario ? req.usuario.establecimiento : "Estancia La Esperanza",
      });
    } catch (err) {
      return error(res, "Error al calcular métricas: " + err.message, 500);
    }
  }

  static async obtenerAlertas(req, res) {
    try {
      const alertas = await SanidadModel.listarAlertasYEventos();
      return exito(res, alertas);
    } catch (err) {
      return error(res, "Error al listar alertas sanitarias: " + err.message, 500);
    }
  }

  static async obtenerInsumosCriticos(req, res) {
    try {
      const insumos = await InsumoModel.listarTodos();
      return exito(res, insumos);
    } catch (err) {
      return error(res, "Error al listar insumos: " + err.message, 500);
    }
  }

  static async obtenerPartes(req, res) {
    try {
      const partes = await ParteDiarioModel.listarTodos();
      return exito(res, partes);
    } catch (err) {
      return error(res, "Error al listar partes diarios: " + err.message, 500);
    }
  }

  static async registrarParteDiario(req, res) {
    const { potrero, novedades, animalesRevisados, solicitudInsumos } = req.body || {};

    if (!potrero || !novedades) {
      return error(res, "Potrero y novedades son campos requeridos.", 400);
    }

    try {
      const nuevo = await ParteDiarioModel.registrar({
        peonId: req.usuario ? req.usuario.id : null,
        peonNombre: req.usuario ? req.usuario.nombre : "Operario de Campo",
        potrero,
        novedades,
        animalesRevisados,
        solicitudInsumos,
      });

      return exito(res, nuevo, "Parte diario cargado con éxito.", 201);
    } catch (err) {
      return error(res, "Error al registrar parte diario: " + err.message, 500);
    }
  }

  static async actualizarEstadoParte(req, res) {
    const { id } = req.params;
    const { estado } = req.body;

    const ESTADOS_VALIDOS = ["APROBADO", "RECHAZADO", "PENDIENTE"];
    const estadoNormalizado = (estado || "").toUpperCase();

    if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
      return error(res, `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`, 400);
    }

    try {
      const parteActualizado = await ParteDiarioModel.cambiarEstado(id, estadoNormalizado, req.usuario);
      return exito(res, parteActualizado, `Parte diario marcado como ${estadoNormalizado}.`);
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  static async obtenerClima(req, res) {
    try {
      const WeatherService = require("../services/weather.service");
      const { lat, lon } = req.query;
      const clima = await WeatherService.obtenerCondicionesActuales({ lat, lon });
      return exito(res, clima, "Condiciones climáticas obtenidas con éxito.");
    } catch (err) {
      return error(res, "No se pudo obtener la información climática: " + err.message, 500);
    }
  }
}

module.exports = DashboardController;
