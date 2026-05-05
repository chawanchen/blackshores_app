const SQRT_2 = Math.sqrt(2);

function toFloat(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    if (text === "") {
        return null;
    }

    const number = Number(text);

    if (Number.isNaN(number)) {
        return null;
    }

    return number;
}

// JavaScript 沒有內建標準 normal cdf，所以用 erf 近似法
function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * x);
    const y = 1 - (
        (
            (
                (
                    (a5 * t + a4) * t
                ) + a3
            ) * t + a2
        ) * t + a1
    ) * t * Math.exp(-x * x);

    return sign * y;
}

function normCdf(x) {
    return 0.5 * (1 + erf(x / SQRT_2));
}

function blackScholesStockPrice(optionSide, S, K, T, r, sigma) {
    if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
        return null;
    }

    const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    if (optionSide === "call") {
        return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
    }

    return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

function blackModelFuturesPrice(optionSide, F, K, T, r, sigma) {
    if (F <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
        return null;
    }

    const d1 = (Math.log(F / K) + 0.5 * sigma ** 2 * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const discount = Math.exp(-r * T);

    if (optionSide === "call") {
        return discount * (F * normCdf(d1) - K * normCdf(d2));
    }

    return discount * (K * normCdf(-d2) - F * normCdf(-d1));
}

function modelPrice(optionType, optionSide, underlyingPrice, strikePrice, T, r, sigma) {
    if (optionType === "stock") {
        return blackScholesStockPrice(optionSide, underlyingPrice, strikePrice, T, r, sigma);
    }

    return blackModelFuturesPrice(optionSide, underlyingPrice, strikePrice, T, r, sigma);
}

function impliedVolatilityBisection({
    optionType,
    optionSide,
    underlyingPrice,
    strikePrice,
    marketPrice,
    T,
    r,
    sigmaLow = 0.0001,
    sigmaHigh = 5.0,
    tolerance = 0.0001,
    maxIterations = 100
}) {
    if (
        underlyingPrice <= 0 ||
        strikePrice <= 0 ||
        marketPrice <= 0 ||
        T <= 0
    ) {
        return null;
    }

    const priceLow = modelPrice(
        optionType,
        optionSide,
        underlyingPrice,
        strikePrice,
        T,
        r,
        sigmaLow
    );

    const priceHigh = modelPrice(
        optionType,
        optionSide,
        underlyingPrice,
        strikePrice,
        T,
        r,
        sigmaHigh
    );

    if (priceLow === null || priceHigh === null) {
        return null;
    }

    if (marketPrice < priceLow || marketPrice > priceHigh) {
        return null;
    }

    let sigmaMid = null;

    for (let i = 0; i < maxIterations; i++) {
        sigmaMid = (sigmaLow + sigmaHigh) / 2;

        const priceMid = modelPrice(
            optionType,
            optionSide,
            underlyingPrice,
            strikePrice,
            T,
            r,
            sigmaMid
        );

        if (priceMid === null) {
            return null;
        }

        if (Math.abs(priceMid - marketPrice) < tolerance) {
            return Number((sigmaMid * 100).toFixed(4));
        }

        if (priceMid < marketPrice) {
            sigmaLow = sigmaMid;
        } else {
            sigmaHigh = sigmaMid;
        }
    }

    return Number((sigmaMid * 100).toFixed(4));
}

function getSelectedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
}

function addRow(strike = "", price = "") {
    const container = document.getElementById("marketRows");

    const row = document.createElement("div");
    row.className = "market-row";

    row.innerHTML = `
        <input
            type="number"
            step="any"
            class="strike-input"
            value="${strike}"
            placeholder="履約價">

        <input
            type="number"
            step="any"
            class="price-input"
            value="${price}"
            placeholder="市場價格">

        <button type="button" class="remove-row-btn">
            刪除
        </button>
    `;

    container.appendChild(row);
}

function removeRow(button) {
    const container = document.getElementById("marketRows");
    const rows = container.querySelectorAll(".market-row");

    if (rows.length <= 1) {
        alert("至少要保留一列。");
        return;
    }

    button.closest(".market-row").remove();
    calculateAndRender();
}

function updateLabels() {
    const optionType = getSelectedRadioValue("option_type");
    const optionSide = getSelectedRadioValue("option_side");

    const underlyingLabel = document.getElementById("underlyingLabel");
    const marketPriceTitle = document.getElementById("marketPriceTitle");
    const marketPriceHeader = document.getElementById("marketPriceHeader");

    underlyingLabel.textContent = optionType === "stock" ? "股票價格" : "期貨價格";

    const sideText = optionSide === "call" ? "Call 市場價格" : "Put 市場價格";

    marketPriceTitle.textContent = sideText;
    marketPriceHeader.textContent = sideText;
}

function setError(message) {
    const errorBox = document.getElementById("errorBox");

    if (!message) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
        return;
    }

    errorBox.style.display = "block";
    errorBox.textContent = message;
}

function getInputRows() {
    const rows = document.querySelectorAll(".market-row");
    const inputRows = [];

    rows.forEach(row => {
        const strikeInput = row.querySelector(".strike-input");
        const priceInput = row.querySelector(".price-input");

        const strikeText = strikeInput.value;
        const priceText = priceInput.value;

        inputRows.push({
            strikeText,
            priceText,
            strike: toFloat(strikeText),
            marketPrice: toFloat(priceText)
        });
    });

    return inputRows;
}

function calculateSmileRows() {
    const optionType = getSelectedRadioValue("option_type");
    const optionSide = getSelectedRadioValue("option_side");

    const underlyingPrice = toFloat(document.getElementById("underlyingPrice").value);
    const riskFreeRate = toFloat(document.getElementById("riskFreeRate").value);
    const days = toFloat(document.getElementById("days").value);

    if (underlyingPrice === null || riskFreeRate === null || days === null) {
        setError("請確認標的價格、無風險利率、到期期限都有輸入數字。");
        return [];
    }

    if (underlyingPrice <= 0 || days <= 0) {
        setError("標的價格與到期期限必須大於 0。");
        return [];
    }

    setError("");

    const r = riskFreeRate / 100;
    const T = days / 360;

    const inputRows = getInputRows();
    const smileRows = [];

    inputRows.forEach(row => {
        if (row.strike === null && row.marketPrice === null) {
            return;
        }

        if (row.strike === null || row.marketPrice === null) {
            smileRows.push({
                strike: row.strikeText,
                market_price: row.priceText,
                iv: null
            });
            return;
        }

        const iv = impliedVolatilityBisection({
            optionType,
            optionSide,
            underlyingPrice,
            strikePrice: row.strike,
            marketPrice: row.marketPrice,
            T,
            r
        });

        smileRows.push({
            strike: row.strike,
            market_price: row.marketPrice,
            iv
        });
    });

    return smileRows;
}

function renderIvList(smileRows) {
    const ivList = document.getElementById("ivList");
    ivList.innerHTML = "";

    smileRows.forEach(row => {
        const card = document.createElement("div");

        const ivText = row.iv !== null
            ? `${Number(row.iv).toFixed(4)}%`
            : "無法計算";

        card.innerHTML = `
            <span>K ${row.strike} / Price ${row.market_price}</span>
            <strong>${ivText}</strong>
        `;

        ivList.appendChild(card);
    });
}

function renderPlot(smileRows) {
    const chart = document.getElementById("volSmileChart");

    const validRows = smileRows
        .filter(row => row.iv !== null)
        .sort((a, b) => Number(a.strike) - Number(b.strike));

    if (validRows.length === 0) {
        chart.innerHTML = '<div class="empty-chart">目前沒有可繪製的 IV 資料</div>';
        return;
    }

    const strikes = validRows.map(row => row.strike);
    const ivs = validRows.map(row => row.iv);
    const prices = validRows.map(row => row.market_price);

    const trace = {
        x: strikes,
        y: ivs,
        mode: "lines+markers",
        type: "scatter",
        name: "隱含波動度 IV",
        line: {
            color: "#2f7d4f",
            width: 4,
            shape: "spline",
            smoothing: 1.2
        },
        marker: {
            size: 10,
            color: "#ffffff",
            line: {
                color: "#2f7d4f",
                width: 2
            }
        },
        customdata: prices,
        hovertemplate:
            "履約價 K：%{x}<br>" +
            "市場價格：%{customdata}<br>" +
            "隱含波動度 IV：%{y:.4f}%<extra></extra>"
    };

    const layout = {
        margin: {
            l: 56,
            r: 18,
            t: 20,
            b: 50
        },
        height: 300,
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif',
            color: "#1f3328"
        },
        xaxis: {
            title: "履約價 K",
            gridcolor: "#d5e8da",
            zeroline: false
        },
        yaxis: {
            title: "IV (%)",
            gridcolor: "#d5e8da",
            zeroline: false
        },
        hoverlabel: {
            bgcolor: "#ffffff",
            bordercolor: "#68b984",
            font: {
                color: "#1f3328"
            }
        }
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot("volSmileChart", [trace], layout, config);
}

function calculateAndRender() {
    updateLabels();

    const smileRows = calculateSmileRows();

    renderIvList(smileRows);
    renderPlot(smileRows);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ivForm").addEventListener("submit", event => {
        event.preventDefault();
        calculateAndRender();
    });

    document.getElementById("addRowBtn").addEventListener("click", () => {
        addRow();
    });

    document.getElementById("marketRows").addEventListener("click", event => {
        if (event.target.classList.contains("remove-row-btn")) {
            removeRow(event.target);
        }
    });

    document.querySelectorAll('input[name="option_type"], input[name="option_side"]').forEach(input => {
        input.addEventListener("change", calculateAndRender);
    });

    calculateAndRender();
});