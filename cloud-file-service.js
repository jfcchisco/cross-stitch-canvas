export function normalizeEtag(value) {
    if (typeof value !== "string") {
        return null;
    }

    const etag = value.trim();
    if (/^"[^"\r\n]+"$/.test(etag)) {
        return etag;
    }
    if (etag.startsWith("W/") || !/^[\x21\x23-\x7E]+$/.test(etag)) {
        return null;
    }
    return `"${etag}"`;
}

async function readError(response) {
    let details = {};
    try {
        details = await response.json();
    } catch {
        // Use the HTTP status when the server does not return JSON.
    }
    const error = new Error(details.error || `Cloud request failed (${response.status}).`);
    error.status = response.status;
    error.details = details;
    return error;
}

export default class CloudFileService {
    constructor(baseUrl, getToken, onUnauthorized) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
        this.onUnauthorized = onUnauthorized;
    }

    async request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${this.getToken()}`);
        const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            this.onUnauthorized();
            throw new Error("Your Google sign-in expired. Please sign in again.");
        }
        return response;
    }

    async getJson(path) {
        const response = await this.request(path);
        if (!response.ok) {
            throw await readError(response);
        }
        return { data: await response.json(), etag: normalizeEtag(response.headers.get("ETag")) };
    }

    async listFiles(endpoint) {
        const files = [];
        let cursor = null;
        do {
            const query = new URLSearchParams({ limit: "100" });
            if (cursor) {
                query.set("cursor", cursor);
            }
            const { data } = await this.getJson(`${endpoint}?${query}`);
            files.push(...data.files);
            cursor = data.cursor;
        } while (cursor);
        return files;
    }

    listUserFiles() {
        return this.listFiles("/api/files");
    }

    listDefaultFiles() {
        return this.listFiles("/api/default-files");
    }

    getUserFile(id) {
        return this.getJson(`/api/files/${encodeURIComponent(id)}`);
    }

    getDefaultFile(key) {
        const query = new URLSearchParams({ key });
        return this.getJson(`/api/default-files?${query}`);
    }

    async saveFile({ id, name, pattern, etag }) {
        const isUpdate = Boolean(id);
        const headers = { "Content-Type": "application/json" };
        if (isUpdate) {
            headers["If-Match"] = etag;
        }
        const response = await this.request(
            isUpdate ? `/api/files/${encodeURIComponent(id)}` : "/api/files",
            {
                method: isUpdate ? "PUT" : "POST",
                headers,
                body: JSON.stringify({ name, pattern })
            }
        );

        if (response.status === 409) {
            const error = await readError(response);
            if (error.details.error === "duplicate_file_name") {
                throw new Error("A cloud file with this name already exists. Choose a different name.");
            }
            throw new Error("This cloud file changed in another session. Download the latest copy before saving again.");
        }
        if (!response.ok) {
            throw await readError(response);
        }

        const data = await response.json();
        return {
            ...data,
            etag: normalizeEtag(response.headers.get("ETag")) || normalizeEtag(data.etag)
        };
    }
}
