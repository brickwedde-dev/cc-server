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

    checksession (oInfo, req, res, plugin, method) {
        console.log("Core checksession " + plugin + ":" + method);
        var authPromise = null;
        if (this.plugins["auth"]) {
            authPromise = this.plugins["auth"].checksession(oInfo, req, res, method);
        }
        if (!authPromise) {
            authPromise = Promise.reject("core auth reject");
        }

        return new Promise((resolve, reject) => {
            authPromise
            .then(() => {
                console.log("auth plugin success")
                var pluginPromise = Promise.resolve();
                if (plugin != "core" && this.plugins[plugin].checksession) {
                    pluginPromise = this.plugins[plugin].checksession(oInfo, req, res, oInfo.user, method)
                }

                pluginPromise
                .then((v) => {
                    console.log("used plugin success")
                    resolve(v);
                })
                .catch((e) => {
                    console.log("used plugin failed " + e)
                    reject(e);
                })
            })
            .catch((e) => {
                console.log("auth plugin failed " + e)
                console.log("checking plugin " + plugin)
                var pluginPromise = Promise.reject("core plugin reject");
                if (plugin != "core" && this.plugins[plugin].checksession) {
                    pluginPromise = this.plugins[plugin].checksession(oInfo, req, res, oInfo.user, method)
                }

                pluginPromise
                .then((v) => {
                    console.log("used plugin success")
                    resolve(v);
                })
                .catch((e) => {
                    console.log("used plugin failed " + e)
                    reject(e);
                })
            });
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

    connection (oInfo) {
        return new Promise((resolve, reject) => {
            setTimeout(()=> {
                resolve("");
            }, 10000);
        })
    }

    // checksession (oInfo, req, res, user, method) {
    //     return Promise.resolve();
    // }

    testsse (oInfo) {
    }
}


module.exports = { Core };
