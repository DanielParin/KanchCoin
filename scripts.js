const coin = document.getElementById("coin");
const button = document.getElementById("flipBtn");
const resultText = document.getElementById("result");
const edgeLine = document.getElementById("edgeLine");
const sound = document.getElementById("coinSound");

button.addEventListener("click", () => {

    button.disabled = true;
    resultText.textContent = "";
    edgeLine.style.opacity = "0";

    coin.style.transition = "none";
    coin.style.transform = "rotateX(0deg) rotateY(0deg)";
    void coin.offsetWidth;

    coin.style.transition = "transform 5s cubic-bezier(.17,.67,.83,.67)";

    const random = Math.random();
    let result;
    let rotX = 3600;
    let rotY = 3600;

    if (random < 0.45) {
        result = "Cara";
    } 
    else if (random < 0.9) {
        result = "Cruz";
        rotY += 180;
    } 
    else {
        result = "Canto";
        rotX += 90;
    }

    coin.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;

    setTimeout(() => {
        resultText.textContent = result;

        if (result === "Canto") {
            edgeLine.style.opacity = "1";
        }

        button.disabled = false;

    }, 5000);
});