// Adapted from adryd325/oneko.js and tylxr59/oneko.js (MIT).
// The original license is embedded in the distributed HTML by build.mjs.
const sprite = '/images/oneko.gif';
import { clampNeko } from '../../lib/companion/hockey';
import { puckPlayPlan, goalMoment, cursorChaseTarget, pointerPuckKick } from '../../lib/companion/hockey';
const frames = { idle: [[-3, -3]], alert: [[-7, -3]], scratchSelf: [[-5, 0], [-6, 0], [-7, 0]], scratchWallN: [[0, 0], [0, -1]], tired: [[-3, -2]], sleeping: [[-2, 0], [-2, -1]], N: [[-1, -2], [-1, -3]], NE: [[0, -2], [0, -3]], E: [[-3, 0], [-3, -1]], SE: [[-5, -1], [-5, -2]], S: [[-6, -3], [-7, -2]], SW: [[-5, -3], [-6, -1]], W: [[-4, -2], [-4, -3]], NW: [[-1, 0], [-1, -1]] };
type Action = keyof typeof frames;
type Pointer = {
    x: number;
    y: number;
    dx: number;
    dy: number;
    at: number;
};
export function createNeko(reduced = false) {
    const actor = document.createElement('div');
    actor.className = 'neko-actor';
    actor.dataset.catControl = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'neko-pet';
    button.setAttribute('aria-label', 'Погладить кошку');
    button.title = 'Погладить кошку';
    const picture = document.createElement('span');
    picture.className = 'neko-sprite';
    picture.style.backgroundImage = `url("${sprite}")`;
    picture.setAttribute('aria-hidden', 'true');
    button.append(picture);
    const caption = document.createElement('span');
    caption.className = 'neko-caption';
    caption.setAttribute('aria-hidden', 'true');
    actor.append(button, caption);
    document.body.append(actor);
    const puck = document.createElement('span');
    puck.className = 'neko-puck';
    puck.setAttribute('aria-hidden', 'true');
    puck.hidden = reduced;
    document.body.append(puck);
    const viewport = () => ({ width: document.documentElement.clientWidth, height: innerHeight });
    let index = 0, frame = 0, petUntil = 0, goalAt: number | null = null, phaseAt = 0;
    let phase: 'approach' | 'swat' | 'chase' | 'rest' = 'approach';
    let plan = puckPlayPlan(index, viewport());
    let position = { ...plan.catStart };
    let puckPosition = { ...plan.puckStart };
    let pointer: Pointer | null = null, interestUntil = 0, nextInterestAt = 0, lastKickAt = 0;
    let stepSeconds = .016, lastDrawing = '';
    const draw = (action: Action, n = frame) => { const sequence = frames[action], key = `${action}:${n % sequence.length}`; if (key === lastDrawing)
        return; lastDrawing = key; const [x, y] = sequence[n % sequence.length]; picture.style.backgroundPosition = `${x * 32}px ${y * 32}px`; actor.dataset.action = action; };
    const place = () => { actor.style.transform = `translate(${Math.round(position.x - 32)}px,${Math.round(position.y - 32)}px)`; actor.dataset.edge = position.x < 180 ? 'left' : 'right'; actor.dataset.high = String(position.y < 160); puck.style.transform = `translate(${Math.round(puckPosition.x - 11)}px,${Math.round(puckPosition.y - 7)}px)`; };
    const quiet = () => { actor.classList.remove('neko-talking', 'neko-goal-hop'); caption.textContent = ''; };
    function move(target: {
        x: number;
        y: number;
    }) {
        const dx = target.x - position.x, dy = target.y - position.y, distance = Math.hypot(dx, dy);
        const speed = Math.max(90, Math.min(320, Math.hypot(viewport().width, viewport().height) * .17));
        const step = speed * stepSeconds;
        if (distance <= Math.max(3, step)) {
            position = { ...target };
            return true;
        }
        let direction = dy / distance < -.5 ? 'N' : dy / distance > .5 ? 'S' : '';
        direction += dx / distance < -.5 ? 'W' : dx / distance > .5 ? 'E' : '';
        draw(direction as Action);
        position.x += dx / distance * step;
        position.y += dy / distance * step;
        return false;
    }
    function resetPlay() {
        puckPosition = clampNeko(puckPosition, viewport());
        plan = puckPlayPlan(index, viewport(), puckPosition);
        phase = 'approach';
        phaseAt = 0;
        puck.dataset.moving = 'false';
    }
    function tick() {
        if (document.hidden)
            return;
        frame = Math.floor(Date.now() / 100);
        position = clampNeko(position, viewport());
        const now = Date.now();
        if (goalAt !== null) {
            const moment = goalMoment(now - goalAt, reduced);
            if (moment.done) {
                goalAt = null;
                quiet();
                resetPlay();
            }
            else {
                actor.dataset.scene = 'goal';
                actor.dataset.goalPhase = moment.phase;
                actor.classList.toggle('neko-goal-hop', moment.hop);
                draw(moment.action as Action, 0);
                place();
                return;
            }
        }
        if (Date.now() < petUntil) {
            draw(reduced ? 'idle' : 'scratchSelf');
            place();
            return;
        }
        if (actor.dataset.scene === 'petting') {
            quiet();
            resetPlay();
        }
        if (reduced) {
            actor.dataset.scene = 'idle';
            draw('idle');
            place();
            return;
        }
        if (pointer && now - pointer.at < 1800 && now - lastKickAt > 900) {
            const end = pointerPuckKick(puckPosition, pointer, viewport());
            if (end && Math.hypot(end.x - puckPosition.x, end.y - puckPosition.y) > 5) {
                const dx = end.x - puckPosition.x, dy = end.y - puckPosition.y, distance = Math.hypot(dx, dy);
                plan = { puckStart: { ...puckPosition }, puckEnd: end, catStart: { ...position }, catEnd: clampNeko({ x: end.x - dx / distance * 26, y: end.y - dy / distance * 26 }, viewport()) };
                phase = 'chase';
                phaseAt = now;
                lastKickAt = now;
                interestUntil = 0;
                nextInterestAt = now + 2200;
                puck.dataset.moving = 'true';
            }
        }
        if (pointer && now - pointer.at < 1800 && !interestUntil && now >= nextInterestAt)
            interestUntil = now + 6000;
        const cursorTarget = interestUntil && now < interestUntil ? cursorChaseTarget(position, pointer, viewport(), now) : null;
        if (cursorTarget) {
            actor.dataset.scene = 'cursor-chase';
            puck.dataset.moving = 'false';
            if (move(cursorTarget))
                draw('alert');
            place();
            return;
        }
        if (interestUntil) {
            interestUntil = 0;
            nextInterestAt = now + 4500;
            resetPlay();
        }
        actor.dataset.scene = phase === 'rest' ? 'sleeping' : `puck-${phase}`;
        if (phase === 'rest') {
            draw('sleeping', Math.floor(frame / 4));
            if (now - phaseAt >= 6500) {
                resetPlay();
                draw('alert');
            }
        }
        else if (phase === 'approach') {
            if (move(plan.catStart)) {
                phase = 'swat';
                phaseAt = now;
                draw('alert');
            }
        }
        else if (phase === 'swat') {
            draw('scratchSelf');
            if (now - phaseAt >= 600) {
                phase = 'chase';
                phaseAt = now;
                puck.dataset.moving = 'true';
            }
        }
        else {
            const progress = Math.min(1, (now - phaseAt) / 1000);
            const eased = 1 - Math.pow(1 - progress, 2);
            puckPosition = { x: plan.puckStart.x + (plan.puckEnd.x - plan.puckStart.x) * eased, y: plan.puckStart.y + (plan.puckEnd.y - plan.puckStart.y) * eased };
            const caught = move(plan.catEnd);
            if (progress === 1) {
                puck.dataset.moving = 'false';
            }
            if (progress === 1 && caught) {
                index++;
                if (index % 4 === 0) {
                    phase = 'rest';
                    phaseAt = now;
                }
                else {
                    plan = puckPlayPlan(index, viewport(), puckPosition);
                    phase = 'approach';
                }
            }
        }
        place();
    }
    const hearts = new Set<HTMLElement>();
    const pet = () => {
        goalAt = null;
        interestUntil = 0;
        nextInterestAt = Date.now() + 3500;
        quiet();
        petUntil = Date.now() + 1800;
        caption.textContent = 'Мрр…';
        actor.classList.add('neko-talking');
        actor.dataset.scene = 'petting';
        puck.dataset.moving = 'false';
        for (let i = 0; i < 6; i++) {
            const heart = document.createElement('i');
            heart.className = 'neko-heart';
            heart.textContent = '♥';
            heart.setAttribute('aria-hidden', 'true');
            heart.style.setProperty('--hx', `${(i - 2.5) * 12}px`);
            heart.style.setProperty('--delay', `${i * 55}ms`);
            actor.append(heart);
            hearts.add(heart);
            heart.addEventListener('animationend', () => { heart.remove(); hearts.delete(heart); }, { once: true });
        }
    };
    const goal = () => { goalAt = Date.now(); interestUntil = 0; nextInterestAt = Date.now() + 4500; petUntil = 0; quiet(); caption.textContent = 'ГОООЛ'; actor.classList.add('neko-talking'); actor.dataset.scene = 'goal'; actor.dataset.goalPhase = 'notice'; puck.dataset.moving = 'false'; draw(reduced ? 'idle' : 'alert'); place(); };
    const resize = () => { position = clampNeko(position, viewport()); pointer = null; interestUntil = 0; resetPlay(); place(); };
    const pointerMove = (event: PointerEvent) => {
        if (reduced || event.pointerType === 'touch')
            return;
        if (event.target instanceof Element && event.target.closest('[data-cat-control],.neko-settings,input,textarea,select,[contenteditable=true]')) {
            pointer = null;
            return;
        }
        pointer = { x: event.clientX, y: event.clientY, dx: pointer ? event.clientX - pointer.x : 0, dy: pointer ? event.clientY - pointer.y : 0, at: Date.now() };
    };
    const pointerOut = (event: PointerEvent) => { if (!event.relatedTarget)
        pointer = null; };
    button.addEventListener('click', pet);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    window.addEventListener('pointerout', pointerOut, { passive: true });
    let animation = 0, lastFrame = 0;
    const animate = (time: number) => { stepSeconds = lastFrame ? Math.min(.05, (time - lastFrame) / 1000) : .016; lastFrame = time; tick(); animation = requestAnimationFrame(animate); };
    draw('idle');
    place();
    animation = requestAnimationFrame(animate);
    return { goal, destroy() { cancelAnimationFrame(animation); button.removeEventListener('click', pet); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerout', pointerOut); actor.remove(); puck.remove(); hearts.clear(); } };
}
