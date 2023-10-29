class TranslationPlugin {
  constructor(storagePlugin, options) {
    this.options = options || {};
    this.storage = storagePlugin;
    this.api = new TranslationApi(this, this.storage, this.options);
  }
}

class TranslationApi {
  constructor (plugin, storagePlugin, options) {
    this.plugin = plugin;
    this.storagePlugin = storagePlugin;
    this.options = options;
  }

  addMissing (oInfo, string, language) {
    console.log("Missing translation:'", string, "', '", language, "'");
    return Promise.resolve({});
  }
}

module.exports = { TranslationPlugin };