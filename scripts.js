// =============================================================
// REFERENCIAS AL DOM
// =============================================================

const coin        = document.getElementById("coin");
const button      = document.getElementById("flipBtn");
const resultText  = document.getElementById("result");
const edgeOverlay = document.getElementById("edgeOverlay");

// Botones de apuesta
const betCara  = document.getElementById("betCara");
const betCruz  = document.getElementById("betCruz");
const betCanto = document.getElementById("betCanto");

// Contadores del historial
const countCara = document.getElementById("countCara");
const countCruz = document.getElementById("countCruz");


// =============================================================
// CONFIGURACIÓN DE LA ANIMACIÓN
// =============================================================

const FULL_SPINS     = 8;      // Número de vueltas completas antes de parar
const TOTAL_DURATION = 5000;   // Duración total del giro en ms
const CROSSFADE_MS   = 600;    // Duración del crossfade cara→canto en ms


// =============================================================
// ESTADO GLOBAL
// =============================================================

let absoluteAngle = 0; // Ángulo acumulado para evitar saltos entre lanzamientos
let tallyCara     = 0; // Contador de veces que ha salido cara
let tallyCruz     = 0; // Contador de veces que ha salido cruz


// =============================================================
// SISTEMA DE AUDIO
// =============================================================

/**
 * Crea un objeto Audio reutilizable con volumen y loop configurables.
 * @param {string} src      Ruta al fichero de audio
 * @param {number} volume   Volumen inicial (0–1)
 * @param {boolean} loop    Si debe reproducirse en bucle
 */
function createSound(src, volume = 1, loop = false) {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.loop   = loop;
    return audio;
}

const SFX = {
    ambient:    createSound("Music/ambient.mp3",    0.35, true),   // Música de fondo en bucle
    flip:       createSound("Music/flip.mp3",       0.8,  false),  // Lanzamiento de la moneda
    win:        createSound("Music/win.mp3",        0.85, false),  // Cara/Cruz: apuesta ganada
    lose:       createSound("Music/lose.mp3",       0.85, false),  // Cara/Cruz: apuesta perdida
    cantoEpic:  createSound("Music/cantoEpic.mp3", 0.85,  false),  // Canto: apuesta acertada
    cantoBad:   createSound("Music/cantoBad.mp3",  0.85, false),  // Canto: con apuesta contraria
};

let ambientStarted = false; // ¿Ha arrancado ya la música de fondo?
let firstFlipDone  = false; // ¿Se ha lanzado ya la primera moneda?

/**
 * Intenta arrancar la música ambiente en el primer gesto del usuario.
 * Los navegadores bloquean el autoplay sin interacción previa.
 */
function tryStartAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;
    SFX.ambient.play().catch(() => {
        // Si el navegador bloquea la reproducción, silenciamos sin error visible
    });
}

/**
 * Desvanece gradualmente la música ambiente y la detiene.
 * @param {number} duration  Duración del fade en ms (por defecto 1500ms)
 */
function fadeOutAmbient(duration = 1500) {
    if (!ambientStarted || SFX.ambient.paused) return;
    const steps    = 30;
    const interval = duration / steps;
    const delta    = SFX.ambient.volume / steps;

    const fade = setInterval(() => {
        if (SFX.ambient.volume > delta) {
            SFX.ambient.volume -= delta;
        } else {
            SFX.ambient.volume = 0;
            SFX.ambient.pause();
            clearInterval(fade);
        }
    }, interval);
}

/**
 * Reproduce un efecto de sonido desde el inicio,
 * interrumpiendo cualquier reproducción anterior del mismo clip.
 * @param {HTMLAudioElement} sfx
 */
function playSFX(sfx) {
    sfx.currentTime = 0;
    sfx.play().catch(() => {});
}

// Arranca el ambient en el primer clic sobre cualquier botón interactivo
[betCara, betCruz, betCanto, button].forEach(btn =>
    btn.addEventListener("click", tryStartAmbient, { once: false })
);


// =============================================================
// LÓGICA DE APUESTA
// =============================================================

/**
 * Activa la apuesta seleccionada y actualiza el estado visual de los tres botones.
 * @param {"cara"|"cruz"|"canto"} selected
 */
function applyBet(selected) {
    clearBet();
    if (selected === "canto") {
        betCanto.classList.add("bet-canto-active");
        [betCara, betCruz].forEach(btn => {
            btn.classList.add("bet-opposite");
            btn.querySelector(".bet-action").textContent = "nos quedamos";
        });
    } else {
        const selectedBtn = selected === "cara" ? betCara : betCruz;
        const oppositeBtn = selected === "cara" ? betCruz : betCara;
        selectedBtn.classList.add("bet-selected");
        selectedBtn.querySelector(".bet-action").textContent = "nos vamos";
        oppositeBtn.classList.add("bet-opposite");
        oppositeBtn.querySelector(".bet-action").textContent = "nos quedamos";
        betCanto.classList.add("bet-opposite");
    }
}

/** Limpia todos los estados de apuesta y restaura los textos por defecto. */
function clearBet() {
    [betCara, betCruz].forEach(btn => {
        btn.classList.remove("bet-selected", "bet-opposite");
        btn.querySelector(".bet-action").textContent = "nos vamos";
    });
    betCanto.classList.remove("bet-canto-active", "bet-opposite");
}

// Clicks en los botones de apuesta (segundo click deselecciona)
betCara.addEventListener("click",  () => betCara.classList.contains("bet-selected")      ? clearBet() : applyBet("cara"));
betCruz.addEventListener("click",  () => betCruz.classList.contains("bet-selected")      ? clearBet() : applyBet("cruz"));
betCanto.addEventListener("click", () => betCanto.classList.contains("bet-canto-active") ? clearBet() : applyBet("canto"));


// =============================================================
// LANZAMIENTO DE LA MONEDA
// =============================================================

button.addEventListener("click", () => {
    button.disabled = true;
    betCara.disabled = betCruz.disabled = betCanto.disabled = true;

    // Desvanece el ambient la primera vez que se lanza
    if (!firstFlipDone) {
        firstFlipDone = true;
        fadeOutAmbient(1800);
    }

    // Sonido de lanzamiento
    playSFX(SFX.flip);

    // Reinicia el resultado visual
    resultText.classList.remove("visible", "result-vamos", "result-quedamos", "result-canto", "result-canto-rainbow", "result-canto-bad");
    resultText.textContent = "";

    // Reinicia el estado visual de la moneda
    coin.style.visibility        = "visible";
    coin.style.transform         = "";
    edgeOverlay.style.opacity    = "0";
    edgeOverlay.style.transition = "none";

    // Probabilidades: 45% cara | 45% cruz | 10% canto
    const rand = Math.random();
    if      (rand <= 0.45) runNormal("Cara");
    else if (rand <= 0.90) runNormal("Cruz");
    else                  runCanto();
});

/**
 * Animación de giro normal (cara o cruz).
 * Calcula el ángulo final para que la moneda quede en la cara correcta.
 */
function runNormal(result) {
    const targetMod  = result === "Cara" ? 0 : 180;
    const currentMod = ((absoluteAngle % 360) + 360) % 360;
    let extra = (targetMod - currentMod + 360) % 360;
    if (extra === 0) extra = 360;

    const fromAngle = absoluteAngle;
    const toAngle   = absoluteAngle + (FULL_SPINS * 360) + extra;
    absoluteAngle   = toAngle;

    const anim = coin.animate(
        [
            { transform: `rotateY(${fromAngle}deg)` },
            { transform: `rotateY(${toAngle}deg)` }
        ],
        { duration: TOTAL_DURATION, easing: "cubic-bezier(0.22, 0.8, 0.1, 1)", fill: "forwards" }
    );

    anim.onfinish = () => {
        coin.style.transform = `rotateY(${toAngle}deg)`;
        anim.cancel();
        showResult(result);
    };
}

/**
 * Animación de giro para el canto (90°).
 * Al parar, aplasta la moneda con un crossfade hacia el borde lateral.
 */
function runCanto() {
    const currentMod = ((absoluteAngle % 360) + 360) % 360;
    let extra = (90 - currentMod + 360) % 360;
    if (extra === 0) extra = 360;
    const toAngle   = absoluteAngle + (FULL_SPINS * 360) + extra;
    const fromAngle = absoluteAngle;
    absoluteAngle   = toAngle;

    const spinDuration = TOTAL_DURATION - CROSSFADE_MS;

    const anim = coin.animate(
        [
            { transform: `rotateY(${fromAngle}deg) scaleX(1)`,  offset: 0 },
            { transform: `rotateY(${toAngle}deg)   scaleX(1)`,  offset: 1 }
        ],
        { duration: spinDuration, easing: "cubic-bezier(0.22, 0.8, 0.1, 1)", fill: "forwards" }
    );

    anim.onfinish = () => {
        coin.style.transform = `rotateY(${toAngle}deg) scaleX(1)`;
        anim.cancel();

        const squeeze = coin.animate(
            [
                { transform: `rotateY(${toAngle}deg) scaleX(1)`,   opacity: 1 },
                { transform: `rotateY(${toAngle}deg) scaleX(0.02)`, opacity: 0 }
            ],
            { duration: CROSSFADE_MS, easing: "ease-in", fill: "forwards" }
        );

        edgeOverlay.style.transition = `opacity ${CROSSFADE_MS}ms ease-in`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            edgeOverlay.style.opacity = "1";
        }));

        squeeze.onfinish = () => {
            coin.style.visibility = "hidden";
            squeeze.cancel();
            showResult("Canto");
        };
    };
}


// =============================================================
// EFECTO ÉPICO DEL CANTO
// =============================================================

/**
 * Dispara el flash de fondo y las partículas de colores cuando se acierta el canto.
 */
function triggerCantoEpic() {
    playSFX(SFX.cantoEpic);

    document.body.classList.remove("canto-flash");
    void document.body.offsetWidth;
    document.body.classList.add("canto-flash");
    setTimeout(() => document.body.classList.remove("canto-flash"), 1000);

    const rect = resultText.getBoundingClientRect();
    const ox = rect.left + rect.width  / 2;
    const oy = rect.top  + rect.height / 2;
    const burst = document.createElement("div");
    burst.className = "canto-burst";
    burst.style.setProperty("--ox", ox + "px");
    burst.style.setProperty("--oy", oy + "px");
    document.body.appendChild(burst);

    const colors = ["#ff5555", "#ff9933", "#ffee33", "#55ff55", "#33bbff", "#bb55ff", "#ffffff", "#ff44cc"];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement("div");
        p.className = "canto-particle";
        const angle = (i / 60) * 360 + Math.random() * 12;
        const dist  = 120 + Math.random() * 420;
        const tx    = Math.cos(angle * Math.PI / 180) * dist;
        const ty    = Math.sin(angle * Math.PI / 180) * dist;
        const size  = 4 + Math.random() * 11;
        const dur   = (0.5 + Math.random() * 0.9).toFixed(2);
        const delay = (Math.random() * 0.2).toFixed(2);
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText =
            `--tx:${tx.toFixed(0)}px; --ty:${ty.toFixed(0)}px; --dur:${dur}s; --delay:${delay}s;` +
            `width:${size.toFixed(0)}px; height:${size.toFixed(0)}px;` +
            `background:${color}; box-shadow:0 0 ${(size * 3).toFixed(0)}px ${color}, 0 0 ${(size * 1.2).toFixed(0)}px #fff;`;
        burst.appendChild(p);
    }
    setTimeout(() => burst.remove(), 2600);
}

/**
 * Flash rojo de fondo y partículas oscuras cuando cae canto sin estar seleccionado.
 */
function triggerCantoBad() {
    playSFX(SFX.cantoBad);

    document.body.classList.remove("canto-bad-flash");
    void document.body.offsetWidth;
    document.body.classList.add("canto-bad-flash");
    setTimeout(() => document.body.classList.remove("canto-bad-flash"), 900);

    const rect = resultText.getBoundingClientRect();
    const ox = rect.left + rect.width  / 2;
    const oy = rect.top  + rect.height / 2;
    const burst = document.createElement("div");
    burst.className = "canto-burst";
    burst.style.setProperty("--ox", ox + "px");
    burst.style.setProperty("--oy", oy + "px");
    document.body.appendChild(burst);

    const colors = ["#cc0000", "#880000", "#ff2222", "#aa0000", "#ff4444", "#660000", "#ff0000", "#990000"];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement("div");
        p.className = "canto-particle";
        const angle = (i / 60) * 360 + Math.random() * 12;
        const dist  = 120 + Math.random() * 420;
        const tx    = Math.cos(angle * Math.PI / 180) * dist;
        const ty    = Math.sin(angle * Math.PI / 180) * dist;
        const size  = 4 + Math.random() * 11;
        const dur   = (0.5 + Math.random() * 0.9).toFixed(2);
        const delay = (Math.random() * 0.2).toFixed(2);
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText =
            `--tx:${tx.toFixed(0)}px; --ty:${ty.toFixed(0)}px; --dur:${dur}s; --delay:${delay}s;` +
            `width:${size.toFixed(0)}px; height:${size.toFixed(0)}px;` +
            `background:${color}; box-shadow:0 0 ${(size * 3).toFixed(0)}px ${color}, 0 0 ${(size * 1.2).toFixed(0)}px #ff8888;`;
        burst.appendChild(p);
    }
    setTimeout(() => burst.remove(), 2000);
}


// =============================================================
// RESULTADO
// =============================================================

/**
 * Muestra el resultado en pantalla, actualiza contadores y dispara el sonido correcto.
 */
function showResult(result) {
    resultText.classList.remove("result-vamos", "result-quedamos", "result-canto", "result-canto-rainbow", "result-canto-bad");

    const selectedCara  = betCara.classList.contains("bet-selected");
    const selectedCruz  = betCruz.classList.contains("bet-selected");
    const selectedCanto = betCanto.classList.contains("bet-canto-active");
    const hasBet        = selectedCara || selectedCruz || selectedCanto;

    if (result === "Canto") {
        if (selectedCanto) {
            // ¡Acertó el canto! Efecto épico + sonido épico (ya disparado en triggerCantoEpic)
            resultText.textContent = "CANTO";
            resultText.classList.add("result-canto-rainbow");
            triggerCantoEpic();
        } else if (hasBet) {
            // Canto con apuesta contraria: animación mala + sonido malo (ya disparado en triggerCantoBad)
            resultText.textContent = "CANTO";
            resultText.classList.add("result-canto-bad");
            triggerCantoBad();
        } else {
            // Sin apuesta: resultado neutro dorado + sonido canto genérico
            playSFX(SFX.win);
            resultText.textContent = "CANTO";
            resultText.classList.add("result-canto");
        }
    } else {
        // Actualiza historial
        if (result === "Cara") { tallyCara++; countCara.textContent = tallyCara; }
        if (result === "Cruz") { tallyCruz++; countCruz.textContent = tallyCruz; }

        if (hasBet) {
            const betWins = (selectedCara && result === "Cara") || (selectedCruz && result === "Cruz");

            // Sonido de victoria o derrota
            playSFX(betWins ? SFX.win : SFX.lose);

            resultText.textContent = betWins ? "NOS VAMOS" : "NOS QUEDAMOS";
            resultText.classList.add(betWins ? "result-vamos" : "result-quedamos");

            const flashClass = betWins ? "result-vamos-flash" : "result-quedamos-flash";
            document.body.classList.remove("result-vamos-flash", "result-quedamos-flash");
            void document.body.offsetWidth;
            document.body.classList.add(flashClass);
            setTimeout(() => document.body.classList.remove(flashClass), 1200);
        } else {
            // Sin apuesta: muestra el resultado literal (sin sonido especial, el flip ya sonó)
            resultText.textContent = result.toUpperCase();
            resultText.classList.add("result-vamos");
            playSFX(SFX.win)
        }
    }

    // Fade-in del resultado
    requestAnimationFrame(() => requestAnimationFrame(() => resultText.classList.add("visible")));
    button.disabled = false;
    betCara.disabled = betCruz.disabled = betCanto.disabled = false;
}


// =============================================================
// PANEL DE REGLAS
// =============================================================

const rulesBtn     = document.getElementById("rulesBtn");
const rulesOverlay = document.getElementById("rulesOverlay");
const rulesClose   = document.getElementById("rulesClose");
const rulesContent = document.getElementById("rulesContent");

rulesContent.innerHTML = marked.parse(REGLAS_MD);

function openRules()  { rulesOverlay.classList.add("open"); }
function closeRules() { rulesOverlay.classList.remove("open"); }

rulesBtn.addEventListener("click",   openRules);
rulesClose.addEventListener("click", closeRules);
rulesOverlay.addEventListener("click", e => { if (e.target === rulesOverlay) closeRules(); });
document.addEventListener("keydown",   e => { if (e.key === "Escape") closeRules(); });