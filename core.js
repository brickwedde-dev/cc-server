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
        return Promise.resolve(new WebserverResponse(200, {
                'Content-Type': "text/javascript",
                'X-Text': type,
                'Cache-Control' : ['public, max-age=0'],
                'Expires' : new Date(0).toGMTString()
                }, `
function loadJs(url) {
  return new Promise((resolve, reject) => {
    var script = document.createElement("script");
    script.addEventListener("load", () => {
      console.log("OK!", url)
      resolve(url);
    });
    script.addEventListener("error", () => {
      console.log("Failed!", url)
      reject(url);
    });
    script.async = false;
    script.setAttribute("src", url);
    script.type = "text/javascript";
    document.head.append(script);
  });
}

function loadStyle(url) {
  return new Promise((resolve, reject) => {
    var style = document.createElement("link");
    style.addEventListener("load", () => {
      console.log("OK!", url)
      resolve(url);
    });
    style.addEventListener("error", () => {
      console.log("Failed!", url)
      reject(url);
    });
    style.async = false;
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("href", url);
    document.head.append(style);
  });
}

function loadCc() {
  var a = [];
  a.push(loadStyle("/common/cc-material-helpers/material-components-web.css"))
  a.push(loadStyle("/common/cc-material-helpers/materialicons.css"))

  a.push(loadJs("/common/cc-material-helpers/util.js"))
  a.push(loadJs("/common/cc-material-helpers/material-components-web.js"))
  a.push(loadJs("/common/cc-material-helpers/safari-polyfill.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcDrawer.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcTopAppBar.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcTextField.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcTextArea.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcCheckbox.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcListItem.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcButton.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcSelect.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcDialog.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcList.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcChips.js"))
  a.push(loadJs("/common/cc-material-helpers/CcAceEditor.js"))
  a.push(loadJs("/common/cc-material-helpers/CcMdcFloatingActionButton.js"))
  a.push(loadJs("/common/cc-api-client/CcApi2.js"))
  a.push(loadJs("/common/cc-api-client/CcSimpleAuthLoginDlg.js"))
  a.push(loadJs("/common/cc-api-client/CcSimpleAuthUserList.js"))
  a.push(loadJs("/common/cc-api-client/CcSimpleAuthUserEditor.js"))
  a.push(loadJs("/common/cc-app/CcApp.js"))
  a.push(loadJs("/common/cc-big-table/CcBigTable.js"))
  a.push(loadJs("/common/cc-dynamicform-client/CcDynamicForm.js"))
  a.push(loadJs("/common/cc-dynamicform-client/CcDynamicFormAdmin.js"))
  a.push(loadJs("/common/cc-dynamicform-client/CcTooltip.js"))
  a.push(loadJs("/common/cc-dynamicform-client/CcCustomContextMenu.js"))

  return Promise.all(a)
}

loadCc()
.then(() => {
    loadCcOk();
})
.catch(() => {
    alert("Loading Cc failed");
    throw "Loading Cc failed";
});
                `));
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
