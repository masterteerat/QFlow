import { useEffect, useRef, useState } from 'react';

// Horizontal scroller that works with a plain mouse:
//  - arrow buttons (desktop, only when there is more to scroll)
//  - click-and-drag with the mouse (touch / trackpad keep native scrolling)
//  - optional `wheel`: vertical wheel scrolls the row, but only while the row can still move
//    in that direction, so the page never gets "stuck" and never scrolls along with it.
export default function HScroller({
  children,
  className = '',
  wrapperClassName = '',
  arrows = true,
  arrowTop = 'top-1/2',
  inlineArrows = false, // arrows sit beside the row (never over the content) instead of floating on top
  wheel = false,
}) {
  const ref = useRef(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  // re-measure after every render (children change) and when the box is resized
  useEffect(() => {
    update();
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel needs a non-passive native listener (React's onWheel is passive, so preventDefault is ignored)
  useEffect(() => {
    const el = ref.current;
    if (!el || !wheel) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already a horizontal gesture
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const goingRight = e.deltaY > 0;
      const canMove = goingRight ? el.scrollLeft < max - 1 : el.scrollLeft > 1;
      if (!canMove) return; // at the edge: let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheel]);

  const scrollByPage = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = ref.current;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) {
      d.moved = true;
      ref.current.style.scrollSnapType = 'none';
      ref.current.scrollLeft = d.startLeft - dx;
    }
  };
  const endDrag = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    if (ref.current) ref.current.style.scrollSnapType = '';
  };
  // a drag must not count as a click on the card / chip underneath
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  };

  const look = 'items-center justify-center rounded-full bg-white dark:bg-ink-800 text-ink-800 dark:text-white border border-ink-200 dark:border-ink-600 hover:border-brand-400';
  const floatCls = `hidden md:flex absolute ${arrowTop} -translate-y-1/2 z-10 w-10 h-10 shadow-md ${look}`;
  const inlineCls = `hidden md:flex shrink-0 w-8 h-8 ${look}`;
  const chevL = <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
  const chevR = <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;

  const rowCls = `flex overflow-x-auto overscroll-x-contain no-scrollbar min-w-0 md:cursor-grab ${inlineArrows ? 'flex-1' : 'w-full'} ${className}`;
  const row = (
    <div
      ref={ref}
      onScroll={update}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      className={rowCls}
    >
      {children}
    </div>
  );

  if (inlineArrows) {
    // space is always reserved (invisible when not needed) so the row never jumps around
    return (
      <div className={`flex items-center gap-2 min-w-0 ${wrapperClassName}`}>
        {arrows && (
          <button type="button" aria-label="Scroll left" onClick={() => scrollByPage(-1)} className={`${inlineCls} ${edge.left ? '' : 'invisible'}`}>{chevL}</button>
        )}
        {row}
        {arrows && (
          <button type="button" aria-label="Scroll right" onClick={() => scrollByPage(1)} className={`${inlineCls} ${edge.right ? '' : 'invisible'}`}>{chevR}</button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative min-w-0 ${wrapperClassName}`}>
      {row}
      {arrows && edge.left && (
        <button type="button" aria-label="Scroll left" onClick={() => scrollByPage(-1)} className={`${floatCls} left-2`}>{chevL}</button>
      )}
      {arrows && edge.right && (
        <button type="button" aria-label="Scroll right" onClick={() => scrollByPage(1)} className={`${floatCls} right-2`}>{chevR}</button>
      )}
    </div>
  );
}
