export default class FlossUsageView {
    constructor(colorTemplate, colorContainer, onSelectColor) {
        this.colorTemplate = colorTemplate;
        this.colorContainer = colorContainer;
        this.onSelectColor = onSelectColor;
    }

    render({ colorArray, stitched, totalStitches, currentPattern, colorCount, highlightedColor }) {
        const height = currentPattern.properties.height;
        const width = currentPattern.properties.width;
        const heightCm = (height * 0.185).toFixed(1);
        const widthCm = (width * 0.185).toFixed(1);
        document.getElementById("properties").innerHTML =
            `<b>Dimensions:</b>&nbsp${height}h x ${width}w (${heightCm}cm x ${widthCm}cm)`;

        const percentage = ((stitched * 100) / totalStitches).toFixed(2);
        document.getElementById("progress").innerHTML =
            `<b>Progress:</b>&nbsp${stitched}/${totalStitches} stitched (${percentage}%)`;
        document.getElementById("flossCount").innerHTML = `<b>Color count:</b>&nbsp${colorCount}`;

        this.renderColorSelectors(colorArray);

        const table = document.createElement("table");
        const headerRow = document.createElement("tr");
        for (const heading of ["Color", "Symbol", "Code", "Name", "Count"]) {
            const cell = document.createElement("th");
            cell.textContent = heading;
            headerRow.appendChild(cell);
        }
        table.appendChild(headerRow);

        for (const color of colorArray) {
            if (color.code === "empty") {
                continue;
            }

            const row = document.createElement("tr");
            const swatch = document.createElement("td");
            swatch.style.backgroundColor = `rgb(${color.R},${color.G},${color.B})`;
            row.appendChild(swatch);

            this.appendCell(row, color.symbol, "center", color.code === highlightedColor);
            this.appendCell(row, color.code, "right", color.code === highlightedColor);
            this.appendCell(row, color.name, null, color.code === highlightedColor);
            this.appendCell(row, color.count, "right", color.code === highlightedColor);
            table.appendChild(row);
        }

        const modalList = document.getElementById("modalList");
        modalList.replaceChildren(table);
    }

    renderColorSelectors(colorArray) {
        this.colorContainer.replaceChildren();
        for (const color of colorArray) {
            if (!((color.code !== "empty" && color.count > 0) || color.code === "stitched")) {
                continue;
            }

            const colorDiv = this.colorTemplate.content.cloneNode(true).children[0];
            const colorBack = colorDiv.querySelector("[data-color-back]");
            const colorFront = colorDiv.querySelector("[data-color]");
            const colorId = colorDiv.querySelector("[data-color-id]");
            colorId.textContent = color.symbol;
            colorId.style.color = (
                (color.R * 0.299) + (color.G * 0.587) + (color.B * 0.114) > 186
            ) ? "black" : "white";

            colorFront.style.backgroundColor = `rgb(${color.R},${color.G},${color.B})`;
            colorFront.title = `${color.code} - ${color.name}`;
            colorFront.addEventListener("click", () => this.onSelectColor(color.code, color.symbol));
            if (colorBack) {
                colorBack.classList.add("holyS");
            }
            this.colorContainer.append(colorDiv);
        }
    }

    appendCell(row, value, alignment, highlighted) {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (alignment) {
            cell.style.textAlign = alignment;
        }
        if (highlighted) {
            cell.style.backgroundColor = "#ffff77";
        }
        row.appendChild(cell);
    }
}
