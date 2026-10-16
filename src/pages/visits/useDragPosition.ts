import { useCallback, useEffect, useRef, useState } from "react";

type DragStart = { pointerX: number; pointerY: number; startX: number; startY: number };
type Position = { x: number; y: number };

/**
 * Reusable pointer-based dialog dragging.
 * Replaces the two duplicated pointermove/pointerup effects in the original page.
 */
export function useDragPosition(initial: Position = { x: 0, y: 0 }) {
  const [position, setPosition] = useState<Position>(initial);
  const dragRef = useRef<DragStart | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setPosition({
        x: drag.startX + event.clientX - drag.pointerX,
        y: drag.startY + event.clientY - drag.pointerY,
      });
    }
    function handlePointerUp() {
      dragRef.current = null;
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const startDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [position.x, position.y]);

  const reset = useCallback(() => setPosition({ x: 0, y: 0 }), []);

  return { position, startDrag, reset };
}
