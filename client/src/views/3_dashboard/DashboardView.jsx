import { useEffect, useState } from "react";
import MetricCards from "./MetricCards";
import AlertasVacunacion from "./AlertasVacunacion";
import InsumosCriticos from "./InsumosCriticos";
import PartesPendientes from "./PartesPendientes";
import Alert from "../../components/ui/Alert";
import {
  obtenerMetricas,
  obtenerAlertasSanitarias,
  obtenerInsumosCriticos,
  obtenerPartesDiarios,
} from "../../api/dashboard.api";
import { useAuth } from "../../context/AuthContext";

export default function DashboardView({ seccionActiva = "metricas" }) {
  const { rol, usuario } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargarDatos() {
    setCargando(true);
    setError("");
    try {
      const [resMetricas, resAlertas, resInsumos, resPartes] = await Promise.all([
        obtenerMetricas().catch(() => null),
        obtenerAlertasSanitarias().catch(() => null),
        obtenerInsumosCriticos().catch(() => null),
        obtenerPartesDiarios().catch(() => null),
      ]);

      if (resMetricas?.data) setMetricas(resMetricas.data);
      if (resAlertas?.data) setAlertas(resAlertas.data);
      if (resInsumos?.data) setInsumos(resInsumos.data);
      if (resPartes?.data) setPartes(resPartes.data);
    } catch (err) {
      setError(err.message || "Error al cargar información del dashboard");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [rol]);

  return (
    <div className="dashboard-contenedor">
      {error && <Alert tipo="error">{error}</Alert>}

      {/* Si la sección activa es 'metricas' (Panel General) */}
      {seccionActiva === "metricas" && (
        <>
          <div className="dashboard-bienvenida">
            <h2>Bienvenido, {usuario?.nombre || "Usuario"}</h2>
            <p>
              Establecimiento: <strong>{usuario?.establecimiento || "Estancia La Esperanza"}</strong> • Rol activo:{" "}
              <span className="badge-rol-activo">{rol?.toUpperCase()}</span>
            </p>
          </div>

          <MetricCards metricas={metricas} cargando={cargando} />

          <div className="dashboard-grid-dos">
            <PartesPendientes
              partes={partes}
              cargando={cargando}
              alActualizar={cargarDatos}
            />
            <AlertasVacunacion alertas={alertas} cargando={cargando} />
          </div>

          <div style={{ marginTop: "24px" }}>
            <InsumosCriticos insumos={insumos} cargando={cargando} />
          </div>
        </>
      )}

      {/* Si la sección activa es 'partes' */}
      {seccionActiva === "partes" && (
        <PartesPendientes
          partes={partes}
          cargando={cargando}
          alActualizar={cargarDatos}
        />
      )}

      {/* Si la sección activa es 'sanidad' */}
      {seccionActiva === "sanidad" && (
        <AlertasVacunacion alertas={alertas} cargando={cargando} />
      )}

      {/* Si la sección activa es 'insumos' */}
      {seccionActiva === "insumos" && (
        <InsumosCriticos insumos={insumos} cargando={cargando} />
      )}
    </div>
  );
}
