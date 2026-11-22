export default class GoogleAuth {
    constructor(clientId) {
        this.clientId = clientId;
        this.identityServicesPromise = null;
        this.idToken = null;
        this.userId = null;
    }

    async loadIdentityServices() {
        if (window.google?.accounts?.id) {
            return;
        }

        if (!this.identityServicesPromise) {
            this.identityServicesPromise = new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://accounts.google.com/gsi/client";
                script.async = true;
                script.onload = resolve;
                script.onerror = () => {
                    this.identityServicesPromise = null;
                    reject(new Error("Google Identity Services could not be loaded."));
                };
                document.head.appendChild(script);
            });
        }
        await this.identityServicesPromise;
    }

    handleCredential(response) {
        if (!response.credential) {
            return;
        }

        this.idToken = response.credential;
        this.userId = null;
        let displayName = "Google user";
        try {
            const encodedPayload = response.credential.split(".")[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/");
            const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
            const payloadBytes = Uint8Array.from(atob(paddedPayload), character => character.charCodeAt(0));
            const claims = JSON.parse(new TextDecoder().decode(payloadBytes));
            displayName = claims.given_name || claims.name || claims.email || displayName;
            this.userId = typeof claims.sub === "string" ? claims.sub : null;
        } catch (error) {
            console.warn("Could not read the Google account name from its sign-in token.", error);
        }

        const initial = Array.from(displayName.trim())[0]?.toLocaleUpperCase() || "?";
        const avatar = document.getElementById("googleUserAvatar");
        avatar.textContent = initial;
        avatar.title = `Signed in as ${displayName}`;
        avatar.setAttribute("aria-label", `Signed in as ${displayName}`);
        avatar.hidden = false;
        document.getElementById("googleSignInButton").hidden = true;
        document.getElementById("googleSignOutButton").hidden = false;
        document.getElementById("googleAuthStatus").textContent = "Signed in with Google";
    }

    async initialize() {
        const status = document.getElementById("googleAuthStatus");
        if (this.clientId.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
            status.textContent = "Google sign-in requires a Client ID in google-auth.js";
            console.warn("Set GOOGLE_CLIENT_ID in google-auth.js to enable Google sign-in.");
            return;
        }

        try {
            await this.loadIdentityServices();
            window.google.accounts.id.initialize({
                client_id: this.clientId,
                callback: response => this.handleCredential(response),
                auto_select: false
            });
            window.google.accounts.id.renderButton(
                document.getElementById("googleSignInButton"),
                { type: "icon", theme: "outline", size: "large", shape: "circle" }
            );
        } catch (error) {
            status.textContent = "Google sign-in is unavailable";
            console.error(error);
        }
    }

    signOut() {
        this.idToken = null;
        this.userId = null;
        window.google?.accounts?.id?.disableAutoSelect();
        document.getElementById("googleUserAvatar").hidden = true;
        document.getElementById("googleSignOutButton").hidden = true;
        document.getElementById("googleSignInButton").hidden = false;
        document.getElementById("googleAuthStatus").textContent = "Signed out";
    }
}
