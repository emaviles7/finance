import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coincideMovimiento,
  ordenarPorFecha,
  type FiltrosMovimiento,
} from "../lib/utils/movimiento-filtros.ts";
import { conBalanceAcumulado, deltaCuentaMadre } from "../lib/utils/cuenta-madre-balance.ts";
import { aportesDeIngreso, cuentaOrigenParaTransaccion, ingresoSoloEnLinea } from "../lib/utils/ingreso-destino.ts";
import { aplicarGesto, claveLibroFila, resumirSeleccion } from "../lib/utils/seleccion-filas.ts";

const MADRE = { id: "madre-1", nombre: "Multimoney" };
const LINEA = "linea-alquiler";

const SIN_FILTROS: FiltrosMovimiento = {
  search: "",
  tipos: [],
  metodos: [],
  lineas: [],
  estados: [],
  fechaInicio: "",
  fechaFin: "",
};

describe("libro de la Cuenta Madre", () => {
  it("acumula el balance del más antiguo al más nuevo y la vista inversa no lo recalcula", () => {
    const movimientos = [
      { id: "b", fecha: "2026-07-28", createdAt: "2026-07-28T10:00:00", delta: -20 },
      { id: "a", fecha: "2026-06-29", createdAt: "2026-06-29T08:00:00", delta: 50 },
    ];
    const conBalance = conBalanceAcumulado(movimientos, 100);
    assert.deepEqual(
      conBalance.map((m) => ({ id: m.id, balance: m.balance })),
      [
        { id: "a", balance: 150 },
        { id: "b", balance: 130 },
      ]
    );

    const vista = ordenarPorFecha(conBalance, "desc");
    assert.equal(vista[0].id, "b");
    assert.equal(vista[0].balance, 130);
    assert.equal(vista[1].balance, 150);
    assert.equal(vista[0].balance, conBalance[conBalance.length - 1].balance);
  });

  it("un ingreso con línea y Cuenta Madre suma una sola vez al saldo de la cuenta", () => {
    const delta = deltaCuentaMadre(
      {
        tipo: "ingreso",
        monto: 80,
        metodo_pago: null,
        cuenta_origen_id: MADRE.id,
        cuenta_destino_id: null,
      },
      MADRE
    );
    assert.equal(delta, 80);

    const filas = conBalanceAcumulado(
      [{ id: "ing", fecha: "2026-08-01", createdAt: "2026-08-01T00:00:00", delta }],
      10
    );
    assert.equal(filas[0].balance, 90);
  });

  it("filtrar no cambia el balance histórico de las filas que siguen visibles", () => {
    const filas = conBalanceAcumulado(
      [
        { id: "1", fecha: "2026-01-01", createdAt: "2026-01-01", delta: 100, descripcion: "sueldo" },
        { id: "2", fecha: "2026-01-02", createdAt: "2026-01-02", delta: -40, descripcion: "alquiler" },
        { id: "3", fecha: "2026-01-03", createdAt: "2026-01-03", delta: 10, descripcion: "ajuste" },
      ],
      0
    );
    const visibles = filas.filter((f) =>
      coincideMovimiento(
        { fecha: f.fecha, descripcion: f.descripcion, tipo: "ingreso", pagado: true },
        { ...SIN_FILTROS, search: "sueldo" }
      )
    );
    assert.equal(visibles.length, 1);
    assert.equal(visibles[0].balance, 100);
    assert.equal(filas[2].balance, 70);
  });
});

describe("ingreso a Cuenta Madre y línea", () => {
  it("por defecto una línea no toca la Cuenta Madre", () => {
    assert.equal(ingresoSoloEnLinea("ingreso", LINEA, false), true);
    assert.equal(
      cuentaOrigenParaTransaccion({
        tipo: "ingreso",
        lineaId: LINEA,
        acreditarCuentaMadre: false,
        cuentaResueltaId: MADRE.id,
      }),
      null
    );
  });

  it("desde Cuenta Madre el monto queda en la cuenta y en la línea, en una sola fila", () => {
    const origen = cuentaOrigenParaTransaccion({
      tipo: "ingreso",
      lineaId: LINEA,
      acreditarCuentaMadre: true,
      cuentaResueltaId: MADRE.id,
    });
    assert.equal(origen, MADRE.id);

    const aportes = aportesDeIngreso({
      monto: 250,
      cuentaOrigenId: origen,
      lineaId: LINEA,
      cuentaMadreId: MADRE.id,
    });
    assert.deepEqual(aportes, { cuentaMadre: 250, linea: 250, filasEnTransacciones: 1 });
  });

  it("sin línea el ingreso solo entra a la Cuenta Madre", () => {
    const origen = cuentaOrigenParaTransaccion({
      tipo: "ingreso",
      lineaId: "",
      cuentaResueltaId: MADRE.id,
    });
    const aportes = aportesDeIngreso({
      monto: 40,
      cuentaOrigenId: origen,
      lineaId: null,
      cuentaMadreId: MADRE.id,
    });
    assert.equal(aportes.cuentaMadre, 40);
    assert.equal(aportes.linea, 0);
    assert.equal(aportes.filasEnTransacciones, 1);
  });
});

describe("filtros de movimientos", () => {
  const fila = {
    fecha: "2026-07-15",
    descripcion: "Supermercado Walmart",
    destinatario: "BAC",
    tipo: "egreso",
    metodo_pago: "Multimoney",
    linea_id: LINEA,
    pagado: false,
  };

  it("reutiliza tipo, método, línea, estado, fechas y búsqueda", () => {
    assert.equal(coincideMovimiento(fila, SIN_FILTROS), true);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, tipos: ["ingreso"] }), false);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, metodos: ["Multimoney"] }), true);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, lineas: ["otra"] }), false);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, estados: ["pendiente"] }), true);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, estados: ["pagado"] }), false);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, fechaInicio: "2026-08-01" }), false);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, search: "bac" }), true);
    assert.equal(coincideMovimiento(fila, { ...SIN_FILTROS, search: "walmart" }), true);
  });
});

describe("selección estilo Excel en la línea", () => {
  const ids = ["a", "b", "c", "d"];

  it("clic reemplaza, ctrl alterna, mayús y arrastre toman el rango", () => {
    let sel = aplicarGesto(ids, new Set(), { tipo: "reemplazar", id: "b" });
    assert.deepEqual([...sel], ["b"]);

    sel = aplicarGesto(ids, sel, { tipo: "alternar", id: "d" });
    assert.deepEqual([...sel].sort(), ["b", "d"]);

    sel = aplicarGesto(ids, sel, { tipo: "rango-reemplazar", desdeId: "a", hastaId: "c" });
    assert.deepEqual([...sel], ["a", "b", "c"]);

    sel = aplicarGesto(ids, new Set(["d"]), {
      tipo: "rango-sumar",
      desdeId: "b",
      hastaId: "c",
      base: ["d"],
    });
    assert.deepEqual([...sel].sort(), ["b", "c", "d"]);
  });

  it("suma ingresos y egresos una vez y devuelve el conteo", () => {
    const filas = [
      { clave: claveLibroFila({ id: "1", tipo: "ingreso", fecha: "2026-01-01", descripcion: "A", delta: 100, createdAt: "t1" }), delta: 100 },
      { clave: claveLibroFila({ id: "2", tipo: "egreso", fecha: "2026-01-02", descripcion: "B", delta: -40, createdAt: "t2" }), delta: -40 },
      { clave: claveLibroFila({ id: "3", tipo: "egreso", fecha: "2026-01-03", descripcion: "C", delta: -10, createdAt: "t3" }), delta: -10 },
    ];
    const resumen = resumirSeleccion(filas, new Set([filas[0].clave, filas[1].clave, filas[0].clave]));
    assert.equal(resumen.count, 2);
    assert.equal(resumen.ingresos, 100);
    assert.equal(resumen.egresos, 40);
    assert.equal(resumen.neto, 60);
  });

  it("en el teléfono alternar permite sumar varias filas", () => {
    let sel = new Set<string>();
    sel = aplicarGesto(ids, sel, { tipo: "alternar", id: "a" });
    sel = aplicarGesto(ids, sel, { tipo: "alternar", id: "c" });
    sel = aplicarGesto(ids, sel, { tipo: "alternar", id: "a" });
    assert.deepEqual([...sel], ["c"]);
  });
});
