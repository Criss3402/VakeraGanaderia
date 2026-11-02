import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../components/ui/Button.jsx";

describe("Smoke de la infraestructura de tests del cliente", () => {
  it("renderiza el botón y dispara onClick al hacer clic", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("el botón queda deshabilitado mientras carga", () => {
    render(<Button cargando>Guardar</Button>);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

