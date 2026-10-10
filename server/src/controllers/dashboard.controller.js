const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const { exito, error } = require("../utils/apiResponse");

class DashboardController {
  // 1. Métricas Globales
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
        establecimiento: req.usuario ? req.usuario.establecimiento : "El Rancho, Goya, Corrientes",
      });
    } catch (err) {
      return error(res, "Error al calcular métricas: " + err.message, 500);
    }
  }

  // 2. Ganado y Potreros
  static async obtenerGanado(req, res) {
    try {
      const lista = await GanadoModel.listarTodos();
      return exito(res, lista);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async obtenerPotreros(req, res) {
    try {
      const potreros = await GanadoModel.listarPotreros();
      return exito(res, potreros);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async registrarGanado(req, res) {
    try {
      const animal = await GanadoModel.registrar(req.body);
      return exito(res, animal, "Animal registrado en el rodeo exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarGanado(req, res) {
    try {
      const { id } = req.params;
      const animal = await GanadoModel.actualizar(id, req.body);
      return exito(res, animal, "Ficha de ganado actualizada correctamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // 3. Sanidad y Calendario
  static async obtenerAlertas(req, res) {
    try {
      const alertas = await SanidadModel.listarAlertasYEventos();
      return exito(res, alertas);
    } catch (err) {
      return error(res, "Error al listar alertas sanitarias: " + err.message, 500);
    }
  }

  static async registrarEventoSanitario(req, res) {
    try {
      const nuevo = await SanidadModel.registrarEvento(req.body);
      return exito(res, nuevo, "Evento sanitario registrado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarEstadoSanitario(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const actualizado = await SanidadModel.actualizarEstado(id, estado);
      return exito(res, actualizado, `Evento sanitario actualizado a '${estado}'.`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // 4. Insumos y Stock
  static async obtenerInsumosCriticos(req, res) {
    try {
      const insumos = await InsumoModel.listarTodos();
      return exito(res, insumos);
    } catch (err) {
      return error(res, "Error al listar insumos: " + err.message, 500);
    }
  }

  static async registrarInsumo(req, res) {
    try {
      const nuevo = await InsumoModel.registrar(req.body);
      return exito(res, nuevo, "Insumo registrado en el inventario exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarStockInsumo(req, res) {
    try {
      const { id } = req.params;
      const { cantidad, operacion } = req.body;
      const actualizado = await InsumoModel.actualizarStock(id, cantidad, operacion);
      return exito(res, actualizado, "Stock de insumo actualizado correctamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // 5. Partes Diarios
  static async obtenerPartes(req, res) {
    try {
      const partes = await ParteDiarioModel.listarTodos();
      return exito(res, partes);
    } catch (err) {
      return error(res, "Error al listar partes diarios: " + err.message, 500);
    }
  }

  static async registrarParteDiario(req, res) {
    const { potreroId, potrero, novedades, animalesRevisados, solicitudInsumos } = req.body || {};

    if (!novedades) {
      return error(res, "Las novedades son requeridas.", 400);
    }

    try {
      const peonId = req.usuario ? req.usuario.id : null;
      const peonNombre = req.usuario ? req.usuario.nombre : "Operario de Campo";

      const nuevo = await ParteDiarioModel.registrar({
        peonId,
        peonNombre,
        potreroId,
        potrero,
        potreroNombre: potrero,
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
      return error(res, "Error al actualizar estado del parte diario: " + err.message, 500);
    }
  }
}

module.exports = DashboardController;
