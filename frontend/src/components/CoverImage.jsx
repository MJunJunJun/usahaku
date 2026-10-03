import { useRef } from "react";
const clamp = value => Math.max(0, Math.min(100, value));
export default function CoverImage({ onPositionChange, position, style, ...props }) {
  const drag = useRef(null);
  const finish = e => { drag.current = null; if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); };
  return <img {...props} draggable={false} data-testid={onPositionChange ? "draggable-cover-image" : undefined} style={{ ...style, ...(position ? { objectPosition: position.x + "% " + position.y + "%" } : {}), ...(onPositionChange ? { cursor: "grab", touchAction: "none", userSelect: "none" } : {}) }}
    onPointerDown={e => { if (!onPositionChange || (e.pointerType === "mouse" && e.button !== 0)) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const img=e.currentTarget; const scale=Math.max(img.clientWidth/img.naturalWidth,img.clientHeight/img.naturalHeight); drag.current={x:e.clientX,y:e.clientY,position:position || {x:50,y:50},overflowX:img.naturalWidth*scale-img.clientWidth,overflowY:img.naturalHeight*scale-img.clientHeight}; }}
    onPointerMove={e => { const d=drag.current; if (!d) return; onPositionChange({ x:clamp(d.position.x-(d.overflowX>1 ? (e.clientX-d.x)/d.overflowX*100 : 0)), y:clamp(d.position.y-(d.overflowY>1 ? (e.clientY-d.y)/d.overflowY*100 : 0)) }); }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current=null; }} />;
}
