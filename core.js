var { createWebserver } = require('./webserver4.js');

class Core {
    constructor() {
        this.api = new CoreApi(this);
        setInterval(() => {
            this.api.testsse(Date.now());
        }, 10000);

        this.plugins = {};
        this.plugins["core"] = this;
    }

    addPlugin(name, plugin) {
        this.plugins[name] = plugin;
    }

    checksession (oInfo, req, res, user, plugin, method) {
        var authPromise = Promise.reject();
        if (this.plugins["auth"]) {
            authPromise = this.plugins["auth"].checksession(oInfo, req, res, user, method);
        }
        var pluginPromise = Promise.reject();
        if (this.plugins[plugin].checksession) {
            pluginPromise = this.plugins[plugin].checksession(oInfo, req, res, user, method)
        }

        return new Promise((resolve, reject) => {
            authPromise
            .then(() => {
                pluginPromise
                .then((v) => {
                    resolve(v);
                })
                .catch((e) => {
                    reject(e);
                })
            })
        });
    }

    createWebServer1 (bind, port, privkey, fullchain, domains, mapping) {
        this.serverinstance = createWebserver(bind, port, privkey, fullchain, domains, mapping);
    }

    getApiForPlugin(plugin) {
        return this.plugins[plugin];
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
