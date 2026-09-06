// Set de íconos propios en SVG, trazo simple, sin depender de librerías externas.

export function IconoCabeza(props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M14 20c-3 0-5-3-5-6s2-5 4-5 3 2 3 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M34 20c3 0 5-3 5-6s-2-5-4-5-3 2-3 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 22c0-7 5-12 12-12s12 5 12 12c0 8-4 14-6 16-1.5 1.5-3.5 2-6 2s-4.5-.5-6-2c-2-2-6-8-6-16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="23" r="1.6" fill="currentColor" />
      <circle cx="29" cy="23" r="1.6" fill="currentColor" />
      <path d="M20 30c1.2 1 2.6 1.4 4 1.4s2.8-.4 4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoGenetica(props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M16 8c0 8 16 8 16 16s-16 8-16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 8c0 8-16 8-16 16s16 8 16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M17 13h14M17 35h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 20.5h9M19.5 27.5h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoNutricion(props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M24 10c-7 0-12 5-12 12 0 8 6 15 12 15s12-7 12-15c0-7-5-12-12-12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M24 10c0-3 2-5 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 24h14M20 30h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoTecnologia(props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="8" y="12" width="32" height="20" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 26h32" stroke="currentColor" strokeWidth="2" />
      <path d="M19 38h10M24 32v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 19l4 3-4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoBienestar(props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M24 37s-13-7.6-13-17.3C11 14.5 14.7 11 19 11c2.4 0 4.6 1.2 5.9 3.1L24 15.5l-.9-1.4C24.4 12.2 26.6 11 29 11c4.3 0 8 3.5 8 8.7C37 29.4 24 37 24 37Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 21l3.5 3.5L26 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const ICONOS_SERVICIOS = {
  genetica: IconoGenetica,
  nutricion: IconoNutricion,
  tecnologia: IconoTecnologia,
  bienestar: IconoBienestar,
};

export function IconoCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
