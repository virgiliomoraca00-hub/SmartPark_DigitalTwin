module.exports = {
    // Abilita require() nei function node
    functionExternalModules: true,

    // Espone fs, path, crypto nel global context
    functionGlobalContext: {
        fs:     require('fs'),
        path:   require('path'),
        crypto: require('crypto')
    },

    // Credenziali flow cifrate
    credentialSecret: false,

    // Logging
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },

    // Editor
    editorTheme: {
        projects: {
            enabled: false
        }
    }
}
