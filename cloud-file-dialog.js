export default class CloudFileDialog {
    constructor(dialog = document.getElementById("cloudFileDialog")) {
        this.dialog = dialog;
    }

    choose(files, title = "Open cloud pattern", emptyText = "No cloud files found.") {
        const list = document.getElementById("cloudFileList");
        const emptyMessage = document.getElementById("cloudFileEmpty");
        document.getElementById("cloudFileDialogTitle").textContent = title;
        list.replaceChildren();
        emptyMessage.textContent = emptyText;
        emptyMessage.hidden = files.length > 0;

        for (const file of files) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            const name = document.createElement("span");
            button.type = "button";
            button.className = "cloud-file-option";
            if (typeof file.thumbnail === "string" && /^data:image\/(?:webp|png);base64,/i.test(file.thumbnail)) {
                const image = document.createElement("img");
                image.className = "cloud-file-thumbnail";
                image.src = file.thumbnail;
                image.alt = "";
                image.loading = "lazy";
                button.appendChild(image);
            }
            name.className = "cloud-file-name";
            name.textContent = file.name;
            button.appendChild(name);
            button.addEventListener("click", () => this.dialog.close(file.id));
            item.appendChild(button);
            list.appendChild(item);
        }

        return new Promise(resolve => {
            const handleClose = () => {
                this.dialog.removeEventListener("close", handleClose);
                resolve(this.dialog.returnValue || null);
            };
            this.dialog.addEventListener("close", handleClose);
            this.dialog.returnValue = "";
            this.dialog.showModal();
        });
    }

    close() {
        this.dialog.close();
    }
}
