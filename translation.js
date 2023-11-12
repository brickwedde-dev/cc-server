class TranslationPlugin {
  constructor(storagePlugin, options) {
    this.options = options || {};
    this.storage = storagePlugin;
    this.api = new TranslationApi(this, this.storage, this.options);
  }

  checksession (oInfo, req, res, user, method) {
    if (method == "fetchAll") {
      return Promise.resolve(oInfo);
    }
    if (!oInfo.session) {
      return Promise.reject("Unauthorized");
    }
    return Promise.resolve(oInfo);
  }
}

class TranslationApi {
  constructor (plugin, storagePlugin, options) {
    this.plugin = plugin;
    this.storage = storagePlugin;
    this.options = options;
  }

  addOrUpdateTranslation (oInfo, langObject) {
    return new Promise((resolve, reject) => {
      console.log("addOrUpdateTranslation        xxxxxxxxxxxxxxxxx");
      this.storage.api.addObject(null, "translation", langObject)
      .then(() => {
        resolve({ok:true});
        if (this.options.updateCallback) {
          this.options.updateCallback();
        }
      })
      .catch((e) => {
        console.log("addOrUpdateTranslation", e);
        this.storage.api.updateObject(null, "translation", langObject)
        .then(() => {
          resolve({ok:true});
          if (this.options.updateCallback) {
            this.options.updateCallback();
          }
        })
        .catch((e) => {
          console.log("addOrUpdateTranslation", e);
          reject (`${e}`);
        });
      });
    });
  }

  fetchTranslations(oInfo) {
    return new Promise((resolve, reject) => {
      this.storage.api.listObjects(null, "translation")
      .then((langObjects) => {
        resolve(langObjects);
      })
      .catch((e) => {
        reject (`${e}`);
      });
    });
  }

  fetchAll (oInfo) {
    return new Promise((resolve, reject) => {
      this.storage.api.listObjects(null, "translation")
      .then((langObjects) => {
        var result = {};
        for(var langObject of langObjects) {
          result[langObject._id] = langObject;
        }
        resolve(result);
      })
      .catch((e) => {
        reject (`${e}`);
      });
    });
  }
}

module.exports = { TranslationPlugin };