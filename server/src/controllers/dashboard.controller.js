const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const ParcelaPermisoModel = require("../models/parcelaPermiso.model");
const TamboConfigModel = require("../models/tamboConfig.model");
const OrdenieModel = require("../models/ordenie.model");
const ReproduccionModel = require("../models/reproduccion.model");
const FinanzasModel = require("../models/finanzas.model");
const WeatherService = require("../services/weather.service");
const CotizacionService = require("../services/cotizacion.service");
const DolarService = require("../services/dolar.service");
const LecheService = require("../services/leche.service");
const { ROLES } = require("../utils/roles.constants");
const { exito, error } = require("../utils/apiResponse");

function obtenerEstablecimientoContexto(req) {
  const estId =
    req.usuario?.establecimientoId ||
    (req.usuario?.email === "dueno@vakera.com"
      ? "est-el-rancho"
      : req.usuario?.id
      ? `est-usr-${req.usuario.id}`
      : null);
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
      const { take, skip } = req.query || {};
      const lista = await GanadoModel.listarTodos(estId, { take, skip });
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
      const { estId } = obtenerEstablecimientoContexto(req);
      const animal = await GanadoModel.actualizar(id, req.body, estId);
      return exito(res, animal, "Ficha de ganado actualizada correctamente.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async obtenerFichaAnimal(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const animal = await GanadoModel.buscarPorId(id, estId);
      if (!animal) return error(res, "Animal no encontrado.", 404);
      return exito(res, animal);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  static async darDeBajaAnimal(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const { motivo } = req.body || {};
      const baja = await GanadoModel.darDeBaja(id, motivo, estId);
      return exito(res, baja, `Baja del animal registrada con éxito (${motivo || "Venta"}).`);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async darDeBajaMasivoGanado(req, res) {
    try {
      const { animalIds, motivo } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await GanadoModel.darDeBajaMasivo(animalIds, motivo || "Venta", estId);
      return exito(
        res,
        resultado,
        `Se dieron de baja ${resultado.count || animalIds.length} animales exitosamente (${motivo || "Venta"}).`
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async trasladoMasivoGanado(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const { animalIds, potreroDestinoId } = req.body || {};
      const resultado = await GanadoModel.trasladoMasivo(animalIds, potreroDestinoId, estId);
      return exito(res, resultado, `Traslado masivo completado exitosamente.`);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async registrarPotrero(req, res) {
    try {
      const { estId, estNombre } = obtenerEstablecimientoContexto(req);
      const permiso = await ParcelaPermisoModel.tienePermisoParaAccion({
        usuarioId: req.usuario?.id,
        rol: req.usuario?.rol,
        establecimientoId: estId,
        accion: "AGREGAR",
      });
      if (!permiso.autorizado) {
        return error(res, "Acceso denegado: no tenés autorización para crear parcelas. Solicitá permiso al Dueño.", 403);
      }
      const nuevo = await GanadoModel.crearPotrero(req.body, estId, estNombre);
      if (permiso.solicitudId) {
        await ParcelaPermisoModel.consumirPermiso(permiso.solicitudId);
      }
      return exito(res, nuevo, "Potrero creado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async actualizarPotrero(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const permiso = await ParcelaPermisoModel.tienePermisoParaAccion({
        usuarioId: req.usuario?.id,
        rol: req.usuario?.rol,
        establecimientoId: estId,
        accion: "EDITAR",
        parcelaId: id,
      });
      if (!permiso.autorizado) {
        return error(res, "Acceso denegado: no tenés autorización para editar esta parcela. Solicitá permiso al Dueño.", 403);
      }
      const actualizado = await GanadoModel.actualizarPotrero(id, req.body || {}, estId);
      if (permiso.solicitudId) {
        await ParcelaPermisoModel.consumirPermiso(permiso.solicitudId);
      }
      const nombreAnterior = actualizado.nombreAnterior || req.body?.nombreAnterior;
      if (nombreAnterior && actualizado.nombre && nombreAnterior !== actualizado.nombre) {
        try {
          await InsumoModel.gestionarLocacion({
            nombreAnterior,
            nuevoNombre: actualizado.nombre,
            accion: "editar",
            establecimientoId: estId,
          });
        } catch (errSync) {
          console.warn("[DashboardController] Aviso sincronizando locación de insumo:", errSync.message);
        }
      }
      return exito(res, actualizado, "Parcela actualizada exitosamente.");
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
      const { estId } = obtenerEstablecimientoContexto(req);
      const { estado } = req.body;
      const actualizado = await SanidadModel.actualizarEstado(id, estado, estId);
      return exito(res, actualizado, `Evento sanitario actualizado a '${estado}'.`);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async eliminarEventoSanitario(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = await SanidadModel.eliminarEvento(id, estId);
      return exito(res, eliminado, "Evento sanitario eliminado exitosamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async eliminarEventosSanitariosMasivo(req, res) {
    try {
      const { ids } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await SanidadModel.eliminarMasivo(ids, estId);
      return exito(
        res,
        resultado,
        `Se eliminaron ${resultado.count || (ids && ids.length) || 0} eventos sanitarios.`
      );
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
      const { estId } = obtenerEstablecimientoContexto(req);
      const { cantidad, operacion } = req.body;
      const actualizado = await InsumoModel.actualizarStock(id, cantidad, operacion, estId);
      return exito(res, actualizado, "Stock de insumo actualizado correctamente.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async eliminarInsumo(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = await InsumoModel.eliminar(id, estId);
      return exito(res, eliminado, "Insumo eliminado del inventario exitosamente.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static async eliminarInsumosMasivo(req, res) {
    try {
      const { ids } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await InsumoModel.eliminarMasivo(ids, estId);
      return exito(
        res,
        resultado,
        `Se eliminaron ${resultado.count || (ids && ids.length) || 0} insumos del inventario.`
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async gestionarLocacionInsumos(req, res) {
    try {
      const { nombreAnterior, nuevoNombre, accion } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await InsumoModel.gestionarLocacion({
        nombreAnterior,
        nuevoNombre,
        accion,
        establecimientoId: estId,
      });
      return exito(
        res,
        resultado,
        accion === "eliminar"
          ? `Locación "${nombreAnterior}" eliminada correctamente.`
          : `Locación renombrada a "${resultado.nuevoNombre}" correctamente.`
      );
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
      return exito(res, actualizada, `Solicitud marcada como ${actualizada.estado}.`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static eliminarSolicitudInsumo(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminada = InsumoModel.eliminarSolicitud(id, estId);
      return exito(res, eliminada, "Solicitud eliminada correctamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static eliminarSolicitudesInsumoMasivo(req, res) {
    try {
      const { ids } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = InsumoModel.eliminarSolicitudesMasivo(ids, estId);
      return exito(
        res,
        resultado,
        `Se eliminaron ${resultado.count || (ids && ids.length) || 0} solicitudes seleccionadas.`
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // Conteo Físico de Pertenencias
  static async conteoPertenencias(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const { stockContado } = req.body;

      if (stockContado === undefined || stockContado === null) {
        return error(res, "Debe ingresar la cantidad física contada.", 400);
      }

      const actualizado = await InsumoModel.actualizarStock(id, stockContado, "conteo", estId);
      return exito(res, actualizado, `Conteo de pertenencias actualizado a ${stockContado} ${actualizado.unidad}.`);
    } catch (err) {
      return error(res, err.message, err.status || 400);
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
      const { estId } = obtenerEstablecimientoContexto(req);
      const parteActualizado = await ParteDiarioModel.cambiarEstado(id, estadoNormalizado, req.usuario, estId);
      return exito(res, parteActualizado, `Parte diario marcado como ${estadoNormalizado}.`);
    } catch (err) {
      return error(res, "Error al actualizar estado del parte diario: " + err.message, err.status || 500);
    }
  }

  static async eliminarParteDiario(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = await ParteDiarioModel.eliminar(id, estId);
      return exito(res, eliminado, "Parte diario eliminado exitosamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async eliminarPartesDiariosMasivo(req, res) {
    try {
      const { ids } = req.body || {};
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await ParteDiarioModel.eliminarMasivo(ids, estId);
      return exito(
        res,
        resultado,
        `Se eliminaron ${resultado.count || (ids && ids.length) || 0} partes diarios.`
      );
    } catch (err) {
      return error(res, err.message, 400);
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

  // 6b. Cotizaciones Ganaderas en Tiempo Real (MAG / Contingencia)
  static async obtenerCotizaciones(req, res) {
    try {
      const forzar = req.query?.refresh === "true";
      const cotizaciones = await CotizacionService.obtenerCotizaciones({ forzar });
      return exito(res, cotizaciones, "Cotizaciones ganaderas obtenidas con éxito.");
    } catch (err) {
      return error(res, "Error al consultar cotizaciones ganaderas: " + err.message, 500);
    }
  }

  // 6c. Cotización del Dólar en Argentina (DolarApi / Contingencia)
  static async obtenerDolar(req, res) {
    try {
      const forzar = req.query?.refresh === "true";
      const dolar = await DolarService.obtenerCotizaciones({ forzar });
      return exito(res, dolar, "Cotización del dólar obtenida con éxito.");
    } catch (err) {
      return error(res, "Error al consultar cotización del dólar: " + err.message, 500);
    }
  }

  // 6d. Precio del Tambo de Leche (OCLA / SIGLeA) + Dólar + Config Tambo
  static async obtenerLeche(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const forzar = req.query?.refresh === "true";
      const [leche, dolar, configuracion] = await Promise.all([
        LecheService.obtenerPreciosLeche({ forzar }),
        DolarService.obtenerCotizaciones({ forzar }),
        TamboConfigModel.obtenerPorEstablecimiento(estId),
      ]);
      return exito(res, { ...leche, dolar, configuracion }, "Precio de leche OCLA obtenido con éxito.");
    } catch (err) {
      return error(res, "Error al consultar precio de leche OCLA: " + err.message, 500);
    }
  }

  static async guardarConfiguracionTambo(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const pesoPorCategoria = await GanadoModel.obtenerPesoPorCategoria(estId);
      const maxVacasLecheras = pesoPorCategoria
        .filter((item) => String(item.categoria || "").toLowerCase().includes("lecher"))
        .reduce((acc, item) => acc + (Number(item.cabezas) || 0), 0);

      const vacasSolicitadas = Math.max(0, Math.round(Number(req.body?.vacasOrdenie) || 0));
      if (req.body?.modoEntrada !== "litros" && vacasSolicitadas > maxVacasLecheras) {
        return error(
          res,
          `No podés asignar más vacas en ordeñe (${vacasSolicitadas}) que vacas lecheras registradas (${maxVacasLecheras}).`,
          400
        );
      }

      const guardada = await TamboConfigModel.guardar(estId, req.body || {});
      return exito(res, guardada, "Configuración de tambo guardada en base de datos.");
    } catch (err) {
      return error(res, "Error al guardar configuración del tambo: " + err.message, 400);
    }
  }

  static async listarOrdenies(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const { fecha } = req.query || {};
      const lista = await OrdenieModel.listar(estId, { fecha });
      return exito(res, lista);
    } catch (err) {
      return error(res, "Error al consultar registros de ordeñe: " + err.message, 500);
    }
  }

  static async registrarOrdenie(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const creado = await OrdenieModel.registrar(estId, req.body || {});
      return exito(res, creado, "Registro de ordeñe guardado.", 201);
    } catch (err) {
      return error(res, err.message || "Error al registrar ordeñe.", err.status || 400);
    }
  }

  static async eliminarOrdenie(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const { id } = req.params;
      const resultado = await OrdenieModel.eliminar(id, estId);
      return exito(res, resultado, "Registro de ordeñe eliminado.");
    } catch (err) {
      return error(res, err.message || "Error al eliminar registro de ordeñe.", err.status || 400);
    }
  }

  // 7. Reportes Consolidados (Dueño / Oficina / Capataz / Veterinario)
  static async obtenerReportes(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const [
        metricasGanado,
        pesoPorCategoria,
        cotizaciones,
        dolar,
        leche,
        configTambo,
        ordenes,
        insumosCriticos,
        partes,
        potreros,
        hacienda,
      ] = await Promise.all([
        GanadoModel.obtenerMetricas(estId),
        GanadoModel.obtenerPesoPorCategoria(estId),
        CotizacionService.obtenerCotizaciones(),
        DolarService.obtenerCotizaciones(),
        LecheService.obtenerPreciosLeche(),
        TamboConfigModel.obtenerPorEstablecimiento(estId),
        OrdenieModel.listar(estId),
        InsumoModel.obtenerCriticos(estId),
        ParteDiarioModel.listarTodos(estId),
        GanadoModel.listarPotreros(estId),
        GanadoModel.listarTodos(estId),
      ]);

      const totalCabezas = metricasGanado.totalCabezas || 0;
      const pesoPromedio = metricasGanado.pesoPromedioKg || 0;

      const valuacionPorCategoria = pesoPorCategoria.map((item) => {
        const { precioKgVivo, categoriaReferencia } =
          CotizacionService.obtenerPrecioPorCategoria(item.categoria, cotizaciones);
        const valorEstimado = Math.round(item.pesoTotalKg * precioKgVivo);
        return {
          categoria: item.categoria,
          categoriaReferencia,
          cabezas: item.cabezas,
          pesoTotalKg: Math.round(item.pesoTotalKg),
          precioKgVivo,
          valorEstimado,
        };
      });

      const valorHaciendaEstimado =
        totalCabezas > 0
          ? valuacionPorCategoria.reduce((acc, item) => acc + item.valorEstimado, 0)
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
        fuenteCotizacion: cotizaciones.fuente,
        fechaCotizacion: cotizaciones.fechaRueda,
        esCotizacionEnVivo: Boolean(cotizaciones.esEnVivo),
      };

      const vacasLecherasLista = hacienda.filter((g) =>
        String(g.categoria || "").toLowerCase().includes("lecher")
      );
      const vacasLecheras = vacasLecherasLista.length;
      const precioLitro = Number(leche?.precioLitro) || 550.25;
      const mesActualPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

      const calcularResumenOrdenes = (listaOrdenes) => {
        if (!Array.isArray(listaOrdenes) || listaOrdenes.length === 0) {
          return null;
        }
        const ordenadas = [...listaOrdenes].sort((a, b) =>
          String(b.fecha || "").localeCompare(String(a.fecha || ""))
        );
        const ultimaFecha = ordenadas[0].fecha;
        const litrosUltimaActualizacion = Math.round(
          ordenadas
            .filter((o) => o.fecha === ultimaFecha)
            .reduce((acc, o) => acc + (Number(o.litrosSacados) || 0), 0) * 100
        ) / 100;

        const ordenesMes = ordenadas.filter((o) =>
          String(o.fecha || "").startsWith(mesActualPrefix)
        );
        const baseMensual = ordenesMes.length > 0 ? ordenesMes : ordenadas;
        const litrosMensuales = Math.round(
          baseMensual.reduce((acc, o) => acc + (Number(o.litrosSacados) || 0), 0) * 100
        ) / 100;

        return {
          ultimaFecha,
          litrosUltimaActualizacion,
          ingresoUltimaActualizacionArs: Math.round(litrosUltimaActualizacion * precioLitro),
          litrosMensuales,
          ingresoMensualArs: Math.round(litrosMensuales * precioLitro),
          cantidadRegistros: ordenadas.length,
        };
      };

      const resumenGlobalOrdenes = calcularResumenOrdenes(ordenes);

      const porParcelaLeche = potreros
        .map((p) => {
          const lecherasEnParcela = vacasLecherasLista.filter((g) =>
            p.id && g.potreroId
              ? g.potreroId === p.id
              : (g.potreroNombre || "").toLowerCase() === (p.nombre || "").toLowerCase()
          );
          if (lecherasEnParcela.length === 0) return null;

          const idsSet = new Set(lecherasEnParcela.map((a) => a.id));
          const ordenesParcela = ordenes.filter((o) => idsSet.has(o.animalId));
          const resumenParcela = calcularResumenOrdenes(ordenesParcela);
          if (!resumenParcela) return null;

          return {
            potreroId: p.id,
            potreroNombre: p.nombre,
            vacasLecheras: lecherasEnParcela.length,
            ...resumenParcela,
          };
        })
        .filter(Boolean);

      const reporte = {
        resumenGanado: metricasGanado,
        resumenGeneral,
        valuacionPorCategoria,
        tamboLeche: {
          ...leche,
          vacasLecheras,
          tieneOrdenes: Boolean(resumenGlobalOrdenes),
          ultimaFecha: resumenGlobalOrdenes?.ultimaFecha || null,
          litrosUltimaActualizacion: resumenGlobalOrdenes?.litrosUltimaActualizacion || 0,
          ingresoUltimaActualizacionArs: resumenGlobalOrdenes?.ingresoUltimaActualizacionArs || 0,
          litrosMensuales: resumenGlobalOrdenes?.litrosMensuales || 0,
          ingresoMensualArs: resumenGlobalOrdenes?.ingresoMensualArs || 0,
          porParcela: porParcelaLeche,
        },
        cotizacionesMercado: {
          mercado: cotizaciones.mercado,
          fechaRueda: cotizaciones.fechaRueda,
          esEnVivo: cotizaciones.esEnVivo,
          fuente: cotizaciones.fuente,
          indices: cotizaciones.indices,
          categorias: cotizaciones.categorias,
        },
        dolar: {
          proveedor: dolar.proveedor,
          esEnVivo: dolar.esEnVivo,
          fuente: dolar.fuente,
          fechaActualizacion: dolar.fechaActualizacion,
          cotizaciones: dolar.cotizaciones,
        },
        distribucionPotreros: potreros,
        haciendaDetalle: hacienda,
        insumosCriticos,
        totalPartes: partes.length,
        partesAprobados: partes.filter((p) => (p.estado || "").toUpperCase() === "APROBADO").length,
        partesPendientes: partes.filter((p) => (p.estado || "").toUpperCase() === "PENDIENTE").length,
        reproduccionResumen: ReproduccionModel.obtenerResumen(
          estId,
          pesoPorCategoria
            .filter((item) => String(item.categoria || "").toLowerCase().includes("vaca"))
            .reduce((acc, item) => acc + (Number(item.cabezas) || 0), 0)
        ),
        finanzasResumen: FinanzasModel.obtenerResumen(estId),
        fechaGeneracion: new Date().toISOString(),
      };

      return exito(res, reporte, "Reportes consolidados generados exitosamente.");
    } catch (err) {
      return error(res, "Error al generar reportes: " + err.message, 500);
    }
  }

  // 8. Permisos de Modificación/Alta de Parcelas (Oficina -> Dueño)
  static async obtenerPermisosParcelas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const resultado = await ParcelaPermisoModel.obtenerEstadoYSolicitudes({
        usuarioId: req.usuario?.id,
        rol: req.usuario?.rol,
        establecimientoId: estId,
      });
      return exito(res, resultado);
    } catch (err) {
      return error(res, err.message || "Error al consultar permisos de parcelas.", err.status || 400);
    }
  }

  static async solicitarPermisoParcelas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const { accion, parcelaId, parcelaNombre, motivo } = req.body || {};
      const solicitud = await ParcelaPermisoModel.solicitarPermiso({
        solicitanteId: req.usuario?.id,
        establecimientoId: estId,
        accion,
        parcelaId,
        parcelaNombre,
        motivo,
      });
      return exito(res, solicitud, "Solicitud de permiso de parcela enviada.", 201);
    } catch (err) {
      return error(res, err.message || "Error al solicitar permiso de parcela.", err.status || 400);
    }
  }

  static async responderPermisoParcelas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const { solicitudId } = req.params;
      const { estado } = req.body || {};
      const actualizada = await ParcelaPermisoModel.responderSolicitud({
        solicitudId,
        revisorId: req.usuario?.id,
        establecimientoId: estId,
        estado,
      });
      return exito(res, actualizada, "Solicitud de permiso de parcela actualizada.");
    } catch (err) {
      return error(res, err.message || "Error al responder solicitud de parcela.", err.status || 400);
    }
  }

  // 9. Notificaciones consolidadas
  static async obtenerNotificaciones(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const [alertas, criticos, pendientes, permisos] = await Promise.all([
        SanidadModel.obtenerAlertasActivas(estId),
        InsumoModel.obtenerCriticos(estId),
        ParteDiarioModel.obtenerPendientes(estId),
        ParcelaPermisoModel.obtenerEstadoYSolicitudes({
          usuarioId: req.usuario?.id,
          rol: req.usuario?.rol,
          establecimientoId: estId,
        }).catch(() => ({ solicitudesPendientes: [] })),
      ]);

      const solicitudesPendientes = permisos?.solicitudesPendientes || [];
      const notificaciones = solicitudesPendientes.map((sol) => ({
        id: `notif-perm-${sol.id}`,
        tipo: "permiso_parcela",
        solicitudId: sol.id,
        titulo: `Solicitud de permiso de parcela (${sol.accion})`,
        mensaje: `${sol.solicitanteNombre || "Administración"} solicita permiso para ${sol.accion}`,
        fecha: sol.fechaSolicitud,
      }));

      return exito(res, {
        alertasSanitarias: alertas.length,
        insumosCriticos: criticos.length,
        partesPendientes: pendientes.length,
        solicitudesParcelas: solicitudesPendientes.length,
        notificaciones,
        total:
          alertas.length +
          criticos.length +
          pendientes.length +
          solicitudesPendientes.length,
      });
    } catch (err) {
      return error(res, "Error al consultar notificaciones: " + err.message, 500);
    }
  }

  // 10. Reproducción y Preñez (Sub-módulo de Ganado)
  static async obtenerReproduccion(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const pesoPorCategoria = await GanadoModel.obtenerPesoPorCategoria(estId);
      const totalVientres = pesoPorCategoria
        .filter((item) => String(item.categoria || "").toLowerCase().includes("vaca"))
        .reduce((acc, item) => acc + (Number(item.cabezas) || 0), 0);
      return exito(res, {
        eventos: ReproduccionModel.listar(estId),
        resumen: ReproduccionModel.obtenerResumen(estId, totalVientres),
      });
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  static registrarReproduccion(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const creado = ReproduccionModel.registrar(estId, req.body || {});
      return exito(res, creado, "Evento reproductivo registrado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static eliminarReproduccion(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = ReproduccionModel.eliminar(req.params.id, estId);
      return exito(res, eliminado, "Evento reproductivo eliminado.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  // 11. Costos y Finanzas
  static obtenerFinanzas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      return exito(res, FinanzasModel.obtenerResumen(estId));
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  static registrarCostoFinanzas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const creado = FinanzasModel.registrarCosto(estId, req.body || {});
      return exito(res, creado, "Costo operativo registrado exitosamente.", 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static eliminarCostoFinanzas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = FinanzasModel.eliminarCosto(req.params.id, estId);
      return exito(res, eliminado, "Costo operativo eliminado.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  static guardarParametrosFinanzas(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const guardado = FinanzasModel.guardarParametros(estId, req.body || {});
      return exito(res, guardado, "Parámetros productivos guardados.");
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }
}

module.exports = DashboardController;
