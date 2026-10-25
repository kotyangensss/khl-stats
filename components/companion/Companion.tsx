"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createNeko } from './actor';
const Context = createContext({ enabled: true, toggle: () => { }, goal: () => { } });
export function CompanionProvider({ children }: {
    children: ReactNode;
}) {
    const [enabled, setEnabled] = useState(true);
    const actor = useRef<ReturnType<typeof createNeko> | null>(null);
    useEffect(() => {
        if (!enabled)
            return;
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const start = () => { actor.current?.destroy(); actor.current = createNeko(motion.matches); };
        start();
        motion.addEventListener('change', start);
        return () => { motion.removeEventListener('change', start); actor.current?.destroy(); actor.current = null; };
    }, [enabled]);
    return <Context.Provider value={{ enabled, toggle: () => setEnabled(value => !value), goal: () => actor.current?.goal() }}>{children}</Context.Provider>;
}
export function CompanionControls() {
    const { enabled, toggle, goal } = useContext(Context);
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node))
            setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') {
            setOpen(false);
            trigger.current?.focus();
        } };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [open]);
    return <div ref={container} className="cat-preference" data-cat-control="">
    <button ref={trigger} type="button" className="cat-toggle" aria-expanded={open} aria-controls="cat-settings" data-enabled={enabled} onClick={() => setOpen(value => !value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M4 11V4l5 3a11 11 0 0 1 6 0l5-3v7c2 7-2 10-8 10S2 18 4 11Z"/><path d="M8 13h.01M16 13h.01M10 17l2 1 2-1" strokeLinecap="round"/></svg> Кошка <i /></button>
    {open && <section className="neko-settings" id="cat-settings" aria-label="Настройки кошки"><h2>Кошка на льду</h2><p>Гоняет шайбу, следует за курсором и мурчит, если её погладить.</p><button onClick={toggle}>{enabled ? 'Спрятать кошку' : 'Показать кошку'}</button><button disabled={!enabled} onClick={() => { goal(); setOpen(false); }}>Показать реакцию на гол</button><small>Демонстрация анимации. Счёт матча не меняется.</small></section>}
  </div>;
}
