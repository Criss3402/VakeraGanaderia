const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const { exito, error } = require("../utils/apiResponse");

class DashboardController {
  // 1. Métricas Globales
  static async obtenerMetricas(req, res) {
    try {
      const metricasGanado = await GanadoModel.obtenerMetricas();
      const alertasSanitarias = await SanidadModel.obtenerAlertasActivas();
      const insumosCriticos = await InsumoModel.obtenerCriticos();
      const partesPendientes = await ParteDiarioModel.obtenerPendientes();

      return exito(res, {
        resumenGanado: metricasGanado,
        alertasSanitariasCount: alertasSanitarias.length,
        insumosCriticosCount: insumosCriticos.length,
        partesPendientesCount: partesPendientes.length,
        rolSolicitante: req.usuario ? req.usuario.rol : null,
        establecimiento: req.usuario ? req.usuario.establecimiento : "El Rancho, Goya, Corrientes",
      });
    } catch (err) {
      return error(res, err.message, 500);
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
      const nuevo = await GanadoModel.crearPotrero(req.body);
      return exito(res, nuevo, "Potrero creado exitosamente.", 201);
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
      return error(res, err.message, 500);
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
      return error(res, err.message, 500);
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

  // Solicitudes de Insumos (Peón, Capataz, Veterinario)
  static obtenerSolicitudesInsumos(req, res) {
    try {
      const solicitudes = InsumoModel.listarSolicitudes();
      return exito(res, solicitudes);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static crearSolicitudInsumo(req, res) {
    try {
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
      const partes = await ParteDiarioModel.listarTodos();
      return exito(res, partes);
    } catch (err) {
      return error(res, err.message, 500);
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
        potreroNombre: potrero,
        novedades,
        animalesRevisados,
        solicitudInsumos,
      });

      return exito(res, nuevo, "Parte diario cargado con éxito en la base de datos.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarEstadoParte(req, res) {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !["APROBADO", "RECHAZADO", "PENDIENTE", "Aprobado", "Rechazado", "Pendiente"].includes(estado)) {
      return error(res, "Estado inválido. Debe ser Aprobado, Rechazado o Pendiente.", 400);
    }

    try {
      const revisadoPorId = req.usuario ? req.usuario.id : null;
      const parteActualizado = await ParteDiarioModel.cambiarEstado(id, estado, revisadoPorId);
      return exito(res, parteActualizado, `Parte diario marcado como ${estado}.`);
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  // 6. Reportes y Trazabilidad Ejecutiva / Administrativa
  static async obtenerReportes(req, res) {
    try {
      const ganado = await GanadoModel.listarTodos();
      const insumos = await InsumoModel.listarTodos();
      const partes = await ParteDiarioModel.listarTodos();
      const eventos = await SanidadModel.listarAlertasYEventos();

      const totalCabezas = ganado.length;
      const pesoPromedio = totalCabezas > 0
        ? Math.round(ganado.reduce((acc, g) => acc + (g.pesoKg || 0), 0) / totalCabezas)
        : 0;

      // Estimación financiera (valor de hacienda según peso y precio de referencia por kg vivo)
      const precioKgVivoRef = 2400; // ARS por kg promedio
      const valorHaciendaEstimado = ganado.reduce((acc, g) => acc + (g.pesoKg * precioKgVivoRef), 0);

      const insumosCriticos = insumos.filter((i) => i.requiereReposicion || i.stockActual <= i.stockMinimo);
      const partesAprobados = partes.filter((p) => String(p.estado).toUpperCase() === "APROBADO").length;
      const tratamientosCompletados = eventos.filter((e) => e.estado === "Completado").length;

      return exito(res, {
        resumenGeneral: {
          totalCabezas,
          pesoPromedio,
          valorHaciendaEstimado,
          tasaMortalidad: "0.8%",
          partesProcesados: partes.length,
          partesAprobados,
          insumosCriticosCount: insumosCriticos.length,
          tratamientosCompletados,
        },
        distribucionPotreros: await GanadoModel.listarPotreros(),
        haciendaDetalle: ganado,
        alertasHistoricas: eventos,
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // 7. Clima
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
