"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { aplicarGesto, recortarSeleccion } from "@/lib/utils/seleccion-filas";

type Arrastre = {
  pointerId: number;
  pointerType: string;
  startId: string;
  startX: number;
  startY: number;
  ctrl: boolean;
  shift: boolean;
  moved: boolean;
  base: string[];
};

function esInteractivo(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest("button, a, input, select, textarea, [data-no-select]")
  );
}

/**
 * Selección de filas estilo Excel:
 * - clic: solo esa fila
 * - Ctrl/Cmd: alterna
 * - Mayús: rango desde el ancla
 * - arrastrar: rango (con Ctrl, se suma a lo ya seleccionado)
 * - toque: alterna, para poder marcar varias en el teléfono sin teclado
 */
export function useSeleccionFilas(idsEnOrden: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const selectedRef = useRef(selectedIds);
  const idsRef = useRef(idsEnOrden);
  const anchorRef = useRef<string | null>(null);
  const dragRef = useRef<Arrastre | null>(null);
  useEffect(() => {
    selectedRef.current = selectedIds;
    idsRef.current = idsEnOrden;
  });

  const idsKey = idsEnOrden.join("\0");
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = recortarSeleccion(prev, idsRef.current);
      if (next.size === prev.size) {
        for (const id of next) if (!prev.has(id)) return next;
        return prev;
      }
      return next;
    });
  }, [idsKey]);

  useEffect(() => {
    function terminar(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);

      if (d.pointerType === "touch") {
        const dx = Math.abs(e.clientX - d.startX);
        const dy = Math.abs(e.clientY - d.startY);
        if (dx < 12 && dy < 12) {
          setSelectedIds(aplicarGesto(idsRef.current, selectedRef.current, { tipo: "alternar", id: d.startId }));
          anchorRef.current = d.startId;
        }
        return;
      }

      if (d.moved) {
        anchorRef.current = d.startId;
        return;
      }

      if (d.shift && anchorRef.current) {
        setSelectedIds(
          aplicarGesto(idsRef.current, selectedRef.current, {
            tipo: "rango-reemplazar",
            desdeId: anchorRef.current,
            hastaId: d.startId,
          })
        );
        return;
      }

      if (d.ctrl) {
        setSelectedIds(aplicarGesto(idsRef.current, selectedRef.current, { tipo: "alternar", id: d.startId }));
        anchorRef.current = d.startId;
        return;
      }

      setSelectedIds(aplicarGesto(idsRef.current, selectedRef.current, { tipo: "reemplazar", id: d.startId }));
      anchorRef.current = d.startId;
    }

    window.addEventListener("pointerup", terminar);
    window.addEventListener("pointercancel", terminar);
    return () => {
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
    };
  }, []);

  function onPointerDown(id: string, e: ReactPointerEvent) {
    if (esInteractivo(e.target)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragRef.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startId: id,
      startX: e.clientX,
      startY: e.clientY,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      moved: false,
      base: [...selectedRef.current],
    };

    if (e.pointerType === "mouse") e.preventDefault();
  }

  function onPointerEnter(id: string) {
    const d = dragRef.current;
    if (!d || d.pointerType !== "mouse" || d.shift || id === d.startId) return;
    d.moved = true;
    setDragging(true);
    setSelectedIds(
      d.ctrl
        ? aplicarGesto(idsRef.current, selectedRef.current, {
            tipo: "rango-sumar",
            desdeId: d.startId,
            hastaId: id,
            base: d.base,
          })
        : aplicarGesto(idsRef.current, selectedRef.current, {
            tipo: "rango-reemplazar",
            desdeId: d.startId,
            hastaId: id,
          })
    );
  }

  function rowProps(id: string) {
    const selected = selectedIds.has(id);
    return {
      "data-state": selected ? ("selected" as const) : undefined,
      "aria-selected": selected,
      onPointerDown: (e: ReactPointerEvent) => onPointerDown(id, e),
      onPointerEnter: () => onPointerEnter(id),
    };
  }

  function limpiar() {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }

  return { selectedIds, dragging, rowProps, limpiar };
}
