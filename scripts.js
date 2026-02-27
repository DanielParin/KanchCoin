const coin        = document.getElementById("coin");
const button      = document.getElementById("flipBtn");
const resultText  = document.getElementById("result");
const edgeOverlay = document.getElementById("edgeOverlay");
const edgeBar     = document.querySelector(".edge-bar");

const FULL_SPINS    = 8;
const TOTAL_DURATION = 5000;
const CROSSFADE_MS   = 600;

let absoluteAngle = 0;

button.addEventListener("click", () => {
    button.disabled = true;
    resultText.classList.remove("visible");
    resultText.textContent = "";

    coin.style.visibility  = "visible";
    coin.style.transform   = "";
    edgeOverlay.style.opacity = "0";
    edgeOverlay.style.transition = "none";

    const rand = Math.random();
    let result;
    if      (rand < 0.45) result = "Cara";
    else if (rand < 0.90) result = "Cruz";
    else                  result = "Canto";

    if (result === "Canto") {
        runCanto();
    } else {
        runNormal(result);
    }
});

function runNormal(result) {
    const targetMod  = result === "Cara" ? 0 : 180;
    const currentMod = ((absoluteAngle % 360) + 360) % 360;
    let extra = (targetMod - currentMod + 360) % 360;
    if (extra === 0) extra = 360;
    const toAngle   = absoluteAngle + (FULL_SPINS * 360) + extra;
    const fromAngle = absoluteAngle;
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
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                edgeOverlay.style.opacity = "1";
            });
        });

        squeeze.onfinish = () => {
            coin.style.visibility = "hidden";
            squeeze.cancel();
            showResult("Canto");
        };
    };
}

function showResult(result) {
    resultText.textContent = result.toUpperCase();
    requestAnimationFrame(() =>
        requestAnimationFrame(() => resultText.classList.add("visible"))
    );
    button.disabled = false;
}