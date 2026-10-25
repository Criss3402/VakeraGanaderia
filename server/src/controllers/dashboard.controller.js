const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const WeatherService = require("../services/weather.service");
const { exito, error } = require("../utils/apiResponse");

function obtenerEstablecimientoContexto(req) {
  const estId = req.usuario?.establecimientoId || (req.usuario?.establecimiento === "El Rancho, Goya, Corrientes" ? "est-el-rancho" : null);
  const estNombre = req.usuario?.establecimiento || "Mi Establecimiento";
  return { estId, estNombre };
}

class DashboardController {
  // 1. Métricas Globales
  static async obtenerMetricas(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);

      const [metricasGanado, alertasSanitarias, insumosCriticos, partesPendientes] = await Promise.all([
        GanadoModel.obtenerMetricas(estId),
        SanidadModel.obtenerAlertasActivas(estId),
        InsumoModel.obtenerCriticos(estId),
        ParteDiarioModel.obtenerPendientes(estId),
      ]);

      return exito(res, {
        resumenGanado: metricasGanado,
        alertasSanitariasCount: alertasSanitarias.length,
        insumosCriticosCount: insumosCriticos.length,
        partesPendientesCount: partesPendientes.length,
        rolSolicitante: req.usuario ? req.usuario.rol : null,
        establecimiento: estNombre,
        establecimientoId: estId,
      });
    } catch (err) {
      return error(res, "Error al calcular métricas: " + err.message, 500);
    }
  }

  // 2. Ganado y Potreros
  static async obtenerGanado(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const lista = await GanadoModel.listarTodos(estId);
      return exito(res, lista);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async obtenerPotreros(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const potreros = await GanadoModel.listarPotreros(estId);
      return exito(res, potreros);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async registrarGanado(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const animal = await GanadoModel.registrar(req.body, estId, estNombre);
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

  static async obtenerFichaAnimal(req, res) {
    try {
      const { id } = req.params;
      const animal = await GanadoModel.buscarPorId(id);
      if (!animal) return error(res, "Animal no encontrado.", 404);
      return exito(res, animal);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async darDeBajaAnimal(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body || {};
      const baja = await GanadoModel.darDeBaja(id, motivo);
      return exito(res, baja, `Baja del animal registrada con éxito (${motivo || "Venta"}).`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async trasladoMasivoGanado(req, res) {
    try {
      const { animalIds, potreroDestinoId } = req.body || {};
      const resultado = await GanadoModel.trasladoMasivo(animalIds, potreroDestinoId);
      return exito(res, resultado, `Traslado masivo completado exitosamente.`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async registrarPotrero(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const nuevo = await GanadoModel.crearPotrero(req.body, estId, estNombre);
      return exito(res, nuevo, "Potrero creado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async eliminarPotrero(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = await GanadoModel.eliminarPotrero(id, estId);
      return exito(res, eliminado, "Potrero eliminado exitosamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // 3. Sanidad y Calendario
  static async obtenerAlertas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const alertas = await SanidadModel.listarAlertasYEventos(estId);
      return exito(res, alertas);
    } catch (err) {
      return error(res, "Error al listar alertas sanitarias: " + err.message, 500);
    }
  }

  static async registrarEventoSanitario(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const nuevo = await SanidadModel.registrarEvento(req.body, estId, estNombre);
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
      const { estId } = obtenerEstablecimientoContexto(req);
      const insumos = await InsumoModel.listarTodos(estId);
      return exito(res, insumos);
    } catch (err) {
      return error(res, "Error al listar insumos: " + err.message, 500);
    }
  }

  static async registrarInsumo(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const nuevo = await InsumoModel.registrar(req.body, estId, estNombre);
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

  // Solicitudes de Insumos (Peón, Capataz, Veterinario)
  static obtenerSolicitudesInsumos(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const solicitudes = InsumoModel.listarSolicitudes(estId);
      return exito(res, solicitudes);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static crearSolicitudInsumo(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const { insumoId, insumoNombre, cantidad, unidad, motivo, urgencia, sector } = req.body || {};

      if (!insumoNombre) {
        return error(res, "Debe especificar el insumo o herramienta a solicitar.", 400);
      }

      const solicitanteNombre = req.usuario ? req.usuario.nombre : "Operario";
      const solicitanteRol = req.usuario ? req.usuario.rol : "peon";

      const nueva = InsumoModel.registrarSolicitud({
        insumoId,
        insumoNombre,
        cantidad,
        unidad,
        motivo,
        urgencia,
        solicitanteNombre,
        solicitanteRol,
        sector: sector || (solicitanteRol === "veterinario" ? "Botiquín Veterinario" : solicitanteRol === "capataz" ? "Campo y Taller" : "Pertenencias de Peón"),
        establecimientoId: estId,
        establecimiento: estNombre,
      });

      return exito(res, nueva, "Solicitud de insumos enviada con éxito.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarEstadoSolicitudInsumo(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const revisadoPor = req.usuario ? `${req.usuario.nombre} (${req.usuario.rol})` : "Administración";

      const actualizada = await InsumoModel.actualizarEstadoSolicitud(id, estado, revisadoPor);
      return exito(res, actualizada, `Solicitud marcada como ${estado}.`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // Conteo Físico de Pertenencias
  static async conteoPertenencias(req, res) {
    try {
      const { id } = req.params;
      const { stockContado } = req.body;

      if (stockContado === undefined || stockContado === null) {
        return error(res, "Debe ingresar la cantidad física contada.", 400);
      }

      const actualizado = await InsumoModel.actualizarStock(id, stockContado, "conteo");
      return exito(res, actualizado, `Conteo de pertenencias actualizado a ${stockContado} ${actualizado.unidad}.`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // 5. Partes Diarios
  static async obtenerPartes(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const partes = await ParteDiarioModel.listarTodos(estId);
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
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
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
        establecimientoId: estId,
        establecimiento: estNombre,
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

  // 6. Condiciones Climáticas (Google Weather API / Contingencia)
  static async obtenerClima(req, res) {
    try {
      const { lat, lon } = req.query || {};
      const clima = await WeatherService.obtenerCondicionesActuales({ lat, lon });
      return exito(res, clima, "Condiciones climáticas obtenidas con éxito.");
    } catch (err) {
      return error(res, "Error al consultar condiciones climáticas: " + err.message, 500);
    }
  }

  // 7. Reportes Consolidados (Dueño / Oficina / Capataz / Veterinario)
  static async obtenerReportes(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const [metricasGanado, insumosCriticos, partes, potreros, hacienda] = await Promise.all([
        GanadoModel.obtenerMetricas(estId),
        InsumoModel.obtenerCriticos(estId),
        ParteDiarioModel.listarTodos(estId),
        GanadoModel.listarPotreros(estId),
        GanadoModel.listarTodos(estId),
      ]);

      const precioKgVivo = 2400; // Referencia mercado ARS
      const totalCabezas = metricasGanado.totalCabezas || 0;
      const pesoPromedio = metricasGanado.pesoPromedioKg || 0;
      const valorHaciendaEstimado = totalCabezas > 0
        ? Math.round(hacienda.reduce((acc, a) => acc + (Number(a.pesoKg) || 0) * precioKgVivo, 0))
        : 0;

      const resumenGeneral = {
        totalCabezas,
        pesoPromedio,
        valorHaciendaEstimado,
        tasaMortalidad: metricasGanado.tasaMortalidadMensual || "0.0%",
        tratamientosCompletados: partes.filter((p) => {
          const txt = (p.novedades || "").toLowerCase();
          return txt.includes("vacun") || txt.includes("curac") || txt.includes("sanit");
        }).length,
      };

      const reporte = {
        resumenGanado: metricasGanado,
        resumenGeneral,
        distribucionPotreros: potreros,
        haciendaDetalle: hacienda,
        insumosCriticos,
        totalPartes: partes.length,
        partesAprobados: partes.filter((p) => (p.estado || "").toUpperCase() === "APROBADO").length,
        partesPendientes: partes.filter((p) => (p.estado || "").toUpperCase() === "PENDIENTE").length,
        fechaGeneracion: new Date().toISOString(),
      };

      return exito(res, reporte, "Reportes consolidados generados exitosamente.");
    } catch (err) {
      return error(res, "Error al generar reportes: " + err.message, 500);
    }
  }
}

module.exports = DashboardController;
