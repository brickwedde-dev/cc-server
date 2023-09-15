var { createWebserver } = require('./webserver4.js');

class Core {
    constructor() {
        this.api = new CoreApi(this);

        this.plugins = {};
        this.plugins["core"] = this;
    }

    addPlugin(name, plugin) {
        this.plugins[name] = plugin;
    }

    getsession (oInfo, req, res, plugin, method) {
        console.log("Core getsession " + plugin + ":" + method);
        console.log("oInfo:", JSON.stringify(oInfo))
        var authPromise = null;
        if (this.plugins["auth"]) {
            authPromise = this.plugins["auth"].getsession(oInfo, req, res, method);
        }
        if (!authPromise) {
            authPromise = Promise.reject("core no auth plugin");
        }

        return new Promise((resolve, reject) => {
            authPromise
            .then((oInfoNew) => {
                console.log("auth plugin success")

                var pluginPromise = null;
                if (this.plugins[plugin].checksession) {
                    console.log("checking plugin " + plugin)
                    pluginPromise = this.plugins[plugin].checksession(oInfo, req, res, oInfo.user, method)
                }
                if (!pluginPromise) {
                    pluginPromise = Promise.resolve(oInfo);
                }

                pluginPromise
                .then((oInfoNew2) => {
                    console.log("used plugin success")
                    resolve(oInfo);
                })
                .catch((e) => {
                    console.log("used plugin failed " + e)
                    reject(e);
                })
            })
            .catch((e) => {
                console.log("auth plugin failed " + e)

                var pluginPromise = null;
                if (this.plugins[plugin].checksession) {
                    console.log("checking plugin " + plugin)
                    pluginPromise = this.plugins[plugin].checksession(oInfo, req, res, oInfo.user, method)
                }
                if (!pluginPromise) {
                    pluginPromise = Promise.reject("core plugin reject");
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

    createWebServer1 (bind, port, privkey, fullchain, domains, maintainerEmail, mapping) {
        this.serverinstance = createWebserver(bind, port, privkey, fullchain, domains, maintainerEmail, mapping);
    }

    getApiForPlugin(plugin) {
        return this.plugins[plugin] && this.plugins[plugin].api || undefined;
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
}


module.exports = { Core };
