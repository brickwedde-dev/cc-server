var { createWebserver, WebserverResponse } = require('../cc-webserver/webserver4.js');

class AutoLoadClientPlugin {
  constructor(options) {
    this.options = options;
    this.api = new AutoLoadClientApi(this, options);
  }

  checksession (oInfo, req, res, user, method) {
    return Promise.resolve();
  }
}

class AutoLoadClientApi {
    constructor (options) {
        this.options = options;
    }

    load(oInfo, type) {
        return Promise.resolve(new WebserverResponse(200,
            {
                'Content-Type': "application/json",
                'X-Type': type,
                'Cache-Control' : ['public, max-age=0'],
                'Expires' : new Date(0).toGMTString()
            },
            JSON.stringify(
                {
                    "scripts" : [
                        "/common/cc-material-helpers/util.js",
                        "/common/cc-material-helpers/material-components-web.js",
                        "/common/cc-material-helpers/safari-polyfill.js",
                        "/common/cc-material-helpers/CcMdcDrawer.js",
                        "/common/cc-material-helpers/CcMdcTopAppBar.js",
                        "/common/cc-material-helpers/CcMdcTextField.js",
                        "/common/cc-material-helpers/CcMdcTextArea.js",
                        "/common/cc-material-helpers/CcMdcCheckbox.js",
                        "/common/cc-material-helpers/CcMdcListItem.js",
                        "/common/cc-material-helpers/CcMdcButton.js",
                        "/common/cc-material-helpers/CcMdcSelect.js",
                        "/common/cc-material-helpers/CcMdcDialog.js",
                        "/common/cc-material-helpers/CcMdcList.js",
                        "/common/cc-material-helpers/CcMdcChips.js",
                        "/common/cc-material-helpers/CcAceEditor.js",
                        "/common/cc-material-helpers/CcMdcFloatingActionButton.js",
                        "/common/cc-api-client/CcApi2.js",
                        "/common/cc-api-client/CcSimpleAuthLoginDlg.js",
                        "/common/cc-api-client/CcSimpleAuthUserList.js",
                        "/common/cc-api-client/CcSimpleAuthUserEditor.js",
                        "/common/cc-app/CcApp2.js",
                        "/common/cc-big-table/CcBigTable.js",
                        "/common/cc-dynamicform-client/CcDynamicForm.js",
                        "/common/cc-dynamicform-client/CcDynamicFormAdmin.js",
                        "/common/cc-dynamicform-client/CcTooltip.js",
                        "/common/cc-dynamicform-client/CcCustomContextMenu.js",
                    ],
                    "styles" : [
                        "/common/cc-material-helpers/material-components-web.css",
                        "/common/cc-material-helpers/materialicons.css",
                    ],
                }
            )
        ));
    }
}


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


module.exports = { Core, AutoLoadClientPlugin };
