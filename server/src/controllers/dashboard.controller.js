const GanadoModel = require("../models/ganado.model");
const SanidadModel = require("../models/sanidad.model");
const InsumoModel = require("../models/insumo.model");
const ParteDiarioModel = require("../models/parteDiario.model");
const ParcelaPermisoModel = require("../models/parcelaPermiso.model");
const { ChatModel } = require("../models/chat.model");
const WeatherService = require("../services/weather.service");
const { ROLES } = require("../utils/roles.constants");
const { exito, error } = require("../utils/apiResponse");
const { emitirEventoRealtime } = require("../services/realtime.service");

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
      const rolNorm = String(req.usuario?.rol || "").toLowerCase();
      let solicitudAConsumir = null;
      if (rolNorm === ROLES.OFICINA) {
        const perm = await ParcelaPermisoModel.tienePermisoParaAccion({
          usuarioId: req.usuario?.id,
          rol: rolNorm,
          establecimientoId: estId,
          accion: "AGREGAR",
        });
        if (!perm.autorizado) {
          return error(
            res,
            "Como Administrador debes solicitar permiso al Dueño y esperar su aprobación para agregar esta parcela.",
            403
          );
        }
        solicitudAConsumir = perm.solicitudId;
      }
      const nuevo = await GanadoModel.crearPotrero(req.body, estId, estNombre);
      if (solicitudAConsumir) {
        await ParcelaPermisoModel.consumirPermiso(solicitudAConsumir);
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
      const rolNorm = String(req.usuario?.rol || "").toLowerCase();
      let solicitudAConsumir = null;
      if (rolNorm === ROLES.OFICINA) {
        const perm = await ParcelaPermisoModel.tienePermisoParaAccion({
          usuarioId: req.usuario?.id,
          rol: rolNorm,
          establecimientoId: estId,
          accion: "EDITAR",
          parcelaId: id,
        });
        if (!perm.autorizado) {
          return error(
            res,
            "Como Administrador debes solicitar permiso al Dueño y esperar su aprobación para editar esta parcela.",
            403
          );
        }
        solicitudAConsumir = perm.solicitudId;
      }
      const actualizado = await GanadoModel.actualizarPotrero(id, req.body || {}, estId);
      if (solicitudAConsumir) {
        await ParcelaPermisoModel.consumirPermiso(solicitudAConsumir);
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
      const { estado } = req.body;
      const actualizado = await SanidadModel.actualizarEstado(id, estado);
      return exito(res, actualizado, `Evento sanitario actualizado a '${estado}'.`);
    } catch (err) {
      return error(res, err.message, 400);
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
      const { cantidad, operacion } = req.body;
      const actualizado = await InsumoModel.actualizarStock(id, cantidad, operacion);
      return exito(res, actualizado, "Stock de insumo actualizado correctamente.");
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  static async eliminarInsumo(req, res) {
    try {
      const { id } = req.params;
      const { estId } = obtenerEstablecimientoContexto(req);
      const eliminado = await InsumoModel.eliminar(id, estId);
      return exito(res, eliminado, "Insumo eliminado del inventario exitosamente.");
    } catch (err) {
      return error(res, err.message, 400);
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

  // 7. Reportes Consolidados (Dueño / Oficina / Capataz / Veterinario)
  static async obtenerReportes(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const [metricasGanado, sumaPesoKg, insumosCriticos, resumenPartes, potreros, hacienda] = await Promise.all([
        GanadoModel.obtenerMetricas(estId),
        GanadoModel.obtenerSumaPesoKg(estId),
        InsumoModel.obtenerCriticos(estId),
        ParteDiarioModel.obtenerResumen(estId),
        GanadoModel.listarPotreros(estId),
        GanadoModel.listarTodos(estId),
      ]);

      const precioKgVivo = 2400; // Referencia mercado ARS
      const totalCabezas = metricasGanado.totalCabezas || 0;
      const pesoPromedio = metricasGanado.pesoPromedioKg || 0;
      const valorHaciendaEstimado = totalCabezas > 0
        ? Math.round(sumaPesoKg * precioKgVivo)
        : 0;

      const resumenGeneral = {
        totalCabezas,
        pesoPromedio,
        valorHaciendaEstimado,
        tasaMortalidad: metricasGanado.tasaMortalidadMensual || "0.0%",
        tratamientosCompletados: resumenPartes.tratamientosCompletados || 0,
      };

      const reporte = {
        resumenGanado: metricasGanado,
        resumenGeneral,
        distribucionPotreros: potreros,
        haciendaDetalle: hacienda,
        insumosCriticos,
        totalPartes: resumenPartes.totalPartes || 0,
        partesAprobados: resumenPartes.partesAprobados || 0,
        partesPendientes: resumenPartes.partesPendientes || 0,
        fechaGeneracion: new Date().toISOString(),
      };

      return exito(res, reporte, "Reportes consolidados generados exitosamente.");
    } catch (err) {
      return error(res, "Error al generar reportes: " + err.message, 500);
    }
  }

  // 8. Permisos de Modificación/Alta de Parcelas (Administrador -> Dueño)
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
      emitirEventoRealtime({
        broadcast: true,
        payload: { event: "notification_updated", tipo: "permiso_parcela" },
      });
      return exito(
        res,
        solicitud,
        solicitud.estado === "APROBADA"
          ? "Tu permiso para modificar parcelas ya se encuentra aprobado."
          : "Solicitud de permiso enviada al Dueño.",
        201
      );
    } catch (err) {
      return error(res, err.message || "No se pudo enviar la solicitud.", err.status || 400);
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
      emitirEventoRealtime({
        broadcast: true,
        payload: { event: "notification_updated", tipo: "estado_permiso_parcela" },
      });
      return exito(
        res,
        actualizada,
        actualizada.estado === "APROBADA"
          ? "Permiso aprobado para el Administrador."
          : "Solicitud de permiso rechazada."
      );
    } catch (err) {
      return error(res, err.message || "No se pudo responder la solicitud.", err.status || 400);
    }
  }

  // 9. Centro de Notificaciones (Campanita del Header)
  static async obtenerNotificaciones(req, res) {
    try {
      const { estId } = obtenerEstablecimientoContexto(req);
      const usuarioId = req.usuario?.id;
      const rolNorm = String(req.usuario?.rol || "").toLowerCase();

      const [
        permisosParcelas,
        insumosCriticos,
        eventosSanidad,
        partes,
        chatData,
      ] = await Promise.all([
        ParcelaPermisoModel.obtenerEstadoYSolicitudes({
          usuarioId,
          rol: rolNorm,
          establecimientoId: estId,
        }).catch((err) => {
          console.warn("[DashboardController.obtenerNotificaciones] Permisos parcelas:", err.message);
          return { solicitudesPendientes: [], solicitudActual: null };
        }),
        InsumoModel.obtenerCriticos(estId).catch((err) => {
          console.warn("[DashboardController.obtenerNotificaciones] Insumos:", err.message);
          return [];
        }),
        SanidadModel.listarAlertasYEventos(estId).catch((err) => {
          console.warn("[DashboardController.obtenerNotificaciones] Sanidad:", err.message);
          return [];
        }),
        ParteDiarioModel.listarTodos(estId).catch((err) => {
          console.warn("[DashboardController.obtenerNotificaciones] Partes:", err.message);
          return [];
        }),
        usuarioId
          ? ChatModel.listarContactosPermitidos(usuarioId).catch((err) => {
              console.warn("[DashboardController.obtenerNotificaciones] Chat:", err.message);
              return { solicitudesPendientes: [] };
            })
          : Promise.resolve({ solicitudesPendientes: [] }),
      ]);

      const notificaciones = [];

      // 1) Solicitudes de permiso de parcelas pendientes (para el Dueño)
      if (rolNorm === ROLES.DUENO) {
        (permisosParcelas.solicitudesPendientes || []).forEach((s) => {
          notificaciones.push({
            id: `perm-parcela-${s.id}`,
            tipo: "permiso_parcela",
            prioridad: "alta",
            titulo: "Solicitud de permiso en Parcelas",
            descripcion: `${s.solicitanteNombre} solicita permiso para ${
              s.accion === "EDITAR"
                ? `editar${s.parcelaNombre ? ` "${s.parcelaNombre}"` : " parcelas"}`
                : s.accion === "AGREGAR"
                ? "agregar parcelas"
                : "agregar y editar parcelas"
            }.${s.motivo ? ` Motivo: ${s.motivo}` : ""}`,
            fecha: s.fechaSolicitud,
            vistaDestino: "parcelas",
            solicitudId: s.id,
            requiereAccion: true,
          });
        });
      }

      // 2) Estado de solicitud de parcelas (para el Administrador)
      if (rolNorm === ROLES.OFICINA && permisosParcelas.solicitudActual) {
        const sol = permisosParcelas.solicitudActual;
        if (sol.estado === "PENDIENTE" || sol.estado === "APROBADA" || sol.estado === "RECHAZADA") {
          notificaciones.push({
            id: `mi-perm-parcela-${sol.id}-${sol.estado}`,
            tipo: "estado_permiso_parcela",
            prioridad: sol.estado === "RECHAZADA" ? "alta" : "media",
            titulo:
              sol.estado === "APROBADA"
                ? "Permiso de Parcelas aprobado"
                : sol.estado === "RECHAZADA"
                ? "Permiso de Parcelas rechazado"
                : "Permiso de Parcelas pendiente",
            descripcion:
              sol.estado === "APROBADA"
                ? "El Dueño aprobó tu permiso para agregar y editar parcelas."
                : sol.estado === "RECHAZADA"
                ? "El Dueño rechazó tu solicitud para modificar parcelas."
                : "Esperando aprobación del Dueño para agregar o editar parcelas.",
            fecha: sol.fechaRespuesta || sol.fechaSolicitud,
            vistaDestino: "parcelas",
            requiereAccion: false,
          });
        }
      }

      // 3) Solicitudes de chat pendientes (Dueño / Oficina)
      (chatData?.solicitudesPendientes || []).forEach((s) => {
        notificaciones.push({
          id: `chat-sol-${s.id}`,
          tipo: "chat",
          prioridad: "alta",
          titulo: "Solicitud de chat de Peón",
          descripcion: `${s.solicitanteNombre} solicita habilitar chat: "${s.motivo}"`,
          fecha: s.fechaSolicitud,
          vistaDestino: "dashboard",
          requiereAccion: false,
        });
      });

      // 4) Partes diarios pendientes (Dueño / Capataz)
      if (rolNorm === ROLES.DUENO || rolNorm === ROLES.CAPATAZ) {
        (partes || [])
          .filter((p) => String(p.estado || "").toUpperCase() === "PENDIENTE")
          .slice(0, 5)
          .forEach((p) => {
            notificaciones.push({
              id: `parte-${p.id}`,
              tipo: "parte",
              prioridad: "media",
              titulo: "Parte diario pendiente de revisión",
              descripcion: `${p.peonNombre || "Peón"} · ${p.potrero || "Campo"}: ${(p.novedades || "").slice(0, 75)}`,
              fecha: p.fechaCarga || p.fecha,
              vistaDestino: "partes",
              requiereAccion: false,
            });
          });
      }

      // 5) Alertas de bajo stock (Dueño / Oficina / Capataz / Veterinario)
      if (rolNorm !== ROLES.PEON) {
        (insumosCriticos || []).slice(0, 5).forEach((ins) => {
          notificaciones.push({
            id: `insumo-${ins.id}`,
            tipo: "stock",
            prioridad: "alta",
            titulo: `Stock crítico: ${ins.nombre}`,
            descripcion: `Disponible: ${ins.stockActual} ${ins.unidad || ""} (mínimo ${ins.stockMinimo}).`,
            fecha: new Date().toISOString(),
            vistaDestino: "insumos",
            requiereAccion: false,
          });
        });
      }

      // 6) Alertas sanitarias próximas / pendientes (Dueño / Veterinario / Capataz / Oficina)
      if (rolNorm !== ROLES.PEON) {
        (eventosSanidad || [])
          .filter((e) => {
            const st = String(e.estado || "").toUpperCase();
            return st.includes("PRÓX") || st.includes("PROX") || st === "PENDIENTE";
          })
          .slice(0, 5)
          .forEach((ev) => {
            notificaciones.push({
              id: `sanidad-${ev.id}`,
              tipo: "sanidad",
              prioridad: "media",
              titulo: ev.evento || "Alerta sanitaria",
              descripcion: `${ev.tipo || "Acto"} · ${ev.lote || "Rodeo"} (${ev.fechaProgramada || "Próximo"})`,
              fecha: ev.fechaProgramada || new Date().toISOString(),
              vistaDestino: "sanidad",
              requiereAccion: false,
            });
          });
      }

      return exito(res, {
        totalNoLeidas: notificaciones.length,
        notificaciones,
      });
    } catch (err) {
      return error(res, "Error al consultar notificaciones: " + err.message, 500);
    }
  }
}

module.exports = DashboardController;
