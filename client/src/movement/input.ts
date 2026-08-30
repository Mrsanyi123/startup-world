import * as THREE from "three";

/**
 * Raw input collection for the movement controller. No world math here —
 * this only turns DOM events into a move vector and an accumulated
 * look-drag delta (in pixels; the controller applies sensitivity).
 */

export interface Input {
  /** x: strafe (-1 left … +1 right), y: forward (-1 back … +1 forward). */
  moveVector(out: THREE.Vector2): THREE.Vector2;
  /** Horizontal look-drag delta in pixels since the last call, then reset. */
  consumeLookDeltaX(): number;
  dispose(): void;
}

/** True while a form field is focused — the future HUD must not move the character. */
export function isTyping(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

const FORWARD_KEYS = ["KeyW", "ArrowUp"];
const BACK_KEYS = ["KeyS", "ArrowDown"];
const LEFT_KEYS = ["KeyA", "ArrowLeft"];
const RIGHT_KEYS = ["KeyD", "ArrowRight"];
const ALL_KEYS = [...FORWARD_KEYS, ...BACK_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS];

export function createInput(lookSurface: HTMLElement): Input {
  const pressed = new Set<string>();
  let lookDeltaX = 0;
  let dragging = false;
  let lastPointerX = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping() || !ALL_KEYS.includes(e.code)) return;
    e.preventDefault(); // stop arrow keys scrolling the page
    pressed.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    pressed.delete(e.code);
  };
  const onBlur = () => {
    pressed.clear();
    dragging = false;
  };

  // Click-and-drag to look (kept deliberately simple; no pointer lock, so no
  // "click to play" overlay is needed).
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    lastPointerX = e.clientX;
    lookSurface.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    lookDeltaX += e.clientX - lastPointerX;
    lastPointerX = e.clientX;
  };
  const onPointerEnd = () => {
    dragging = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  lookSurface.addEventListener("pointerdown", onPointerDown);
  lookSurface.addEventListener("pointermove", onPointerMove);
  lookSurface.addEventListener("pointerup", onPointerEnd);
  lookSurface.addEventListener("pointercancel", onPointerEnd);

  const has = (codes: string[]) => codes.some((c) => pressed.has(c));

  return {
    moveVector(out: THREE.Vector2): THREE.Vector2 {
      out.set(
        (has(RIGHT_KEYS) ? 1 : 0) - (has(LEFT_KEYS) ? 1 : 0),
        (has(FORWARD_KEYS) ? 1 : 0) - (has(BACK_KEYS) ? 1 : 0),
      );
      return out;
    },
    consumeLookDeltaX(): number {
      const d = lookDeltaX;
      lookDeltaX = 0;
      return d;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      lookSurface.removeEventListener("pointerdown", onPointerDown);
      lookSurface.removeEventListener("pointermove", onPointerMove);
      lookSurface.removeEventListener("pointerup", onPointerEnd);
      lookSurface.removeEventListener("pointercancel", onPointerEnd);
    },
  };
}
