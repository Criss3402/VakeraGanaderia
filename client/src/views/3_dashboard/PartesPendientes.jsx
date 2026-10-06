import { useState } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import { registrarParteDiario, actualizarEstadoParte } from "../../api/dashboard.api";
import { useAuth } from "../../context/AuthContext";

export default function PartesPendientes({ partes = [], cargando = false, alActualizar }) {
  const { rol, usuario } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [nuevoParte, setNuevoParte] = useState({
    potrero: "Potrero 1 - Los Eucaliptos",
    novedades: "",
    animalesRevisados: 50,
    solicitudInsumos: "",
  });

  const puedeAprobar = rol === "capataz" || rol === "dueno";
  const puedeCargar = rol === "peon" || rol === "capataz" || rol === "dueno";

  async function manejarCambioEstado(id, nuevoEstado) {
    try {
      await actualizarEstadoParte(id, nuevoEstado);
      if (alActualizar) alActualizar();
    } catch (err) {
      alert("Error al actualizar parte: " + err.message);
    }
  }

  async function manejarCrearParte(e) {
    e.preventDefault();
    setErrorModal("");
    setGuardando(true);

    try {
      await registrarParteDiario(nuevoParte);
      setModalAbierto(false);
      setNuevoParte({
        potrero: "Potrero 1 - Los Eucaliptos",
        novedades: "",
        animalesRevisados: 50,
        solicitudInsumos: "",
      });
      if (alActualizar) alActualizar();
    } catch (err) {
      setErrorModal(err.message || "Error al cargar parte");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card
      titulo="Partes Diarios de Campo"
      subtitulo="Comunicación operativa directa entre peones y capataz"
      accion={
        puedeCargar && (
          <Button
            variante="relleno"
            tamano="sm"
            onClick={() => setModalAbierto(true)}
          >
            + Cargar Parte Diario
          </Button>
        )
      }
    >
      {cargando ? (
        <p className="texto-muted">Cargando partes diarios...</p>
      ) : partes.length === 0 ? (
        <p className="texto-muted">No se han registrado partes diarios aún.</p>
      ) : (
        <div className="lista-partes">
          {partes.map((p) => {
            const estadoMayus = (p.estado || "").toUpperCase();
            const esPendiente = estadoMayus === "PENDIENTE";
            const varianteBadge =
              estadoMayus === "APROBADO" ? "exito" : estadoMayus === "RECHAZADO" ? "peligro" : "alerta";
            const textoEstado =
              estadoMayus === "APROBADO" ? "Aprobado" : estadoMayus === "RECHAZADO" ? "Rechazado" : "Pendiente";

            return (
              <article
                key={p.id}
                className={`parte-card ${esPendiente ? "parte-card--pendiente" : ""}`}
              >
                <div className="parte-card__header">
                  <div>
                    <span className="parte-card__fecha">📅 {p.fecha}</span> •{" "}
                    <strong>{p.potrero}</strong>
                  </div>
                  <Badge variante={varianteBadge} tamano="sm">
                    {textoEstado}
                  </Badge>
                </div>

                <div className="parte-card__cuerpo">
                  <p className="parte-card__novedades">{p.novedades}</p>

                  <div className="parte-card__meta">
                    <span>
                      Operario: <strong>{p.peonNombre}</strong>
                    </span>
                    <span>
                      Animales revisados: <strong>{p.animalesRevisados}</strong>
                    </span>
                    {p.solicitudInsumos && (
                      <span className="parte-card__insumo-alerta">
                        ⚠️ Solicitud: <em>{p.solicitudInsumos}</em>
                      </span>
                    )}
                  </div>

                  {p.revisadoPor && (
                    <p className="parte-card__revisor">
                      Revisado por: {p.revisadoPor}
                    </p>
                  )}
                </div>

                {puedeAprobar && esPendiente && (
                  <div className="parte-card__acciones">
                    <Button
                      variante="exito"
                      tamano="sm"
                      onClick={() => manejarCambioEstado(p.id, "APROBADO")}
                    >
                      ✓ Aprobar Novedades
                    </Button>
                    <Button
                      variante="peligro"
                      tamano="sm"
                      onClick={() => manejarCambioEstado(p.id, "RECHAZADO")}
                    >
                      ✕ Rechazar / Observar
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal para que el Peón o Capataz cargue novedades */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo="Cargar Novedad o Parte Diario de Campo"
      >
        {errorModal && <Alert tipo="error">{errorModal}</Alert>}

        <form onSubmit={manejarCrearParte} className="form-modal">
          <div className="campo-formulario">
            <label className="campo-formulario__label" htmlFor="potrero">
              Potrero Asignado
            </label>
            <select
              id="potrero"
              value={nuevoParte.potrero}
              onChange={(e) =>
                setNuevoParte((prev) => ({ ...prev, potrero: e.target.value }))
              }
              className="campo-formulario__input"
            >
              <option value="Potrero 1 - Los Eucaliptos">Potrero 1 - Los Eucaliptos</option>
              <option value="Potrero 2 - La Loma">Potrero 2 - La Loma</option>
              <option value="Potrero 3 - El Trébol">Potrero 3 - El Trébol</option>
              <option value="Potrero 4 - Bajo Hondo">Potrero 4 - Bajo Hondo</option>
              <option value="Potrero 5 - La Aguada">Potrero 5 - La Aguada</option>
            </select>
          </div>

          <div className="campo-formulario">
            <label className="campo-formulario__label" htmlFor="animales">
              Cabezas de ganado observadas
            </label>
            <input
              id="animales"
              type="number"
              min="0"
              value={nuevoParte.animalesRevisados}
              onChange={(e) =>
                setNuevoParte((prev) => ({
                  ...prev,
                  animalesRevisados: e.target.value,
                }))
              }
              className="campo-formulario__input"
            />
          </div>

          <div className="campo-formulario">
            <label className="campo-formulario__label" htmlFor="novedades">
              Novedades del rodeo (nacimientos, animales rengos, alambrados) *
            </label>
            <textarea
              id="novedades"
              rows={3}
              required
              placeholder="Describí las novedades observadas en la recorrida diaria..."
              value={nuevoParte.novedades}
              onChange={(e) =>
                setNuevoParte((prev) => ({ ...prev, novedades: e.target.value }))
              }
              className="campo-formulario__input"
            />
          </div>

          <Input
            label="Solicitud de insumos o herramientas (opcional)"
            nombre="solicitudInsumos"
            placeholder="Ej: Faltan 2 rollos de alambre o jeringas descartables"
            valor={nuevoParte.solicitudInsumos}
            onChange={(e) =>
              setNuevoParte((prev) => ({
                ...prev,
                solicitudInsumos: e.target.value,
              }))
            }
          />

          <div className="modal-acciones">
            <Button
              variante="fantasma"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              tipo="submit"
              variante="relleno"
              cargando={guardando}
            >
              Guardar y Enviar Parte
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
