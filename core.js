var { createWebserver } = require('./webserver4.js');

class Core {
    constructor() {
        this.api = new CoreApi(this);
        setInterval(() => {
            this.api.testsse(Date.now());
        }, 10000);

        this.plugins = [];
        this.storages = [];
    }

    checksession (oInfo, req, res, user, method) {
        if (this.authPlugin) {
            return this.authPlugin.api.checksession(oInfo, req, res, user, method);
        }
        return Promise.reject();
    }

    createWebServer1 (bind, port, privkey, fullchain, domains, mapping) {
        this.serverinstance = createWebserver(bind, port, privkey, fullchain, domains, mapping);
    }

    getApiForPlugin(plugin) {
        switch (plugin) {
            case "core":
                return this.api;
            case "auth":
                return this.authPlugin.api;
        }
        return null;
    }
}

class CoreApi {
    constructor(plugin) {
        this.plugin = plugin;
    }

    checksession (oInfo, req, res, user, method) {
        return this.plugin.checksession(oInfo, req, res, user, method);
    }

    testsse (oInfo) {
    }
}


module.exports = { Core };
